import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AdministrationDashboard, AdministrationDashboardSummary } from './administration-dashboard.models';
import { AdministrationDashboardService } from './administration-dashboard.service';

interface DashboardCard {
  labelKey: string;
  value: string;
  subKey: string;
  icon: string;
  tone: string;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="admin-dashboard">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Dashboard.Title') }}</h1>
          <p>{{ t('Administration.Dashboard.Subtitle') }}</p>
        </div>
        <button class="icon-btn" type="button" (click)="load()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </header>

      @if (dashboard(); as model) {
        <section class="kpi-grid">
          @for (card of createCards(model.summary); track card.labelKey) {
            <article class="metric-card" [style.--tone]="card.tone">
              <div class="metric-icon"><span class="material-symbols-rounded">{{ card.icon }}</span></div>
              <div>
                <p class="metric-label">{{ t(card.labelKey) }}</p>
                <strong>{{ card.value }}</strong>
                <span>{{ t(card.subKey) }}</span>
              </div>
            </article>
          }
        </section>

        <section class="main-grid">
          <article class="panel chart-panel">
            <div class="section-head">
              <h2>{{ t('Administration.Dashboard.Widgets.AuditSummary') }}</h2>
              <span>{{ t('Administration.Dashboard.Labels.LastSevenDays') }}</span>
            </div>
            <div class="bar-list">
              @for (item of model.auditSummary; track item.actionCode) {
                <div class="bar-row">
                  <span>{{ item.actionCode }}</span>
                  <div class="bar-track"><div class="bar-fill" [style.width.%]="barWidth(item.eventCount, model.auditSummary)"></div></div>
                  <strong>{{ item.eventCount }}</strong>
                </div>
              } @empty {
                <p class="empty">{{ t('Administration.Dashboard.Labels.NoData') }}</p>
              }
            </div>
          </article>

          <article class="panel">
            <div class="section-head">
              <h2>{{ t('Administration.Dashboard.Widgets.SystemHealth') }}</h2>
              <span class="status" [class.warning]="model.summary.systemHealthStatusCode !== 'HEALTHY'">
                {{ t('Administration.Dashboard.Health.' + model.summary.systemHealthStatusCode) }}
              </span>
            </div>
            <div class="health-list">
              @for (item of model.systemHealth; track item.componentCode) {
                <div class="health-row">
                  <span class="dot" [class.warning]="item.statusCode !== 'HEALTHY'"></span>
                  <div>
                    <strong>{{ item.componentCode }}</strong>
                    <p>{{ t(item.messageKey) }}</p>
                  </div>
                  <span class="status" [class.warning]="item.statusCode !== 'HEALTHY'">{{ t('Administration.Dashboard.Health.' + item.statusCode) }}</span>
                </div>
              }
            </div>
          </article>
        </section>

        <section class="lower-grid">
          <article class="panel">
            <div class="section-head">
              <h2>{{ t('Administration.Dashboard.Widgets.RecentLogins') }}</h2>
              <span>{{ model.summary.loginsToday }} {{ t('Administration.Dashboard.Labels.Today') }}</span>
            </div>
            <div class="login-list">
              @for (login of model.recentLogins; track login.email + login.loginDate) {
                <div class="login-row">
                  <span class="login-state" [class.failed]="!login.wasSuccessful">{{ t(login.wasSuccessful ? 'Administration.Dashboard.Labels.Success' : 'Administration.Dashboard.Labels.Failed') }}</span>
                  <div>
                    <strong>{{ login.displayName }}</strong>
                    <p>{{ login.email }} · {{ login.loginDate | date: 'short' }}</p>
                  </div>
                </div>
              } @empty {
                <p class="empty">{{ t('Administration.Dashboard.Labels.NoData') }}</p>
              }
            </div>
          </article>

          <article class="panel">
            <div class="section-head">
              <h2>{{ t('Administration.Dashboard.Widgets.Notifications') }}</h2>
              <span>{{ model.summary.notificationTemplateCount }} {{ t('Administration.Dashboard.Labels.TemplatesConfigured') }}</span>
            </div>
            <div class="template-list">
              @for (item of model.notifications; track item.templateCode + item.channelCode + item.languageCode) {
                <div class="template-row">
                  <strong>{{ item.templateCode }}</strong>
                  <span>{{ t('Administration.SystemConfiguration.Channel.' + item.channelCode) }} · {{ item.languageCode }}</span>
                </div>
              } @empty {
                <p class="empty">{{ t('Administration.Dashboard.Labels.NoData') }}</p>
              }
            </div>
          </article>

          <article class="panel status-panel">
            <div class="status-block">
              <span class="material-symbols-rounded">verified</span>
              <p>{{ t('Administration.Dashboard.Widgets.LicenseStatus') }}</p>
              <strong>{{ t('Administration.Dashboard.License.' + model.summary.licenseStatusCode) }}</strong>
            </div>
            <div class="status-block">
              <span class="material-symbols-rounded">workspace_premium</span>
              <p>{{ t('Administration.Dashboard.Widgets.SubscriptionStatus') }}</p>
              <strong>{{ t('Hospital.Subscription.Status.' + model.summary.subscriptionStatusCode) }}</strong>
            </div>
            <div class="status-block">
              <span class="material-symbols-rounded">database</span>
              <p>{{ t('Administration.Dashboard.Widgets.StorageUsage') }}</p>
              <strong>{{ model.summary.storedProfileImageCount }}</strong>
              <small>{{ t('Administration.Dashboard.Labels.ProfileImages') }}</small>
            </div>
          </article>
        </section>

        <footer class="generated">
          {{ t('Administration.Dashboard.Labels.GeneratedAt') }}: {{ model.summary.generatedAt | date: 'medium' }}
        </footer>
      }
    </section>
  `,
  styles: `
    .admin-dashboard { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; max-width: 880px; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    .metric-card, .panel { border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    .metric-card { min-height: 116px; display: flex; gap: 12px; padding: 14px; border-top: 3px solid var(--tone); }
    .metric-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 8px; color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent); flex: 0 0 auto; }
    .metric-label { margin: 0 0 6px; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .metric-card strong { display: block; font-size: 24px; line-height: 1.1; }
    .metric-card span { color: var(--ac-muted); font-size: 12px; }
    .main-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(360px, .7fr); gap: 16px; }
    .lower-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(320px, .7fr); gap: 16px; }
    .panel { padding: 16px; min-width: 0; }
    .section-head h2 { margin: 0; font-size: 16px; }
    .section-head span { color: var(--ac-muted); font-size: 12px; font-weight: 700; }
    .bar-list, .health-list, .login-list, .template-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
    .bar-row { display: grid; grid-template-columns: 120px 1fr 48px; gap: 10px; align-items: center; font-size: 13px; }
    .bar-track { height: 10px; border-radius: 999px; background: var(--ac-bg); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: inherit; background: #2563eb; }
    .health-row, .login-row, .template-row { display: flex; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--ac-border); border-radius: 8px; }
    .health-row p, .login-row p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #16a34a; flex: 0 0 auto; }
    .dot.warning { background: #d97706; }
    .status, .login-state { margin-left: auto; padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .status.warning, .login-state.failed { background: rgba(217,119,6,.12); color: #b45309; }
    .template-row { justify-content: space-between; }
    .template-row span { color: var(--ac-muted); font-size: 12px; }
    .status-panel { display: grid; gap: 10px; }
    .status-block { padding: 12px; border: 1px solid var(--ac-border); border-radius: 8px; display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; }
    .status-block span { color: #2563eb; }
    .status-block p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .status-block small { grid-column: 2 / -1; color: var(--ac-muted); }
    .empty { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .generated { color: var(--ac-muted); font-size: 12px; text-align: right; }
    @media (max-width: 1280px) { .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .main-grid, .lower-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .kpi-grid { grid-template-columns: 1fr; } .page-head, .section-head { flex-direction: column; } .bar-row { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements OnInit {
  protected readonly dashboard = signal<AdministrationDashboard | null>(null);

  private readonly service = inject(AdministrationDashboardService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> { await this.load(); }
  protected t(key: string): string { return this.i18n.translate(key); }

  protected async load(): Promise<void> {
    const response = await this.service.getDashboard();
    response.success && response.data ? this.dashboard.set(response.data) : this.toast.error(this.t(response.message));
  }

  protected createCards(summary: AdministrationDashboardSummary): DashboardCard[] {
    return [
      { labelKey: 'Administration.Dashboard.Widgets.TotalHospitals', value: formatNumber(summary.totalHospitals), subKey: 'Administration.Dashboard.Labels.Today', icon: 'local_hospital', tone: '#2563eb' },
      { labelKey: 'Administration.Dashboard.Widgets.TotalUsers', value: formatNumber(summary.totalUsers), subKey: 'Administration.Dashboard.Labels.Today', icon: 'groups', tone: '#0891b2' },
      { labelKey: 'Administration.Dashboard.Widgets.ActiveUsers', value: formatNumber(summary.activeUsers), subKey: 'Administration.UserManagement.Status.Active', icon: 'person_check', tone: '#16a34a' },
      { labelKey: 'Administration.Dashboard.Widgets.ActiveSessions', value: formatNumber(summary.activeSessions), subKey: 'Navigation.SessionManagement', icon: 'passkey', tone: '#7c3aed' },
      { labelKey: 'Administration.Dashboard.Widgets.BranchCount', value: formatNumber(summary.branchCount), subKey: 'Navigation.BranchManagement', icon: 'account_tree', tone: '#d97706' },
      { labelKey: 'Administration.Dashboard.Widgets.DepartmentCount', value: formatNumber(summary.departmentCount), subKey: 'Navigation.DepartmentManagement', icon: 'business', tone: '#be123c' }
    ];
  }

  protected barWidth(value: number, items: { eventCount: number }[]): number {
    const max = Math.max(...items.map(item => item.eventCount), 1);
    return Math.max(6, Math.round((value / max) * 100));
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
