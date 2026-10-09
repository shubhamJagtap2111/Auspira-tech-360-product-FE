import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { StaffChatService } from '../../core/chat/staff-chat.service';
import { ChatConversation, ChatMessage, QueuedChatMessage } from '../../core/chat/staff-chat.models';
import { BranchContextService } from '../../core/context/branch-context.service';
import { DialogService } from '../../shared/ui/dialog/dialog.service';

@Component({
  selector: 'ac-staff-chat-page', standalone: true, imports: [DatePipe, FormsModule, A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-chat-page.component.html', styleUrl: './staff-chat-page.component.css'
})
export class StaffChatPageComponent {
  readonly chat = inject(StaffChatService);
  readonly branch = inject(BranchContextService);
  private readonly dialogs = inject(DialogService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  readonly search = signal('');
  readonly filter = signal<'all' | 'unread' | 'groups'>('all');
  readonly composeOpen = signal(false);
  readonly detailsOpen = signal(false);
  readonly queueOpen = signal(false);
  readonly creating = signal(false);
  readonly sending = signal(false);
  readonly managing = signal(false);
  readonly newBelow = signal(false);
  readonly selected = signal<string[]>([]);
  readonly filteredConversations = computed(() => this.chat.conversations().filter(item =>
    (this.filter() !== 'unread' || item.unreadCount > 0) && (this.filter() !== 'groups' || item.kind === 'GROUP') &&
    [item.title, item.lastMessage, item.branchCode].some(value => value.toLowerCase().includes(this.search().trim().toLowerCase()))));
  readonly availableToAdd = computed(() => this.chat.staff().filter(staff => !this.chat.members().some(member => member.userId === staff.userId)));
  composer = '';
  mode: 'DIRECT' | 'GROUP' = 'DIRECT';
  groupTitle = '';
  staffSearch = '';
  addMemberId = '';
  renameTitle = '';
  private requestId = crypto.randomUUID();
  private stickBottom = true;
  private staffTimer?: number;
  private draftVersion = 0;
  private lastThread: string | null = null;
  private lastRenderedSequence = 0;

  constructor() {
    effect(() => {
      const id = this.chat.activeId();
      this.composer = ''; this.detailsOpen.set(false); this.stickBottom = true; this.newBelow.set(false);
      const version = ++this.draftVersion;
      if (id) void this.chat.draft(id).then(text => {
        if (version === this.draftVersion && this.chat.activeId() === id && !this.composer) { this.composer = text; this.changeDetector.markForCheck(); }
      });
    });
    effect(() => {
      const messages = this.chat.messages(); this.chat.visiblePending();
      const id = this.chat.activeId();
      const sequence = messages.at(-1)?.sequence ?? 0;
      const newArrival = id === this.lastThread && sequence > this.lastRenderedSequence;
      this.lastThread = id; this.lastRenderedSequence = sequence;
      if (!id) return;
      requestAnimationFrame(() => {
        if (this.chat.activeId() !== id) return;
        if (this.stickBottom) this.scrollToLatest();
        else if (newArrival) this.newBelow.set(true);
      });
    });
    inject(DestroyRef).onDestroy(() => { window.clearTimeout(this.staffTimer); this.chat.close(); });
  }
  initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(); }
  async open(conversation: ChatConversation): Promise<void> { this.stickBottom = true; await this.chat.open(conversation.id); }
  async older(): Promise<void> {
    const element = this.thread()?.nativeElement, id = this.chat.activeId();
    const height = element?.scrollHeight ?? 0, top = element?.scrollTop ?? 0;
    this.stickBottom = false;
    await this.chat.older();
    requestAnimationFrame(() => { if (element && this.chat.activeId() === id) element.scrollTop = top + element.scrollHeight - height; });
  }
  onScroll(): void {
    const element = this.thread()?.nativeElement;
    if (!element) return;
    this.stickBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (this.stickBottom) { this.newBelow.set(false); void this.chat.readVisible(); }
  }
  scrollToLatest(): void {
    const element = this.thread()?.nativeElement;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    this.stickBottom = true; this.newBelow.set(false); void this.chat.readVisible();
  }
  @HostListener('document:visibilitychange') onVisibility(): void {
    if (document.visibilityState === 'visible' && this.stickBottom) void this.chat.readVisible();
  }
  draftChanged(): void { const id = this.chat.activeId(); if (id) void this.chat.saveDraft(id, this.composer); }
  async send(): Promise<void> {
    if (this.sending() || !this.composer.trim()) return;
    const id = this.chat.activeId(), text = this.composer;
    this.sending.set(true);
    try {
      if (await this.chat.enqueue(text)) {
        if (this.chat.activeId() === id && this.composer === text) { this.composer = ''; if (id) await this.chat.saveDraft(id, ''); }
        this.stickBottom = true;
      }
    } finally { this.sending.set(false); }
  }
  composerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void this.send(); }
  }
  readLabel(message: ChatMessage): string {
    const readers = this.chat.members().filter(member => member.userId !== message.senderId && member.lastReadSequence >= message.sequence).length;
    return readers ? (this.chat.activeConversation()?.kind === 'DIRECT' ? 'Read' : `Read by ${readers}`) : 'Sent';
  }
  isNewDay(index: number): boolean {
    const messages = this.chat.messages();
    return index === 0 || new Date(messages[index].createdAt).toDateString() !== new Date(messages[index - 1].createdAt).toDateString();
  }
  startChat(): void {
    this.mode = 'DIRECT'; this.groupTitle = ''; this.staffSearch = ''; this.selected.set([]);
    this.requestId = crypto.randomUUID(); this.composeOpen.set(true); void this.chat.loadStaff();
  }
  setMode(mode: 'DIRECT' | 'GROUP'): void { this.mode = mode; this.selected.set([]); this.requestId = crypto.randomUUID(); }
  toggleStaff(id: string): void {
    this.selected.update(items => this.mode === 'DIRECT' ? (items.includes(id) ? [] : [id]) : (items.includes(id) ? items.filter(item => item !== id) : items.length < 49 ? [...items, id] : items));
    this.requestId = crypto.randomUUID();
  }
  findStaff(): void { window.clearTimeout(this.staffTimer); this.staffTimer = window.setTimeout(() => void this.chat.loadStaff(this.staffSearch), 250); }
  titleChanged(): void { this.requestId = crypto.randomUUID(); }
  async create(): Promise<void> {
    if (this.creating() || !this.selected().length) return;
    this.creating.set(true); this.stickBottom = true;
    try { if (await this.chat.create(this.mode, this.groupTitle, this.selected(), this.requestId)) this.composeOpen.set(false); }
    finally { this.creating.set(false); }
  }
  showDetails(): void {
    this.renameTitle = this.chat.activeConversation()?.title ?? ''; this.addMemberId = ''; this.staffSearch = '';
    this.detailsOpen.update(open => !open); if (this.detailsOpen()) void this.chat.loadStaff();
  }
  async manage(action: string, userId: string | null = null): Promise<void> {
    if (this.managing()) return;
    if (action === 'REMOVE' || action === 'LEAVE') {
      const accepted = await this.dialogs.confirm({ title: action === 'LEAVE' ? 'Leave this group?' : 'Remove this member?',
        message: action === 'LEAVE' ? 'You will lose access to this conversation. A group administrator can add you again.' : 'This member will lose access to the group and its message history.',
        confirmText: action === 'LEAVE' ? 'Leave group' : 'Remove member', intent: 'warning' });
      if (!accepted) return;
    }
    this.managing.set(true);
    try { if (await this.chat.manage(action, userId, action === 'RENAME' ? this.renameTitle : null)) this.addMemberId = ''; }
    finally { this.managing.set(false); }
  }
  async discard(item: QueuedChatMessage): Promise<void> {
    if (await this.dialogs.confirm({ title: 'Remove this unsent message?', message: 'This removes the queued copy on this device. If another tab already sent it, the sent message remains in the conversation.', confirmText: 'Remove from queue', intent: 'warning' })) await this.chat.discard(item);
  }
  @HostListener('document:keydown.escape') escape(): void { if (!this.creating()) this.composeOpen.set(false); this.detailsOpen.set(false); this.queueOpen.set(false); }
}
