import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { NotificationCenterService } from './notification-center.service';
import { NotificationCenterSnapshot, NotificationTemplateItem } from './notification-center.models';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="notification-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Notification Center</p>
          <h1 class="ac-page-title">Application Updates, Maintenance, Renewal Reminders</h1>
          <p>Send platform-wide or targeted hospital communications through Email, SMS, Push, and WhatsApp channels.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/support" title="Open support center">
            <span class="material-symbols-rounded">support_agent</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh notifications">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (snapshot(); as model) {
        <section class="stat-grid">
          <article class="stat"><span class="material-symbols-rounded">campaign</span><p>Campaigns</p><strong>{{ model.summary.totalCampaigns }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">mark_email_read</span><p>Sent</p><strong>{{ model.summary.sentCampaigns }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">event_upcoming</span><p>Scheduled</p><strong>{{ model.summary.scheduledCampaigns }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">pending_actions</span><p>Pending</p><strong>{{ model.summary.pendingDeliveries }}</strong></article>
          <article class="stat danger"><span class="material-symbols-rounded">error</span><p>Failed</p><strong>{{ model.summary.failedDeliveries }}</strong></article>
        </section>

        <section class="workspace-grid">
          <main class="send-panel">
            <div class="panel-title">
              <div>
                <h2>Send</h2>
                <p>Target hospitals by lifecycle, choose channels, then send now or schedule for later.</p>
              </div>
              <span class="count-pill">{{ selectedTenantCount(model) }} hospitals</span>
            </div>

            <div class="type-row" role="group" aria-label="Notification type">
              @for (type of notificationTypes; track type.code) {
                <button type="button" [class.active]="sendForm.notificationType === type.code" (click)="sendForm.notificationType = type.code">
                  <span class="material-symbols-rounded">{{ type.icon }}</span>
                  <strong>{{ type.label }}</strong>
                </button>
              }
            </div>

            <div class="field-grid">
              <label>
                <span>Title</span>
                <input [(ngModel)]="sendForm.title" name="notificationTitle" placeholder="Subject or notification title" />
              </label>
              <label>
                <span>Audience</span>
                <ac-dropdown [(ngModel)]="sendForm.audience" name="notificationAudience" [options]="audienceOptions()" />
              </label>
              <label>
                <span>Schedule</span>
                <input [(ngModel)]="sendForm.scheduledAt" name="scheduledAt" type="datetime-local" />
              </label>
            </div>

            <label class="message-field">
              <span>Message</span>
              <textarea [(ngModel)]="sendForm.message" name="notificationMessage" placeholder="Message body"></textarea>
            </label>

            <div class="section-line">
              <h3>Channels</h3>
              <div class="channel-grid">
                @for (channel of channels; track channel.code) {
                  <label class="channel-toggle">
                    <input type="checkbox" [checked]="sendForm.channels.includes(channel.code)" (change)="toggleChannel(channel.code)" />
                    <span class="material-symbols-rounded">{{ channel.icon }}</span>
                    <strong>{{ channel.label }}</strong>
                  </label>
                }
              </div>
            </div>

            @if (sendForm.audience === 'SelectedHospitals') {
              <div class="section-line">
                <h3>Hospitals</h3>
                <div class="tenant-picker">
                  @for (tenant of model.tenants; track tenant.tenantCode) {
                    <label>
                      <input type="checkbox" [checked]="sendForm.tenantCodes.includes(tenant.tenantCode)" (change)="toggleTenant(tenant.tenantCode)" />
                      <span>
                        <strong>{{ tenant.hospitalName }}</strong>
                        <small>{{ tenant.tenantCode }} - {{ tenant.planCode }} - {{ tenant.tenantStatus }}</small>
                      </span>
                    </label>
                  }
                </div>
              </div>
            }

            <div class="send-actions">
              <button class="ac-btn ac-btn-primary" type="button" (click)="send()">
                <span class="material-symbols-rounded">send</span>
                Send Notification
              </button>
              <button class="ac-btn" type="button" (click)="resetSendForm()">
                <span class="material-symbols-rounded">restart_alt</span>
                Reset
              </button>
            </div>
          </main>

          <aside class="template-panel">
            <div class="panel-title">
              <div>
                <h2>Templates</h2>
                <p>{{ model.templates.length }} reusable channel templates</p>
              </div>
            </div>

            <div class="template-list">
              @for (template of model.templates; track template.templateId) {
                <button type="button" [class.active]="selectedTemplateId() === template.templateId" (click)="selectTemplate(template)">
                  <span class="channel-dot">{{ template.channel.slice(0, 2) }}</span>
                  <strong>{{ typeLabel(template.notificationType) }}</strong>
                  <small>{{ template.templateCode }}</small>
                </button>
              }
            </div>

            <section class="template-form">
              <h3>Edit Template</h3>
              <div class="form-grid">
                <ac-dropdown [(ngModel)]="templateForm.notificationType" name="templateType" [options]="notificationTypeOptions()" />
                <ac-dropdown [(ngModel)]="templateForm.channel" name="templateChannel" [options]="channelOptions()" />
              </div>
              <input [(ngModel)]="templateForm.templateCode" name="templateCode" placeholder="Template code" />
              <input [(ngModel)]="templateForm.subject" name="templateSubject" placeholder="Subject" />
              <textarea [(ngModel)]="templateForm.body" name="templateBody" placeholder="Template body"></textarea>
              <label class="active-toggle">
                <input type="checkbox" [(ngModel)]="templateForm.isActive" name="templateIsActive" />
                <span>Active</span>
              </label>
              <button class="ac-btn ac-btn-primary" type="button" (click)="saveTemplate()">Save Template</button>
            </section>
          </aside>
        </section>

        <section class="table-grid">
          <article class="table-panel">
            <div class="panel-title">
              <h2>Campaigns</h2>
              <span class="count-pill">{{ model.campaigns.length }}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Type</th>
                  <th>Audience</th>
                  <th>Channels</th>
                  <th>Status</th>
                  <th>Deliveries</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                @for (campaign of model.campaigns; track campaign.campaignId) {
                  <tr>
                    <td><strong>{{ campaign.campaignNo }}</strong><small>{{ campaign.title }}</small></td>
                    <td>{{ typeLabel(campaign.notificationType) }}</td>
                    <td><strong>{{ audienceLabel(campaign.audience) }}</strong><small>{{ campaign.targetTenantCodes.join(', ') || 'All matching hospitals' }}</small></td>
                    <td>
                      <span class="tag" *ngFor="let channel of campaign.channels">{{ channel }}</span>
                    </td>
                    <td><span class="pill" [class]="statusClass(campaign.status)">{{ campaign.status }}</span></td>
                    <td><strong>{{ campaign.deliveryCount }}</strong><small>{{ campaign.failedCount }} failed</small></td>
                    <td>{{ campaign.createdAt | date:'short' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="empty">No notification campaigns yet.</td></tr>
                }
              </tbody>
            </table>
          </article>

          <article class="table-panel">
            <div class="panel-title">
              <h2>Delivery Status</h2>
              <span class="count-pill">{{ model.deliveries.length }}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Hospital</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                @for (delivery of model.deliveries; track delivery.deliveryId) {
                  <tr>
                    <td><strong>{{ delivery.campaignNo }}</strong></td>
                    <td><strong>{{ delivery.hospitalName || '-' }}</strong><small>{{ delivery.tenantCode }}</small></td>
                    <td>{{ delivery.channel }}</td>
                    <td><span class="pill" [class]="statusClass(delivery.status)">{{ delivery.status }}</span></td>
                    <td><small>{{ delivery.providerReference || delivery.errorMessage || '-' }}</small></td>
                    <td>{{ delivery.sentAt ? (delivery.sentAt | date:'short') : '-' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="empty">No delivery rows yet.</td></tr>
                }
              </tbody>
            </table>
          </article>
        </section>
      } @else {
        <section class="loading">Loading notification center...</section>
      }
    </section>
  `,
  styles: [`
    .notification-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .stat, .send-panel, .template-panel, .table-panel { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 8px; box-shadow: var(--ac-shadow-sm); }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); max-width: 860px; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .head-actions, .send-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .icon-btn { width: 38px; height: 38px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); background: var(--ac-surface); text-decoration: none; cursor: pointer; }
    .stat-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .stat { padding: 16px; display: grid; gap: 6px; min-width: 0; }
    .stat span { color: var(--ac-primary); }
    .stat.danger span { color: var(--ac-danger); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .stat strong { font-size: 28px; line-height: 1; }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
    .send-panel, .template-panel, .table-panel { padding: 14px; overflow: auto; }
    .panel-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .panel-title h2, .template-form h3, .section-line h3 { margin: 0; font-size: 18px; }
    .panel-title p { margin: 3px 0 0; color: var(--ac-muted); }
    .count-pill { border: 1px solid var(--ac-border); border-radius: 999px; padding: 5px 9px; color: var(--ac-muted); white-space: nowrap; font-size: 12px; }
    .type-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .type-row button { min-height: 70px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); color: var(--ac-text); display: flex; align-items: center; gap: 10px; padding: 12px; cursor: pointer; text-align: left; }
    .type-row button.active, .template-list button.active { border-color: var(--ac-primary); background: color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)); }
    .type-row span { color: var(--ac-primary); }
    .field-grid { display: grid; grid-template-columns: minmax(220px, 1fr) 210px 220px; gap: 10px; margin-top: 12px; }
    label, .message-field { display: grid; gap: 6px; min-width: 0; }
    label > span, .message-field > span { font-size: 12px; font-weight: 700; color: var(--ac-muted); text-transform: uppercase; }
    input, select, textarea { min-height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); min-width: 0; }
    textarea { min-height: 96px; padding: 10px; resize: vertical; }
    .message-field, .section-line, .send-actions { margin-top: 12px; }
    .channel-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .channel-toggle, .tenant-picker label, .active-toggle { border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; background: var(--ac-subtle); display: flex; align-items: center; gap: 8px; }
    .channel-toggle input, .tenant-picker input, .active-toggle input { min-height: auto; width: 16px; height: 16px; }
    .tenant-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 260px; overflow: auto; }
    .tenant-picker small, td small { display: block; color: var(--ac-muted); margin-top: 3px; }
    .template-list { display: grid; gap: 8px; max-height: 280px; overflow: auto; }
    .template-list button { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); color: var(--ac-text); display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 2px 8px; align-items: center; padding: 9px; text-align: left; cursor: pointer; }
    .template-list small { color: var(--ac-muted); grid-column: 2; overflow-wrap: anywhere; }
    .channel-dot { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, var(--ac-primary) 12%, var(--ac-surface)); color: var(--ac-primary); font-size: 12px; font-weight: 800; grid-row: span 2; text-transform: uppercase; }
    .template-form { margin-top: 12px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); padding: 12px; display: grid; gap: 9px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .table-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
    table { width: 100%; min-width: 920px; border-collapse: collapse; }
    th, td { padding: 11px 10px; border-bottom: 1px solid var(--ac-border); text-align: left; vertical-align: top; }
    th { font-size: 12px; color: var(--ac-muted); text-transform: uppercase; white-space: nowrap; }
    .tag { display: inline-flex; border-radius: 999px; padding: 4px 8px; margin: 0 4px 4px 0; font-size: 12px; color: var(--ac-primary); background: color-mix(in srgb, var(--ac-primary) 12%, var(--ac-surface)); }
    .pill { border-radius: 999px; padding: 4px 8px; font-size: 12px; background: var(--ac-border); }
    .pill.sent { background: color-mix(in srgb, var(--ac-success) 14%, var(--ac-surface)); color: var(--ac-success); }
    .pill.scheduled, .pill.pending { background: color-mix(in srgb, var(--ac-primary) 14%, var(--ac-surface)); color: var(--ac-primary); }
    .pill.failed { background: color-mix(in srgb, var(--ac-danger) 14%, var(--ac-surface)); color: var(--ac-danger); }
    .empty, .loading { color: var(--ac-muted); }
    @media (max-width: 1180px) { .workspace-grid, .stat-grid, .field-grid { grid-template-columns: 1fr; } .channel-grid, .tenant-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 720px) { .page-head { flex-direction: column; } .type-row, .channel-grid, .tenant-picker, .form-grid { grid-template-columns: 1fr; } }
  `]
})
export class NotificationCenterPageComponent implements OnInit {
  private readonly notificationService = inject(NotificationCenterService);
  private readonly toast = inject(ToastService);

  protected readonly snapshot = signal<NotificationCenterSnapshot | null>(null);
  protected readonly selectedTemplateId = signal<string | null>(null);
  protected readonly selectedTemplate = computed(() => this.snapshot()?.templates.find(template => template.templateId === this.selectedTemplateId()) ?? null);

  protected readonly notificationTypes = [
    { code: 'ApplicationUpdate', label: 'Application Updates', icon: 'system_update_alt' },
    { code: 'Maintenance', label: 'Maintenance', icon: 'engineering' },
    { code: 'RenewalReminder', label: 'Renewal Reminder', icon: 'autorenew' }
  ];
  protected readonly channels = [
    { code: 'Email', label: 'Email', icon: 'mail' },
    { code: 'SMS', label: 'SMS', icon: 'sms' },
    { code: 'Push', label: 'Push', icon: 'notifications_active' },
    { code: 'WhatsApp', label: 'WhatsApp', icon: 'chat' }
  ];
  protected readonly audiences = [
    { code: 'AllHospitals', label: 'All Hospitals' },
    { code: 'SelectedHospitals', label: 'Selected Hospitals' },
    { code: 'TrialHospitals', label: 'Trial Hospitals' },
    { code: 'ExpiredHospitals', label: 'Expired Hospitals' }
  ];

  protected sendForm = this.defaultSendForm();
  protected templateForm = this.defaultTemplateForm();

  ngOnInit(): void {
    void this.load();
  }

  protected audienceOptions() {
    return this.audiences.map(audience => ({ label: audience.label, value: audience.code }));
  }

  protected notificationTypeOptions() {
    return this.notificationTypes.map(type => ({ label: type.label, value: type.code }));
  }

  protected channelOptions() {
    return this.channels.map(channel => ({ label: channel.label, value: channel.code }));
  }

  protected async load(): Promise<void> {
    const response = await this.notificationService.getSnapshot();
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load notification center');
      return;
    }

    this.snapshot.set(response.data);
    if (!this.selectedTemplateId() && response.data.templates.length > 0) {
      this.selectTemplate(response.data.templates[0]);
    }
  }

  protected toggleChannel(channel: string): void {
    this.sendForm.channels = this.sendForm.channels.includes(channel)
      ? this.sendForm.channels.filter(item => item !== channel)
      : [...this.sendForm.channels, channel];
  }

  protected toggleTenant(tenantCode: string): void {
    this.sendForm.tenantCodes = this.sendForm.tenantCodes.includes(tenantCode)
      ? this.sendForm.tenantCodes.filter(item => item !== tenantCode)
      : [...this.sendForm.tenantCodes, tenantCode];
  }

  protected async send(): Promise<void> {
    if (!this.sendForm.title.trim() || !this.sendForm.message.trim()) {
      this.toast.error('Title and message are required.');
      return;
    }

    if (this.sendForm.channels.length === 0) {
      this.toast.error('Select at least one channel.');
      return;
    }

    if (this.sendForm.audience === 'SelectedHospitals' && this.sendForm.tenantCodes.length === 0) {
      this.toast.error('Select at least one hospital.');
      return;
    }

    const response = await this.notificationService.send({
      ...this.sendForm,
      scheduledAt: this.sendForm.scheduledAt ? new Date(this.sendForm.scheduledAt).toISOString() : null
    });
    this.handleSnapshot(response, this.sendForm.scheduledAt ? 'Notification scheduled.' : 'Notification sent.');
    if (response.success) {
      this.resetSendForm();
    }
  }

  protected selectTemplate(template: NotificationTemplateItem): void {
    this.selectedTemplateId.set(template.templateId);
    this.templateForm = {
      templateCode: template.templateCode,
      notificationType: template.notificationType,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      isActive: template.isActive
    };
  }

  protected async saveTemplate(): Promise<void> {
    if (!this.templateForm.templateCode.trim() || !this.templateForm.body.trim()) {
      this.toast.error('Template code and body are required.');
      return;
    }

    const response = await this.notificationService.saveTemplate(this.templateForm);
    this.handleSnapshot(response, 'Notification template saved.');
  }

  protected resetSendForm(): void {
    this.sendForm = this.defaultSendForm();
  }

  protected selectedTenantCount(model: NotificationCenterSnapshot): number {
    if (this.sendForm.audience === 'SelectedHospitals') {
      return this.sendForm.tenantCodes.length;
    }

    if (this.sendForm.audience === 'TrialHospitals') {
      return model.tenants.filter(tenant => tenant.tenantStatus === 'Trial' || tenant.planCode === 'TRIAL').length;
    }

    if (this.sendForm.audience === 'ExpiredHospitals') {
      return model.tenants.filter(tenant => tenant.tenantStatus === 'Expired').length;
    }

    return model.tenants.length;
  }

  protected typeLabel(type: string): string {
    return this.notificationTypes.find(item => item.code === type)?.label ?? type;
  }

  protected audienceLabel(audience: string): string {
    return this.audiences.find(item => item.code === audience)?.label ?? audience;
  }

  protected statusClass(status: string): string {
    return status.toLowerCase();
  }

  private defaultSendForm() {
    return {
      notificationType: 'ApplicationUpdate',
      title: '',
      message: '',
      channels: ['Email'],
      audience: 'AllHospitals',
      tenantCodes: [] as string[],
      scheduledAt: ''
    };
  }

  private defaultTemplateForm() {
    return {
      templateCode: '',
      notificationType: 'ApplicationUpdate',
      channel: 'Email',
      subject: '',
      body: '',
      isActive: true
    };
  }

  private handleSnapshot(response: { success: boolean; data: NotificationCenterSnapshot | null; message?: string }, successMessage: string): void {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Notification action failed');
      return;
    }

    this.snapshot.set(response.data);
    this.toast.success(successMessage);
  }
}
