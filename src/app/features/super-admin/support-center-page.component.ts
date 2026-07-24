import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { SupportCenterSnapshot, SupportTicketItem } from './support-center.models';
import { SupportCenterService } from './support-center.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="support-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Support Center</p>
          <h1 class="ac-page-title">Tickets, Hospitals, Issues, SLA</h1>
          <p>Track hospital support tickets by issue, priority, SLA deadline, and status from the Super Admin control plane.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/monitoring" title="Open monitoring">
            <span class="material-symbols-rounded">monitoring</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh support">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (snapshot(); as model) {
        <section class="stat-grid">
          <article class="stat"><span class="material-symbols-rounded">confirmation_number</span><p>Tickets</p><strong>{{ model.summary.totalTickets }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">pending_actions</span><p>Open</p><strong>{{ model.summary.openTickets }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">priority_high</span><p>Critical</p><strong>{{ model.summary.criticalTickets }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">timer_off</span><p>SLA Breached</p><strong>{{ model.summary.breachedSlaTickets }}</strong></article>
        </section>

        <section class="workspace-grid">
          <main class="table-panel">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Hospital</th>
                  <th>Issue</th>
                  <th>Priority</th>
                  <th>SLA</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                @for (ticket of model.tickets; track ticket.ticketId) {
                  <tr [class.selected]="selectedTicketId() === ticket.ticketId">
                    <td>
                      <button class="link-cell" type="button" (click)="selectTicket(ticket)">
                        <strong>{{ ticket.ticketNo }}</strong>
                        <span>{{ ticket.title }}</span>
                      </button>
                    </td>
                    <td><strong>{{ ticket.hospitalName }}</strong><small>{{ ticket.tenantCode }}</small></td>
                    <td>{{ ticket.issueType }}</td>
                    <td><span class="pill" [class]="priorityClass(ticket.priority)">{{ ticket.priority }}</span></td>
                    <td><strong>{{ ticket.slaHours }}h</strong><small>{{ ticket.dueAt | date:'short' }}</small></td>
                    <td><span class="pill" [class]="statusClass(ticket.status)">{{ ticket.status }}</span></td>
                    <td>{{ ticket.assignedTo || '-' }}</td>
                    <td>{{ ticket.openedAt | date:'mediumDate' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="8" class="empty">No support tickets yet.</td></tr>
                }
              </tbody>
            </table>
          </main>

          <aside class="ops-panel">
            <section class="mini-form">
              <h2>New Ticket</h2>
              <ac-dropdown [(ngModel)]="ticketForm.tenantCode" name="ticketTenant" [options]="hospitalOptions(model)" />
              <ac-dropdown [(ngModel)]="ticketForm.issueType" name="issueType" [options]="issueTypeOptions" />
              <input [(ngModel)]="ticketForm.title" name="ticketTitle" placeholder="Issue title" />
              <textarea [(ngModel)]="ticketForm.description" name="ticketDescription" placeholder="Issue details"></textarea>
              <div class="form-grid">
                <ac-dropdown [(ngModel)]="ticketForm.priority" name="priority" [options]="priorityOptions" />
                <input [(ngModel)]="ticketForm.slaHours" name="slaHours" type="number" min="1" />
              </div>
              <input [(ngModel)]="ticketForm.assignedTo" name="assignedTo" placeholder="Assigned to" />
              <button class="ac-btn ac-btn-primary" type="button" (click)="createTicket()">Create Ticket</button>
            </section>

            <section class="mini-form">
              <h2>Status</h2>
              @if (selectedTicket(); as ticket) {
                <p><strong>{{ ticket.ticketNo }}</strong><span>{{ ticket.hospitalName }}</span></p>
              } @else {
                <p class="empty">Select a ticket to update.</p>
              }
              <ac-dropdown [(ngModel)]="statusForm.status" name="status" [options]="ticketStatusOptions" />
              <input [(ngModel)]="statusForm.assignedTo" name="statusAssignedTo" placeholder="Assigned to" />
              <textarea [(ngModel)]="statusForm.resolution" name="resolution" placeholder="Resolution"></textarea>
              <button class="ac-btn ac-btn-primary" type="button" [disabled]="!selectedTicketId()" (click)="updateStatus()">Update Status</button>
            </section>

            <section class="hospital-list">
              <h2>Hospitals</h2>
              @for (hospital of model.hospitals; track hospital.tenantCode) {
                <article>
                  <strong>{{ hospital.hospitalName }}</strong>
                  <small>{{ hospital.planCode }} - {{ hospital.tenantStatus }}</small>
                </article>
              }
            </section>
          </aside>
        </section>
      } @else {
        <section class="loading">Loading support center...</section>
      }
    </section>
  `,
  styles: [`
    .support-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .stat, .table-panel, .ops-panel { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 8px; box-shadow: var(--ac-shadow-sm); }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); max-width: 860px; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .head-actions { display: flex; gap: 8px; }
    .icon-btn { width: 38px; height: 38px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); background: var(--ac-surface); text-decoration: none; cursor: pointer; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat { padding: 16px; display: grid; gap: 6px; }
    .stat span { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .stat strong { font-size: 28px; }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 16px; align-items: start; }
    .table-panel, .ops-panel { padding: 14px; overflow: auto; }
    table { width: 100%; min-width: 940px; border-collapse: collapse; }
    th, td { padding: 11px 10px; border-bottom: 1px solid var(--ac-border); text-align: left; vertical-align: top; }
    th { font-size: 12px; color: var(--ac-muted); text-transform: uppercase; white-space: nowrap; }
    td small, .link-cell span, .mini-form p span { display: block; color: var(--ac-muted); margin-top: 3px; }
    .link-cell { border: 0; background: transparent; color: var(--ac-text); cursor: pointer; padding: 0; text-align: left; }
    .selected { background: color-mix(in srgb, var(--ac-primary) 6%, var(--ac-surface)); }
    .pill { border-radius: 999px; padding: 4px 8px; font-size: 12px; background: var(--ac-border); }
    .pill.low, .pill.resolved, .pill.closed { background: color-mix(in srgb, var(--ac-success) 14%, var(--ac-surface)); color: var(--ac-success); }
    .pill.medium, .pill.open, .pill.inprogress, .pill.waiting { background: color-mix(in srgb, var(--ac-primary) 14%, var(--ac-surface)); color: var(--ac-primary); }
    .pill.high, .pill.slabreached { background: color-mix(in srgb, #c78318 18%, var(--ac-surface)); color: #9a5c00; }
    .pill.critical { background: color-mix(in srgb, var(--ac-danger) 14%, var(--ac-surface)); color: var(--ac-danger); }
    .ops-panel { display: grid; gap: 14px; }
    .mini-form, .hospital-list article { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); padding: 12px; display: grid; gap: 9px; }
    .mini-form h2, .hospital-list h2 { margin: 0; font-size: 18px; }
    .form-grid { display: grid; grid-template-columns: 1fr 100px; gap: 8px; }
    input, select, textarea { min-height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); min-width: 0; }
    textarea { min-height: 78px; padding: 10px; resize: vertical; }
    .hospital-list { display: grid; gap: 9px; }
    .hospital-list small, .empty, .loading { color: var(--ac-muted); }
    @media (max-width: 1120px) { .workspace-grid, .stat-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .page-head { flex-direction: column; } }
  `]
})
export class SupportCenterPageComponent implements OnInit {
  private readonly supportService = inject(SupportCenterService);
  private readonly toast = inject(ToastService);

  protected readonly snapshot = signal<SupportCenterSnapshot | null>(null);
  protected readonly selectedTicketId = signal<string | null>(null);
  protected readonly selectedTicket = computed(() => this.snapshot()?.tickets.find(ticket => ticket.ticketId === this.selectedTicketId()) ?? null);

  protected ticketForm = { tenantCode: '', issueType: 'Provisioning', title: '', description: '', priority: 'Medium', slaHours: 24, assignedTo: '' };
  protected statusForm = { status: 'InProgress', assignedTo: '', resolution: '' };
  protected readonly issueTypeOptions = ['Provisioning', 'Billing', 'Database', 'Performance', 'Access', 'Integration'].map(value => ({ label: value, value }));
  protected readonly priorityOptions = ['Low', 'Medium', 'High', 'Critical'].map(value => ({ label: value, value }));
  protected readonly ticketStatusOptions = ['Open', 'InProgress', 'Waiting', 'Resolved', 'Closed'].map(value => ({ label: value, value }));

  ngOnInit(): void {
    void this.load();
  }

  protected hospitalOptions(model: SupportCenterSnapshot) {
    return [
      { label: 'Select hospital', value: '' },
      ...model.hospitals.map(hospital => ({ label: hospital.hospitalName, value: hospital.tenantCode }))
    ];
  }

  protected async load(): Promise<void> {
    const response = await this.supportService.getSnapshot();
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load support center');
      return;
    }

    this.snapshot.set(response.data);
  }

  protected selectTicket(ticket: SupportTicketItem): void {
    this.selectedTicketId.set(ticket.ticketId);
    this.statusForm = { status: normalizeStatus(ticket.status), assignedTo: ticket.assignedTo, resolution: ticket.resolution };
  }

  protected async createTicket(): Promise<void> {
    if (!this.ticketForm.tenantCode || !this.ticketForm.title.trim()) {
      this.toast.error('Hospital and title are required.');
      return;
    }

    const response = await this.supportService.createTicket({
      ...this.ticketForm,
      description: this.ticketForm.description || null,
      assignedTo: this.ticketForm.assignedTo || null
    });
    this.handleSnapshot(response, 'Support ticket created.');
  }

  protected async updateStatus(): Promise<void> {
    const ticketId = this.selectedTicketId();
    if (!ticketId) {
      return;
    }

    const response = await this.supportService.updateStatus(ticketId, {
      status: this.statusForm.status,
      assignedTo: this.statusForm.assignedTo || null,
      resolution: this.statusForm.resolution || null
    });
    this.handleSnapshot(response, 'Ticket status updated.');
  }

  protected priorityClass(priority: string): string {
    return priority.toLowerCase();
  }

  protected statusClass(status: string): string {
    return status.toLowerCase();
  }

  private handleSnapshot(response: { success: boolean; data: SupportCenterSnapshot | null; message?: string }, successMessage: string): void {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Support action failed');
      return;
    }

    this.snapshot.set(response.data);
    this.toast.success(successMessage);
  }
}

function normalizeStatus(status: string): string {
  return status === 'SlaBreached' ? 'InProgress' : status;
}
