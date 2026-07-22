import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { SuperAdminDashboard, SuperAdminDashboardSummary } from './super-admin-dashboard.models';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

interface KpiCard {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: string;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="super-admin-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Auspira Control Plane</p>
          <h1 class="ac-page-title">Super Admin Platform</h1>
          <p>Manage hospitals, platform access, settings, audit, health, billing signals, and rollout readiness from one place.</p>
        </div>
        <button class="icon-btn" type="button" (click)="load()" title="Refresh dashboard">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </header>

      @if (dashboard(); as model) {
        <section class="kpi-grid">
          @for (card of createCards(model.summary); track card.label) {
            <article class="metric" [style.--tone]="card.tone">
              <span class="material-symbols-rounded">{{ card.icon }}</span>
              <p>{{ card.label }}</p>
              <strong>{{ card.value }}</strong>
              <small>{{ card.detail }}</small>
            </article>
          }
        </section>

        <section class="control-grid">
          <article class="panel tenant-panel">
            <div class="section-head">
              <div>
                <h2>Tenant Management</h2>
                <p>Hospital lifecycle across active, trial, expired, suspended, and inactive states.</p>
              </div>
              <span class="badge">{{ model.summary.totalHospitals }} hospitals</span>
            </div>
            <div class="status-bars">
              @for (item of model.tenantStatusBreakdown; track item.statusCode) {
                <div class="status-row">
                  <span>{{ item.statusCode }}</span>
                  <div class="bar"><div [style.width.%]="statusWidth(item.count, model)"></div></div>
                  <strong>{{ item.count }}</strong>
                </div>
              } @empty {
                <p class="empty">No hospitals have been registered yet.</p>
              }
            </div>
          </article>

          <article class="panel">
            <div class="section-head">
              <div>
                <h2>Database & Server Health</h2>
                <p>Master metadata, tenant database registry, and platform session readiness.</p>
              </div>
            </div>
            <div class="health-list">
              @for (item of model.health; track item.componentCode) {
                <div class="health-row">
                  <span class="health-dot" [class.warning]="item.statusCode !== 'HEALTHY'"></span>
                  <div>
                    <strong>{{ item.componentCode }}</strong>
                    <p>{{ item.message }}</p>
                  </div>
                  <span class="status-pill" [class.warning]="item.statusCode !== 'HEALTHY'">{{ item.statusCode }}</span>
                </div>
              }
            </div>
          </article>
        </section>

        <section class="lower-grid">
          <article class="panel">
            <div class="section-head">
              <div>
                <h2>Recent Activity</h2>
                <p>Newest control-plane and hospital registration events.</p>
              </div>
            </div>
            <div class="activity-list">
              @for (item of model.recentActivity; track item.activityType + item.createdAt + item.title) {
                <div class="activity-row">
                  <span class="material-symbols-rounded">{{ activityIcon(item.activityType) }}</span>
                  <div>
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.description }}</p>
                  </div>
                  <time>{{ item.createdAt | date:'short' }}</time>
                </div>
              } @empty {
                <p class="empty">No platform activity yet.</p>
              }
            </div>
          </article>

          <article class="panel alerts-panel">
            <div class="section-head">
              <div>
                <h2>Alerts</h2>
                <p>Tenants with expired, suspended, or inactive platform status.</p>
              </div>
              <span class="badge danger">{{ model.summary.openAlerts }}</span>
            </div>
            <div class="alert-list">
              @for (alert of model.alerts; track alert.title + alert.createdAt) {
                <div class="alert-row" [class.critical]="alert.severityCode === 'CRITICAL'">
                  <span>{{ alert.severityCode }}</span>
                  <div>
                    <strong>{{ alert.title }}</strong>
                    <p>{{ alert.description }}</p>
                  </div>
                </div>
              } @empty {
                <p class="empty">No open platform alerts.</p>
              }
            </div>
          </article>
        </section>

        <section class="module-grid">
          @for (module of modules; track module.label) {
            <article class="module-tile">
              <span class="material-symbols-rounded">{{ module.icon }}</span>
              <strong>{{ module.label }}</strong>
              <p>{{ module.detail }}</p>
            </article>
          }
        </section>

        <footer class="generated">Generated at {{ model.summary.generatedAt | date:'medium' }}</footer>
      } @else {
        <section class="panel loading">Loading control plane...</section>
      }
    </section>
  `,
  styles: `
    .super-admin-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .page-head p:not(.eyebrow), .section-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; max-width: 900px; }
    .eyebrow { margin: 0 0 4px; color: var(--ac-primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .icon-btn { width: 38px; height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); display: inline-grid; place-items: center; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .metric, .panel, .module-tile { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); }
    .metric { min-height: 128px; padding: 14px; border-top: 3px solid var(--tone); display: flex; flex-direction: column; gap: 5px; }
    .metric > span { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent); }
    .metric p { margin: 4px 0 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .metric strong { font-size: 24px; line-height: 1.1; }
    .metric small { color: var(--ac-muted); font-size: 12px; }
    .control-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr); gap: 16px; }
    .lower-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(340px, .85fr); gap: 16px; }
    .panel { padding: 16px; min-width: 0; }
    .section-head h2 { margin: 0; font-size: 16px; }
    .badge { align-self: flex-start; padding: 5px 9px; border-radius: 999px; background: var(--ac-primary-light); color: var(--ac-primary); font-size: 11px; font-weight: 800; white-space: nowrap; }
    .badge.danger { background: var(--ac-error-light); color: var(--ac-error); }
    .status-bars, .health-list, .activity-list, .alert-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
    .status-row { display: grid; grid-template-columns: 110px 1fr 44px; align-items: center; gap: 10px; font-size: 13px; }
    .status-row span { color: var(--ac-text-2); font-weight: 700; }
    .bar { height: 10px; border-radius: 999px; background: var(--ac-bg); overflow: hidden; }
    .bar div { height: 100%; border-radius: inherit; background: #0f766e; }
    .health-row, .activity-row, .alert-row { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--ac-border); border-radius: 8px; }
    .health-row p, .activity-row p, .alert-row p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .health-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--ac-success); flex: 0 0 auto; }
    .health-dot.warning { background: var(--ac-warning); }
    .status-pill { margin-left: auto; padding: 4px 8px; border-radius: 999px; background: var(--ac-success-light); color: var(--ac-success-text); font-size: 11px; font-weight: 800; }
    .status-pill.warning { background: var(--ac-warning-light); color: var(--ac-warning-text); }
    .activity-row > span { color: var(--ac-primary); }
    .activity-row time { margin-left: auto; color: var(--ac-muted); font-size: 12px; white-space: nowrap; }
    .alert-row > span { align-self: flex-start; padding: 4px 8px; border-radius: 6px; background: var(--ac-warning-light); color: var(--ac-warning-text); font-size: 10px; font-weight: 900; }
    .alert-row.critical > span { background: var(--ac-error-light); color: var(--ac-error); }
    .module-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .module-tile { min-height: 118px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
    .module-tile span { color: var(--ac-primary); }
    .module-tile p { color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
    .empty, .generated, .loading { color: var(--ac-muted); font-size: 13px; }
    .generated { text-align: right; }
    @media (max-width: 1280px) { .kpi-grid, .module-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .control-grid, .lower-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .kpi-grid, .module-grid { grid-template-columns: 1fr; } .page-head, .section-head { flex-direction: column; } .status-row { grid-template-columns: 1fr; } .activity-row { align-items: flex-start; } .activity-row time { margin-left: 0; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuperAdminDashboardPageComponent implements OnInit {
  protected readonly dashboard = signal<SuperAdminDashboard | null>(null);
  protected readonly modules = [
    { label: 'Tenant Management', icon: 'corporate_fare', detail: 'Onboard, suspend, archive, and inspect hospitals.' },
    { label: 'Plans', icon: 'workspace_premium', detail: 'Package limits, features, and commercial tiers.' },
    { label: 'Features', icon: 'toggle_on', detail: 'Global and tenant-level feature controls.' },
    { label: 'Subscriptions', icon: 'autorenew', detail: 'Plan state, renewals, trials, and expiry.' },
    { label: 'Billing', icon: 'payments', detail: 'Revenue, invoices, credits, and payment signals.' },
    { label: 'Database Management', icon: 'database', detail: 'Tenant databases, versions, backups, and capacity.' },
    { label: 'Users', icon: 'manage_accounts', detail: 'Auspira platform operators and support staff.' },
    { label: 'Roles', icon: 'admin_panel_settings', detail: 'RBAC for super admin operations.' },
    { label: 'Support', icon: 'support_agent', detail: 'Hospital tickets, escalations, and incidents.' },
    { label: 'Audit', icon: 'history', detail: 'Control-plane audit trail and access history.' },
    { label: 'Notifications', icon: 'notifications', detail: 'Global announcements and operational alerts.' },
    { label: 'Deployments', icon: 'rocket_launch', detail: 'Rollouts, migrations, and tenant provisioning.' },
    { label: 'Monitoring', icon: 'monitoring', detail: 'Application, database, and infrastructure health.' },
    { label: 'Settings', icon: 'settings', detail: 'Global configuration for the Care360 platform.' }
  ];

  private readonly service = inject(SuperAdminDashboardService);
  private readonly toast = inject(ToastService);
  protected readonly hasAlerts = computed(() => (this.dashboard()?.summary.openAlerts ?? 0) > 0);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    const response = await this.service.getDashboard();
    if (response.success && response.data) {
      this.dashboard.set(response.data);
      return;
    }

    this.toast.error(response.message || 'Could not load Super Admin dashboard');
  }

  protected createCards(summary: SuperAdminDashboardSummary): KpiCard[] {
    return [
      { label: 'Hospitals', value: formatNumber(summary.totalHospitals), detail: `${formatNumber(summary.newRegistrationsThisMonth)} new this month`, icon: 'local_hospital', tone: '#2563eb' },
      { label: 'Active', value: formatNumber(summary.activeHospitals), detail: 'Live platform tenants', icon: 'verified', tone: '#0f766e' },
      { label: 'Trial', value: formatNumber(summary.trialHospitals), detail: 'Evaluation hospitals', icon: 'hourglass_top', tone: '#d97706' },
      { label: 'Expired', value: formatNumber(summary.expiredHospitals), detail: 'Needs renewal action', icon: 'event_busy', tone: '#be123c' },
      { label: 'Revenue', value: formatCurrency(summary.monthlyRecurringRevenue), detail: 'Configured monthly recurring revenue', icon: 'payments', tone: '#7c3aed' },
      { label: 'Database Health', value: summary.databaseHealthStatusCode, detail: 'Master and tenant registry', icon: 'database', tone: statusTone(summary.databaseHealthStatusCode) },
      { label: 'Server Health', value: summary.serverHealthStatusCode, detail: 'API health signal', icon: 'dns', tone: statusTone(summary.serverHealthStatusCode) },
      { label: 'Sessions', value: formatNumber(summary.activePlatformSessions), detail: 'Active platform operator sessions', icon: 'passkey', tone: '#0891b2' },
      { label: 'Alerts', value: formatNumber(summary.openAlerts), detail: this.hasAlerts() ? 'Requires attention' : 'No open alerts', icon: 'warning', tone: statusTone(summary.openAlerts ? 'WARNING' : 'HEALTHY') }
    ];
  }

  protected statusWidth(value: number, model: SuperAdminDashboard): number {
    const max = Math.max(...model.tenantStatusBreakdown.map(item => item.count), 1);
    return Math.max(6, Math.round((value / max) * 100));
  }

  protected activityIcon(type: string): string {
    return type === 'TENANT' ? 'corporate_fare' : 'history';
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function statusTone(statusCode: string): string {
  return statusCode === 'HEALTHY' ? '#0f766e' : '#d97706';
}
