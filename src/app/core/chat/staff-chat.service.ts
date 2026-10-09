import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { API_BASE_URL } from '../http/api-endpoints';
import { AuthStore } from '../auth/auth.store';
import { BranchContextService } from '../context/branch-context.service';
import { SKIP_GLOBAL_LOADER } from '../interceptors/loader.interceptor';
import { ChatQueueStore } from './chat-queue.store';
import { ChatConversation, ChatMember, ChatMessage, ChatMessagePage, ChatResponse, ChatStaff, QueuedChatMessage, mergeChatMessages, retryDelay, retryableChatFailure } from './staff-chat.models';

@Injectable({ providedIn: 'root' })
export class StaffChatService {
  private readonly api = inject(ApiClientService);
  private readonly auth = inject(AuthStore);
  private readonly branch = inject(BranchContextService);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly store = new ChatQueueStore();
  private readonly options = { context: new HttpContext().set(SKIP_GLOBAL_LOADER, true) };
  private scope = '';
  private version = 0;
  private refreshing = false;
  private flushing = false;
  private nextPollAt = 0;
  private staffSearchVersion = 0;
  readonly conversations = signal<ChatConversation[]>([]);
  readonly staff = signal<ChatStaff[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly members = signal<ChatMember[]>([]);
  readonly pending = signal<QueuedChatMessage[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly historyLoading = signal(false);
  readonly hasOlder = signal(false);
  readonly sendingId = signal<string | null>(null);
  readonly connection = signal<'connecting' | 'live' | 'offline' | 'unavailable'>('connecting');
  readonly error = signal('');
  readonly userId = computed(() => this.auth.session()?.userId ?? this.auth.profile()?.userId ?? '');
  readonly unreadCount = computed(() => this.conversations().reduce((count, item) => count + item.unreadCount, 0));
  readonly activeConversation = computed(() => this.conversations().find(item => item.id === this.activeId()) ?? null);
  readonly concreteBranch = computed(() => !!this.branch.selectedBranchCode() && this.branch.selectedBranchCode() !== 'ALL');
  readonly visiblePending = computed(() => this.pending().filter(item => item.conversationId === this.activeId() && !this.messages().some(message => message.clientMessageId === item.id && message.senderId === item.senderId)));

  constructor() {
    effect(() => {
      const user = this.userId();
      const branch = this.branch.selectedBranchCode();
      const tenant = this.auth.session()?.tenantCode ?? this.auth.profile()?.tenantCode ?? '';
      const scope = this.auth.isAuthenticated() && user && branch ? [this.baseUrl, tenant, user, branch].join('|') : '';
      if (scope !== this.scope) void this.changeScope(scope);
    });
    const timer = window.setInterval(() => {
      if (this.scope && document.visibilityState === 'visible') { void this.refresh(); void this.flush(); }
    }, 5000);
    const online = () => { this.nextPollAt = 0; void this.refresh(); void this.flush(); };
    window.addEventListener('online', online);
    const visibility = () => { if (document.visibilityState === 'visible') online(); };
    document.addEventListener('visibilitychange', visibility);
    inject(DestroyRef).onDestroy(() => {
      window.clearInterval(timer); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visibility);
    });
  }

  private async changeScope(scope: string): Promise<void> {
    this.scope = scope; const version = ++this.version;
    this.nextPollAt = 0; this.activeId.set(null); this.conversations.set([]); this.messages.set([]); this.members.set([]);
    this.staff.set([]); this.pending.set([]); this.error.set(''); this.connection.set('connecting');
    if (!scope) return;
    try { const pending = await this.store.list(scope); if (version === this.version) this.pending.set(pending); }
    catch { if (version === this.version) this.error.set('Device chat storage is unavailable. Unsent messages cannot be queued safely.'); }
    if (version === this.version) { await this.refresh(true); void this.flush(); }
  }

  async refresh(force = false): Promise<void> {
    if (!this.scope || this.refreshing || (!force && Date.now() < this.nextPollAt)) return;
    this.refreshing = true; const version = this.version; this.loading.set(!this.conversations().length);
    try {
      const response = await firstValueFrom(this.api.get<ChatResponse<ChatConversation[]>>('/chat/conversations', this.options));
      if (version !== this.version) return;
      if (!response.success || !Array.isArray(response.data)) {
        this.connection.set(response.statusCode === 404 ? 'unavailable' : 'offline');
        this.error.set(response.statusCode === 404 ? 'Staff chat is not available on this server yet.' : 'Chat could not connect. Your queued messages are kept on this device.');
        this.nextPollAt = Date.now() + 30_000; return;
      }
      this.connection.set('live'); this.error.set(''); this.conversations.set(response.data);
      const id = this.activeId();
      if (id && !response.data.some(item => item.id === id)) { this.activeId.set(null); this.messages.set([]); this.members.set([]); }
      else if (id) await this.pullMessages(id, version);
    } finally {
      this.refreshing = false;
      if (version === this.version) this.loading.set(false);
      else if (this.scope) void this.refresh(true);
    }
  }

  async loadStaff(search = ''): Promise<void> {
    const version = this.version, searchVersion = ++this.staffSearchVersion;
    const response = await firstValueFrom(this.api.get<ChatResponse<ChatStaff[]>>('/chat/staff?search=' + encodeURIComponent(search.trim()), this.options));
    if (version !== this.version || searchVersion !== this.staffSearchVersion) return;
    if (response.success && Array.isArray(response.data)) this.staff.set(response.data);
    else this.error.set('Staff directory could not load. Try again.');
  }

  async open(id: string): Promise<void> {
    this.activeId.set(id); this.messages.set([]); this.members.set([]); this.hasOlder.set(false); this.historyLoading.set(true);
    const version = this.version;
    await this.pullMessages(id, version, true);
    if (this.activeId() === id && version === this.version) this.historyLoading.set(false);
  }
  close(): void { this.activeId.set(null); this.messages.set([]); this.members.set([]); }

  private async pullMessages(id: string, version: number, initial = false): Promise<void> {
    const cursor = this.messages().at(-1)?.sequence ?? 0;
    const [response, members] = await Promise.all([
      firstValueFrom(this.api.get<ChatResponse<ChatMessagePage>>(`/chat/conversations/${id}/messages${initial ? '' : '?after=' + cursor}`, this.options)),
      firstValueFrom(this.api.get<ChatResponse<ChatMember[]>>(`/chat/conversations/${id}/members`, this.options))
    ]);
    if (version !== this.version || this.activeId() !== id) return;
    if (response.success && response.data) {
      this.messages.update(items => mergeChatMessages(initial ? [] : items, response.data!.items));
      if (initial) this.hasOlder.set(response.data.hasMore);
      // Drain all cursor pages, without discarding arrivals between polls.
      if (!initial && response.data.hasMore) await this.pullMessages(id, version);
    } else this.error.set('This conversation could not load. Refresh to retry.');
    if (members.success && members.data) this.members.set(members.data);
  }

  async older(): Promise<void> {
    const id = this.activeId(), sequence = this.messages()[0]?.sequence, version = this.version;
    if (!id || !sequence || this.historyLoading()) return;
    this.historyLoading.set(true);
    const response = await firstValueFrom(this.api.get<ChatResponse<ChatMessagePage>>(`/chat/conversations/${id}/messages?before=${sequence}`, this.options));
    if (version !== this.version || this.activeId() !== id) return;
    this.historyLoading.set(false);
    if (response.success && response.data) { this.messages.update(items => mergeChatMessages(items, response.data!.items)); this.hasOlder.set(response.data.hasMore); }
    else this.error.set('Older messages could not load. Try again.');
  }

  async create(kind: 'DIRECT' | 'GROUP', title: string, memberIds: string[], requestId: string): Promise<string | null> {
    const version = this.version;
    const response = await firstValueFrom(this.api.post<ChatResponse<{ id: string }>>('/chat/conversations', { kind, title, memberIds, requestId }, this.options));
    if (version !== this.version) return null;
    if (!response.success || !response.data) { this.error.set(response.message || 'Conversation could not be created. Try again.'); return null; }
    await this.refresh(true); await this.open(response.data.id); return response.data.id;
  }

  async enqueue(body: string): Promise<boolean> {
    const conversation = this.activeConversation(), scope = this.scope, version = this.version;
    if (!conversation || !scope || !body.trim() || body.trim().length > 4000 || !this.concreteBranch()) return false;
    try {
      if ((await this.store.list(scope)).length >= 100) throw new Error('There are 100 unsent messages. Retry or remove a queued message first.');
      const item: QueuedChatMessage = { id: crypto.randomUUID(), scope, conversationId: conversation.id, conversationTitle: conversation.title,
        senderId: this.userId(), body: body.trim(), createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: 0, state: 'queued', error: '' };
      await this.store.save(item);
      if (version === this.version) this.pending.set(await this.store.list(scope));
      void this.flush(); return true;
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Message could not be saved on this device. Your text is still in the composer.'); return false; }
  }

  private async flush(): Promise<void> {
    if (this.flushing || !this.scope || !this.concreteBranch() || this.connection() === 'unavailable' || !navigator.onLine) return;
    this.flushing = true; const scope = this.scope, version = this.version;
    try {
      const blocked = new Set<string>();
      for (const item of await this.store.list(scope)) {
        if (version !== this.version) break;
        if (blocked.has(item.conversationId)) continue;
        if (item.state === 'failed' || item.nextAttemptAt > Date.now()) { blocked.add(item.conversationId); continue; }
        this.sendingId.set(item.id);
        const response = await firstValueFrom(this.api.post<ChatResponse<ChatMessage>>(`/chat/conversations/${item.conversationId}/messages`, { clientMessageId: item.id, body: item.body, expectedSenderId: item.senderId }, this.options));
        if (response.success && response.data?.clientMessageId === item.id && response.data.senderId === item.senderId && response.data.conversationId === item.conversationId) {
          await this.store.remove(item.id);
          if (version === this.version && this.activeId() === item.conversationId) this.messages.update(items => mergeChatMessages(items, [response.data!]));
        } else {
          const retry = retryableChatFailure(response.statusCode);
          await this.store.save({ ...item, attempts: item.attempts + 1, nextAttemptAt: Date.now() + retryDelay(item.attempts + 1),
            state: retry ? 'queued' : 'failed', error: retry ? 'Waiting to reconnect. Retrying automatically.' : 'Sending was rejected. Check your access, then retry or remove this message.' });
          blocked.add(item.conversationId);
        }
      }
      if (version === this.version) { this.pending.set(await this.store.list(scope)); void this.refresh(); }
    } catch { if (version === this.version) this.error.set('Chat storage could not be updated. Messages will retry with the same ID.'); }
    finally { this.flushing = false; this.sendingId.set(null); }
  }

  async retry(item: QueuedChatMessage): Promise<void> {
    if (item.scope !== this.scope || this.sendingId() === item.id) return;
    try { await this.store.save({ ...item, state: 'queued', nextAttemptAt: 0, error: '' }); this.pending.set(await this.store.list(this.scope)); void this.flush(); }
    catch { this.error.set('Retry could not be saved. Try again.'); }
  }
  async discard(item: QueuedChatMessage): Promise<void> {
    if (item.scope !== this.scope || this.sendingId() === item.id) return;
    await this.store.remove(item.id); this.pending.set(await this.store.list(this.scope)); void this.flush();
  }
  async readVisible(): Promise<void> {
    const conversation = this.activeConversation(), sequence = this.messages().at(-1)?.sequence, version = this.version;
    if (!conversation || !sequence || sequence <= conversation.lastReadSequence || document.visibilityState !== 'visible') return;
    const response = await firstValueFrom(this.api.post<ChatResponse<unknown>>(`/chat/conversations/${conversation.id}/read`, { throughSequence: sequence }, this.options));
    if (version === this.version && response.success) this.conversations.update(items => items.map(item => item.id === conversation.id ? {
      ...item, lastReadSequence: Math.max(item.lastReadSequence, sequence),
      unreadCount: item.lastSequence <= sequence ? 0 : item.unreadCount
    } : item));
  }
  async manage(action: string, userId: string | null, title: string | null): Promise<boolean> {
    const id = this.activeId(), version = this.version; if (!id) return false;
    const response = await firstValueFrom(this.api.post<ChatResponse<unknown>>(`/chat/conversations/${id}/manage`, { action, userId, title }, this.options));
    if (version !== this.version) return false;
    if (!response.success) { this.error.set(response.message || 'Group update could not be saved.'); return false; }
    await this.refresh(true); return true;
  }
  async draft(id: string): Promise<string> { try { return await this.store.draft(this.scope, id); } catch { return ''; } }
  async saveDraft(id: string, text: string): Promise<void> { try { await this.store.saveDraft(this.scope, id, text); } catch { this.error.set('Draft could not be saved on this device.'); } }
}
