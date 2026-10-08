import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BranchContextService } from '../../core/context/branch-context.service';
import { InboxSnapshot, NotificationInboxService } from '../../core/notifications/notification-inbox.service';

@Component({
  selector: 'ac-notification-inbox-page', standalone: true, imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ac-workspace inbox-page">
      <header class="ac-workspace-head"><div><p class="ac-eyebrow">Your workspace</p><h1>Notifications</h1>
        <p>Updates and actions for your authorised branches.</p></div><div class="actions">
        <button (click)="refresh()" [disabled]="loading()">Refresh</button>
        <button (click)="readAll()" [disabled]="inbox.busy() || !inbox.unreadCount()">Mark all as read</button></div></header>
      <div class="filters">
        <label>Module<select [(ngModel)]="module" (ngModelChange)="reset()"><option value="">All modules</option>
          @for (name of modules; track name) {<option [value]="name">{{name}}</option>}</select></label>
        <label>Priority<select [(ngModel)]="priority" (ngModelChange)="reset()"><option value="">All priorities</option>
          <option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="INFO">Information</option></select></label>
        <label class="check"><input type="checkbox" [(ngModel)]="unreadOnly" (ngModelChange)="reset()"> Unread only</label>
        <span>{{inbox.unreadCount()}} unread in this workspace</span>
      </div>
      <p class="notice">Reading an alert does not acknowledge a critical result or complete its clinical action.</p>
      @if (error() || inbox.error()) {<div class="error" role="alert">{{error() || inbox.error()}} <button (click)="refresh()">Retry</button></div>}
      @if (loading()) {<p role="status">Loading notifications…</p>}
      @else {
        <div class="items">
          @for (item of data().items; track item.id) {
            <article [class.unread]="!item.readAt" [class.critical]="item.priority === 'CRITICAL'">
              <div class="item-body"><div class="meta"><span>{{item.module}}</span><span>{{item.branchCode}}</span>
                <strong>{{item.priority}}</strong><span>{{item.createdAt | date:'dd MMM yyyy, h:mm a'}}</span>
                @if (!item.readAt) {<span class="unread-label">Unread</span>}</div>
                <h2>{{item.title}}</h2><p>{{item.message}}</p></div>
              <div class="actions"><button (click)="inbox.open(item)">Open record / queue →</button>
                @if (!item.readAt) {<button (click)="read(item.id)">Mark as read</button>}</div>
            </article>
          } @empty {<div class="empty">No notifications match these filters.</div>}
        </div>
        <footer><span>{{data().total}} notifications</span><div class="actions">
          <button (click)="changePage(-1)" [disabled]="page === 1">Previous</button><span>Page {{page}}</span>
          <button (click)="changePage(1)" [disabled]="page * data().pageSize >= data().total">Next</button></div></footer>
      }
    </section>`,
  styles: [`
    :host{display:block}.inbox-page{padding:24px;max-width:1400px;margin:auto;color:var(--ac-text)}
    .filters,.actions,footer{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.filters{padding:18px;background:var(--ac-surface);border:1px solid var(--ac-border);border-radius:12px}
    label{display:grid;gap:6px;font-weight:600;font-size:13px}.check{display:flex;align-items:center}.notice{font-size:13px;color:var(--ac-muted);margin:16px 0}
    select,button{font:inherit;color:var(--ac-text);background:var(--ac-surface);border:1px solid var(--ac-border);border-radius:9px;min-height:42px;padding:9px 12px}
    button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,select:focus-visible{outline:2px solid var(--ac-primary);outline-offset:2px}
    .items{display:grid;gap:12px}article{display:flex;align-items:center;gap:16px;padding:20px;border:1px solid var(--ac-border);border-radius:12px;background:var(--ac-surface)}
    article.unread{border-left:3px solid var(--ac-primary)}article.critical{border-left:3px solid var(--ac-error)}.item-body{flex:1;min-width:0}
    .meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--ac-muted);font-size:12px}.meta strong,.unread-label{color:var(--ac-primary)}
    h2{font-size:16px;margin:10px 0 6px}article p{margin:0;font-size:14px;overflow-wrap:anywhere}.error{padding:12px;background:var(--ac-surface);color:var(--ac-error)}
    footer{justify-content:space-between;margin-top:20px}.empty{padding:48px;text-align:center;background:var(--ac-surface);border-radius:12px}
    @media(max-width:700px){.inbox-page{padding:14px}article{align-items:stretch;flex-direction:column}.filters label:not(.check){flex:1;min-width:130px}.actions{gap:8px}}
  `]
})
export class NotificationInboxPageComponent {
  readonly inbox = inject(NotificationInboxService);
  private readonly branch = inject(BranchContextService);
  readonly modules = ['Patients','Doctors','Appointments','OPD','IPD','Laboratory','Pharmacy','Billing','Inventory','Administration','Reports','Quality'];
  readonly loading = signal(false); readonly error = signal('');
  readonly data = signal<InboxSnapshot>({ items: [], unreadCount: 0, total: 0, page: 1, pageSize: 30 });
  module = ''; priority = ''; unreadOnly = false; page = 1;
  private revision = 0;
  constructor() { effect(() => { this.branch.selectedBranchCode(); this.inbox.snapshot(); void this.load(); }); }
  reset() { this.page = 1; void this.load(); }
  changePage(delta: number) { this.page += delta; void this.load(); }
  async refresh() { await this.inbox.refresh(true); await this.load(); }
  async readAll() { await this.inbox.markAllRead(); await this.load(); }
  async read(id: string) { await this.inbox.markRead(id); await this.load(); }
  private async load() {
    const revision = ++this.revision; this.loading.set(true); this.error.set('');
    // Clear the preceding branch immediately, including when the next request fails.
    this.data.set({ items: [], unreadCount: 0, total: 0, page: this.page, pageSize: 30 });
    try { const result = await this.inbox.fetch({module: this.module, priority: this.priority, unreadOnly: this.unreadOnly, page: this.page});
      if (revision === this.revision) this.data.set(result);
    } catch (error) { if (revision === this.revision) this.error.set(error instanceof Error ? error.message : 'Unable to load notifications.'); }
    finally { if (revision === this.revision) this.loading.set(false); }
  }
}
