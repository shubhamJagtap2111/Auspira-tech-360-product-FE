import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { AuthStore } from '../auth/auth.store';
import { BranchContextService } from '../context/branch-context.service';
import { SKIP_GLOBAL_LOADER } from '../interceptors/loader.interceptor';

export interface InboxItem {
  id: string; branchCode: string; module: string; priority: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string; message: string; actionUrl: string; createdAt: string; readAt: string | null;
}
export interface InboxSnapshot { items: InboxItem[]; unreadCount: number; total: number; page: number; pageSize: number; }
interface Response<T> { success: boolean; data: T; statusCode?: number; }
export interface InboxFilter { module?: string; priority?: string; unreadOnly?: boolean; page?: number; }

@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly api = inject(ApiClientService);
  private readonly auth = inject(AuthStore);
  private readonly branch = inject(BranchContextService);
  private readonly router = inject(Router);
  private generation = 0;
  private refreshing = false;
  private unavailableUntil = 0;
  private readonly unavailableMessage = 'Notifications are unavailable on this server. Please retry after the server update.';
  private readonly options = { context: new HttpContext().set(SKIP_GLOBAL_LOADER, true) };
  readonly snapshot = signal<InboxSnapshot>({ items: [], unreadCount: 0, total: 0, page: 1, pageSize: 30 });
  readonly recent = computed(() => this.snapshot().items.slice(0, 5));
  readonly unreadCount = computed(() => this.snapshot().unreadCount);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const user = this.auth.session()?.userId ?? this.auth.profile()?.userId;
      const branch = this.branch.selectedBranchCode();
      ++this.generation;
      this.snapshot.set({ items: [], unreadCount: 0, total: 0, page: 1, pageSize: 30 });
      this.error.set('');
      if (user && branch && this.auth.isAuthenticated()) void this.refresh();
    });
    const timer = window.setInterval(() => {
      if (this.auth.isAuthenticated() && this.branch.selectedBranchCode() && document.visibilityState === 'visible') void this.refresh();
    }, 60_000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  async fetch(filter: InboxFilter = {}): Promise<InboxSnapshot> {
    if (Date.now() < this.unavailableUntil) throw new Error(this.unavailableMessage);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== '') query.set(key, String(value));
    const result = await firstValueFrom(this.api.get<Response<InboxSnapshot>>(`/notification-inbox?${query}`, this.options));
    if (!result.success && result.statusCode === 404) {
      this.unavailableUntil = Date.now() + 5 * 60_000;
      throw new Error(this.unavailableMessage);
    }
    if (!result.success || !Array.isArray(result.data?.items)) throw new Error('Notifications are temporarily unavailable. Please retry.');
    return result.data;
  }

  async refresh(force = false): Promise<void> {
    if (this.refreshing) return;
    if (force) this.unavailableUntil = 0;
    if (Date.now() < this.unavailableUntil) { this.error.set(this.unavailableMessage); return; }
    this.refreshing = true; this.loading.set(true);
    const version = this.generation;
    try {
      const reminders = await firstValueFrom(this.api.post<Response<unknown>>('/notification-inbox/refresh', {}, this.options));
      if (!reminders.success && reminders.statusCode === 404) {
        this.unavailableUntil = Date.now() + 5 * 60_000;
        throw new Error(this.unavailableMessage);
      }
      if (!reminders.success) throw new Error('Notification reminders could not refresh. Please retry.');
      const result = await this.fetch();
      if (version === this.generation) { this.snapshot.set(result); this.error.set(''); }
    } catch (error) {
      if (version === this.generation) this.error.set(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      this.refreshing = false; this.loading.set(false);
      // A branch/account switch during a request discards the old response and fetches the new scope.
      if (version !== this.generation && this.auth.isAuthenticated()) void this.refresh();
    }
  }

  async markRead(id: string): Promise<boolean> {
    const result = await firstValueFrom(this.api.patch<Response<unknown>>(`/notification-inbox/${encodeURIComponent(id)}/read`, {}, this.options));
    if (!result.success) { this.error.set('Unable to mark this notification as read. Please retry.'); return false; }
    await this.refresh(); return true;
  }

  async markAllRead(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.api.post<Response<unknown>>('/notification-inbox/read-all', {}, this.options));
      if (!result.success) { this.error.set('Unable to mark notifications as read. Please retry.'); return; }
      await this.refresh();
    } finally { this.busy.set(false); }
  }

  async open(item: InboxItem): Promise<void> {
    // Only application routes from the server are accepted; never navigate to external URLs.
    if (!/^\/(opd|patients|appointments|ipd|laboratory|pharmacy|billing|inventory|administration|profile|reports|quality)([/?]|$)/.test(item.actionUrl)) {
      this.error.set('This notification link is unavailable.'); return;
    }
    if (!item.readAt) await this.markRead(item.id);
    await this.router.navigateByUrl(item.actionUrl);
  }
}
