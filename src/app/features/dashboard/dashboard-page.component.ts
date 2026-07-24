import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { getUserRoleLabel, isHospitalAdminUser } from '../../core/auth/user-access';
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

interface StaffCard {
  label: string;
  value: string;
  subLabel: string;
  icon: string;
  tone: string;
}

interface StaffAction {
  label: string;
  path: string;
  icon: string;
  tone: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="admin-dashboard">
      <header class="dashboard-hero" [class.staff-hero]="!isHospitalAdmin()">
        <div class="hero-copy">
          <span class="eyebrow">{{ isHospitalAdmin() ? 'Control center' : 'My workspace' }}</span>
          <h1 class="ac-page-title">{{ isHospitalAdmin() ? t('Administration.Dashboard.Title') : 'Welcome, ' + displayName() }}</h1>
          <p>{{ isHospitalAdmin() ? t('Administration.Dashboard.Subtitle') : 'A focused dashboard for your daily work, assigned modules, account activity, and hospital context.' }}</p>
          <div class="hero-tags">
            <span><span class="material-symbols-rounded">badge</span>{{ roleLabel() }}</span>
            <span><span class="material-symbols-rounded">domain</span>Care360 Hospital</span>
          </div>
        </div>
        <div class="hero-panel">
          <span class="material-symbols-rounded">{{ isHospitalAdmin() ? 'admin_panel_settings' : 'workspaces' }}</span>
          <strong>{{ isHospitalAdmin() ? 'Admin view' : 'Staff view' }}</strong>
          <p>{{ isHospitalAdmin() ? 'Live operational health and access metrics.' : 'Only your relevant work tools and account signals.' }}</p>
          <button class="icon-btn" type="button" (click)="load()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (dashboard(); as model) {
        @if (isHospitalAdmin()) {
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
                      <p>{{ login.email }} - {{ login.loginDate | date: 'short' }}</p>
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
                    <span>{{ t('Administration.SystemConfiguration.Channel.' + item.channelCode) }} - {{ item.languageCode }}</span>
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
        } @else {
          <section class="staff-kpi-grid">
            @for (card of createStaffCards(model.summary); track card.label) {
              <article class="metric-card staff-card" [style.--tone]="card.tone">
                <div class="metric-icon"><span class="material-symbols-rounded">{{ card.icon }}</span></div>
                <div>
                  <p class="metric-label">{{ card.label }}</p>
                  <strong>{{ card.value }}</strong>
                  <span>{{ card.subLabel }}</span>
                </div>
              </article>
            }
          </section>

          <section class="staff-grid">
            <article class="panel quick-panel">
              <div class="section-head">
                <h2>Start next task</h2>
                <span>{{ staffActions().length }} available</span>
              </div>
              <div class="quick-actions">
                @for (action of staffActions(); track action.path) {
                  <a [routerLink]="action.path" class="quick-action" [style.--tone]="action.tone">
                    <span class="material-symbols-rounded">{{ action.icon }}</span>
                    <strong>{{ action.label }}</strong>
                  </a>
                } @empty {
                  <p class="empty">No workspace modules are assigned yet.</p>
                }
              </div>
            </article>

            <article class="panel focus-panel">
              <div class="section-head">
                <h2>My access</h2>
                <span>{{ roleLabel() }}</span>
              </div>
              <div class="access-cloud">
                @for (module of accessModules(); track module) {
                  <span>{{ module }}</span>
                }
              </div>
            </article>

            <article class="panel">
              <div class="section-head">
                <h2>Account activity</h2>
                <span>Recent sign-ins</span>
              </div>
              <div class="login-list">
                @for (login of myRecentLogins(model); track login.email + login.loginDate) {
                  <div class="login-row">
                    <span class="login-state" [class.failed]="!login.wasSuccessful">{{ t(login.wasSuccessful ? 'Administration.Dashboard.Labels.Success' : 'Administration.Dashboard.Labels.Failed') }}</span>
                    <div>
                      <strong>{{ login.displayName }}</strong>
                      <p>{{ login.loginDate | date: 'medium' }}</p>
                    </div>
                  </div>
                } @empty {
                  <p class="empty">No recent activity for this account.</p>
                }
              </div>
            </article>

            <article class="panel staff-health">
              <div class="section-head">
                <h2>Hospital readiness</h2>
                <span class="status" [class.warning]="model.summary.systemHealthStatusCode !== 'HEALTHY'">
                  {{ t('Administration.Dashboard.Health.' + model.summary.systemHealthStatusCode) }}
                </span>
              </div>
              <div class="readiness-ring">
                <span class="material-symbols-rounded">health_and_safety</span>
                <strong>{{ readinessScore(model) }}%</strong>
                <p>Workspace readiness</p>
              </div>
              <div class="mini-health">
                @for (item of model.systemHealth.slice(0, 3); track item.componentCode) {
                  <div><span class="dot" [class.warning]="item.statusCode !== 'HEALTHY'"></span>{{ item.componentCode }}</div>
                }
              </div>
            </article>
          </section>
        }

        <footer class="generated">
          {{ t('Administration.Dashboard.Labels.GeneratedAt') }}: {{ model.summary.generatedAt | date: 'medium' }}
        </footer>
      }
    </section>
  `,
  styles: `
    .admin-dashboard { display: flex; flex-direction: column; gap: 16px; }
    .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .dashboard-hero { min-height: 190px; display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 18px; align-items: stretch; padding: 22px; border: 1px solid var(--ac-border); border-radius: 8px; background: linear-gradient(135deg, rgba(37,99,235,.1), rgba(20,184,166,.08) 55%, rgba(249,115,22,.08)); box-shadow: var(--ac-shadow-soft); overflow: hidden; position: relative; }
    .dashboard-hero.staff-hero { background: linear-gradient(135deg, rgba(20,184,166,.12), rgba(37,99,235,.08) 52%, rgba(217,119,6,.1)); }
    .hero-copy { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
    .eyebrow { color: #0f766e; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .dashboard-hero p { margin: 6px 0 0; color: var(--ac-text-2); font-size: 14px; max-width: 880px; line-height: 1.55; }
    .hero-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .hero-tags span { min-height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--ac-border); border-radius: 999px; background: rgba(255,255,255,.68); color: var(--ac-text); font-size: 12px; font-weight: 800; }
    .hero-tags .material-symbols-rounded { font-size: 17px; color: #2563eb; }
    .hero-panel { border: 1px solid rgba(255,255,255,.8); background: rgba(255,255,255,.72); border-radius: 8px; padding: 16px; display: grid; align-content: center; gap: 7px; box-shadow: 0 18px 38px rgba(15,23,42,.08); }
    .hero-panel > .material-symbols-rounded { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 8px; color: #2563eb; background: rgba(37,99,235,.12); }
    .hero-panel strong { font-size: 18px; }
    .hero-panel p { margin: 0; font-size: 12px; color: var(--ac-muted); }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .kpi-grid, .staff-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    .staff-kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .metric-card, .panel { border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    .metric-card { min-height: 116px; display: flex; gap: 12px; padding: 14px; border-top: 3px solid var(--tone); box-shadow: 0 12px 28px rgba(15,23,42,.04); }
    .metric-card.staff-card { min-height: 126px; }
    .metric-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 8px; color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent); flex: 0 0 auto; }
    .metric-label { margin: 0 0 6px; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .metric-card strong { display: block; font-size: 24px; line-height: 1.1; }
    .metric-card span { color: var(--ac-muted); font-size: 12px; }
    .main-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(360px, .7fr); gap: 16px; }
    .lower-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(320px, .7fr); gap: 16px; }
    .staff-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(300px, .8fr); gap: 16px; align-items: start; }
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
    .quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .quick-action { min-height: 74px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px; background: color-mix(in srgb, var(--tone) 7%, var(--ac-surface)); color: var(--ac-text); text-decoration: none; display: grid; grid-template-columns: 34px 1fr; align-items: center; gap: 10px; transition: transform .16s ease, border-color .16s ease; }
    .quick-action:hover { transform: translateY(-2px); border-color: var(--tone); }
    .quick-action .material-symbols-rounded { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; color: var(--tone); background: color-mix(in srgb, var(--tone) 13%, transparent); }
    .access-cloud { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .access-cloud span { min-height: 30px; display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px; background: var(--ac-subtle); border: 1px solid var(--ac-border); color: var(--ac-text-2); font-weight: 800; font-size: 12px; }
    .readiness-ring { min-height: 180px; display: grid; place-items: center; align-content: center; gap: 6px; margin-top: 14px; border-radius: 8px; background: radial-gradient(circle, rgba(20,184,166,.18), rgba(37,99,235,.08) 56%, transparent 57%), var(--ac-subtle); }
    .readiness-ring .material-symbols-rounded { color: #0f766e; font-size: 34px; }
    .readiness-ring strong { font-size: 34px; line-height: 1; }
    .readiness-ring p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .mini-health { display: grid; gap: 8px; margin-top: 12px; }
    .mini-health div { display: flex; align-items: center; gap: 8px; color: var(--ac-text-2); font-size: 13px; font-weight: 800; }
    .generated { color: var(--ac-muted); font-size: 12px; text-align: right; }
    @media (max-width: 1280px) { .kpi-grid, .staff-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .main-grid, .lower-grid, .staff-grid { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .dashboard-hero { grid-template-columns: 1fr; } .kpi-grid, .staff-kpi-grid, .quick-actions { grid-template-columns: 1fr; } .section-head { flex-direction: column; } .bar-row { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements OnInit {
  protected readonly dashboard = signal<AdministrationDashboard | null>(null);

  private readonly service = inject(AdministrationDashboardService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly authStore = inject(AuthStore);

  protected readonly isHospitalAdmin = computed(() => isHospitalAdminUser(this.authStore.session()));
  protected readonly roleLabel = computed(() => getUserRoleLabel(this.authStore.session()));
  protected readonly displayName = computed(() => this.authStore.session()?.fullName?.trim() || 'User');
  protected readonly staffActions = computed(() => createStaffActions(this.authStore.permissions()));
  protected readonly accessModules = computed(() => createAccessModules(this.authStore.permissions()));

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

  protected createStaffCards(summary: AdministrationDashboardSummary): StaffCard[] {
    return [
      { label: 'Team online', value: formatNumber(summary.activeUsers), subLabel: 'active users today', icon: 'groups', tone: '#0f766e' },
      { label: 'Active sessions', value: formatNumber(summary.activeSessions), subLabel: 'current secure sessions', icon: 'passkey', tone: '#2563eb' },
      { label: 'Branch context', value: formatNumber(summary.branchCount), subLabel: 'available hospital branches', icon: 'account_tree', tone: '#7c3aed' },
      { label: 'Departments', value: formatNumber(summary.departmentCount), subLabel: 'care teams configured', icon: 'business', tone: '#d97706' }
    ];
  }

  protected myRecentLogins(model: AdministrationDashboard) {
    const email = this.authStore.session()?.email?.toLowerCase();
    const matches = email ? model.recentLogins.filter(login => login.email.toLowerCase() === email) : [];
    return (matches.length > 0 ? matches : model.recentLogins).slice(0, 4);
  }

  protected readinessScore(model: AdministrationDashboard): number {
    if (model.systemHealth.length === 0) {
      return model.summary.systemHealthStatusCode === 'HEALTHY' ? 100 : 72;
    }

    const healthy = model.systemHealth.filter(item => item.statusCode === 'HEALTHY').length;
    return Math.round((healthy / model.systemHealth.length) * 100);
  }

  protected barWidth(value: number, items: { eventCount: number }[]): number {
    const max = Math.max(...items.map(item => item.eventCount), 1);
    return Math.max(6, Math.round((value / max) * 100));
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function createStaffActions(permissions: string[]): StaffAction[] {
  const available = [
    { prefix: 'Clinical.Patients.', label: 'Patients', path: '/patients', icon: 'people', tone: '#2563eb' },
    { prefix: 'Clinical.Appointments.', label: 'Appointments', path: '/appointments', icon: 'event', tone: '#7c3aed' },
    { prefix: 'Clinical.OPD.', label: 'OPD', path: '/opd', icon: 'local_hospital', tone: '#0f766e' },
    { prefix: 'Clinical.Doctors.', label: 'Doctors', path: '/doctors', icon: 'medical_services', tone: '#0891b2' },
    { prefix: 'Operations.Laboratory.', label: 'Laboratory', path: '/laboratory', icon: 'biotech', tone: '#be123c' },
    { prefix: 'Operations.Pharmacy.', label: 'Pharmacy', path: '/pharmacy', icon: 'medication', tone: '#16a34a' },
    { prefix: 'Operations.Billing.', label: 'Billing', path: '/billing', icon: 'receipt_long', tone: '#d97706' },
    { prefix: 'Operations.Inventory.', label: 'Inventory', path: '/inventory', icon: 'inventory_2', tone: '#475569' }
  ];

  const actions = available.filter(action => permissions.some(permission => permission.startsWith(action.prefix)));
  return actions.length > 0 ? actions.slice(0, 6) : [
    { label: 'My Profile', path: '/profile', icon: 'account_circle', tone: '#2563eb' }
  ];
}

function createAccessModules(permissions: string[]): string[] {
  const modules = [
    { prefix: 'Clinical.', label: 'Clinical' },
    { prefix: 'Operations.', label: 'Operations' },
    { prefix: 'Administration.', label: 'Administration' },
    { prefix: 'Reports.', label: 'Reports' },
    { prefix: 'Billing.', label: 'Billing' },
    { prefix: 'Inventory.', label: 'Inventory' }
  ];

  const matches = modules
    .filter(module => permissions.some(permission => permission.startsWith(module.prefix)))
    .map(module => module.label);

  return matches.length > 0 ? matches : ['Profile'];
}
