import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiraChatService } from '../../core/ai/aira-chat.service';
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

interface HospitalPulseItem {
  title: string;
  detail: string;
  region: string;
  tag: string;
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
                <div>
                  <h2>Hospital activity</h2>
                  <p>Simple view of what happened in the workspace.</p>
                </div>
                <span>{{ t('Administration.Dashboard.Labels.LastSevenDays') }}</span>
              </div>
              <div class="bar-list">
                @for (item of model.auditSummary; track item.actionCode) {
                  <div class="bar-row" [style.--tone]="auditTone(item.actionCode)">
                    <span class="audit-name">
                      <span class="audit-icon material-symbols-rounded">{{ auditIcon(item.actionCode) }}</span>
                      <span>
                        <strong>{{ auditLabel(item.actionCode) }}</strong>
                        <small>{{ auditHelp(item.actionCode) }}</small>
                      </span>
                    </span>
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
                <span>{{ model.summary.loginsToday }} {{ t('Administration.Dashboard.Labels.Today') }} · Page {{ loginPage() }} of {{ recentLoginTotalPages(model) }}</span>
              </div>
              <div class="login-list">
                @for (login of pagedRecentLogins(model); track login.email + login.loginDate) {
                  <div class="login-row">
                    <span class="login-state" [class.failed]="!login.wasSuccessful">{{ t(login.wasSuccessful ? 'Administration.Dashboard.Labels.Success' : 'Administration.Dashboard.Labels.Failed') }}</span>
                    <div>
                      <strong>{{ login.displayName }}</strong>
                      <p>{{ login.email }} - {{ login.loginDate | date: 'short' }}</p>
                    </div>
                    <small>{{ login.ipAddress || 'Secure session' }}</small>
                  </div>
                } @empty {
                  <p class="empty">{{ t('Administration.Dashboard.Labels.NoData') }}</p>
                }
              </div>
              <footer class="login-pager">
                <span>Showing {{ recentLoginRange(model) }} of {{ model.recentLogins.length }} logins</span>
                <div>
                  <button class="icon-btn" type="button" (click)="changeLoginPage(-1, model)" [disabled]="loginPage() <= 1" title="Previous logins">
                    <span class="material-symbols-rounded">chevron_left</span>
                  </button>
                  <strong>{{ loginPage() }}</strong>
                  <button class="icon-btn" type="button" (click)="changeLoginPage(1, model)" [disabled]="loginPage() >= recentLoginTotalPages(model)" title="Next logins">
                    <span class="material-symbols-rounded">chevron_right</span>
                  </button>
                </div>
              </footer>
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
                  <div class="notification-empty">
                    <span class="material-symbols-rounded">notifications_active</span>
                    <strong>No templates yet</strong>
                    <p>Prepare SMS, email, and reminder templates so hospital communication can run without manual follow-up.</p>
                    <a routerLink="/administration/system-configuration">Open configuration</a>
                  </div>
                }
              </div>
            </article>

            <article class="panel intelligence-panel">
              <div class="section-head">
                <div>
                  <h2>AIRA operations insights</h2>
                  <p>Auto-refreshing summary from safe aggregate dashboard signals.</p>
                </div>
                <button class="icon-btn" type="button" (click)="refreshAiInsights(model)" [disabled]="aiInsightLoading()" title="Refresh AI insights">
                  <span class="material-symbols-rounded">{{ aiInsightLoading() ? 'progress_activity' : 'auto_awesome' }}</span>
                </button>
              </div>
              <div class="ai-insight-card">
                <span class="ai-orb"><i></i></span>
                <div>
                  <strong>{{ aiInsightTitle() }}</strong>
                  <p>{{ aiInsightText() }}</p>
                  <small>{{ aiInsightStamp() }}</small>
                </div>
              </div>
              <div class="status-stack">
                <div class="status-block compact">
                  <span class="material-symbols-rounded">verified</span>
                  <p>{{ t('Administration.Dashboard.Widgets.LicenseStatus') }}</p>
                  <strong>{{ t('Administration.Dashboard.License.' + model.summary.licenseStatusCode) }}</strong>
                </div>
                <div class="status-block compact">
                  <span class="material-symbols-rounded">workspace_premium</span>
                  <p>{{ t('Administration.Dashboard.Widgets.SubscriptionStatus') }}</p>
                  <strong>{{ t('Hospital.Subscription.Status.' + model.summary.subscriptionStatusCode) }}</strong>
                </div>
                <div class="status-block compact">
                  <span class="material-symbols-rounded">database</span>
                  <p>{{ t('Administration.Dashboard.Widgets.StorageUsage') }}</p>
                  <strong>{{ model.summary.storedProfileImageCount }}</strong>
                </div>
              </div>
              <div class="pulse-card" [style.--tone]="currentPulse().tone">
                <span class="material-symbols-rounded">{{ currentPulse().icon }}</span>
                <div>
                  <small>{{ currentPulse().region }} · {{ currentPulse().tag }}</small>
                  <strong>{{ currentPulse().title }}</strong>
                  <p>{{ currentPulse().detail }}</p>
                </div>
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
    .section-head p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .section-head span { color: var(--ac-muted); font-size: 12px; font-weight: 700; }
    .bar-list, .health-list, .login-list, .template-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
    .bar-row { display: grid; grid-template-columns: minmax(220px, 300px) 1fr 48px; gap: 12px; align-items: center; font-size: 13px; }
    .audit-name { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 10px; min-width: 0; }
    .audit-name strong { display: block; color: var(--ac-text); line-height: 1.15; }
    .audit-name small { display: block; color: var(--ac-muted); font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .audit-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 19px; }
    .bar-track { height: 10px; border-radius: 999px; background: var(--ac-bg); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--tone), color-mix(in srgb, var(--tone) 72%, #ffffff)); }
    .bar-row > strong { justify-self: end; min-width: 34px; padding: 4px 8px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 10%, transparent); color: var(--tone); text-align: center; font-size: 12px; }
    .health-row, .login-row, .template-row { display: flex; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--ac-border); border-radius: 8px; }
    .health-row p, .login-row p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .login-row { min-height: 58px; }
    .login-row > div { min-width: 0; flex: 1; }
    .login-row > small { color: var(--ac-muted); font-size: 11px; white-space: nowrap; }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #16a34a; flex: 0 0 auto; }
    .dot.warning { background: #d97706; }
    .status, .login-state { margin-left: auto; padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .login-state { order: -1; margin-left: 0; min-width: 64px; text-align: center; }
    .status.warning, .login-state.failed { background: rgba(217,119,6,.12); color: #b45309; }
    .login-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--ac-border); color: var(--ac-muted); font-size: 12px; }
    .login-pager div { display: flex; align-items: center; gap: 8px; }
    .login-pager strong { min-width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: var(--ac-primary); color: #fff; }
    .icon-btn:disabled { opacity: .45; cursor: not-allowed; }
    .template-row { justify-content: space-between; }
    .template-row span { color: var(--ac-muted); font-size: 12px; }
    .notification-empty { min-height: 255px; display: grid; place-items: center; align-content: center; gap: 8px; text-align: center; border: 1px dashed var(--ac-border); border-radius: 8px; background: linear-gradient(135deg, rgba(37,99,235,.06), rgba(20,184,166,.05)); padding: 18px; margin-top: 14px; }
    .notification-empty .material-symbols-rounded { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 16px; background: rgba(37,99,235,.1); color: var(--ac-primary); font-size: 28px; }
    .notification-empty strong { color: var(--ac-text); }
    .notification-empty p { max-width: 360px; margin: 0; color: var(--ac-muted); font-size: 13px; line-height: 1.45; }
    .notification-empty a { min-height: 34px; display: inline-flex; align-items: center; padding: 7px 12px; border-radius: 999px; background: var(--ac-primary); color: #fff; text-decoration: none; font-size: 12px; font-weight: 900; }
    .intelligence-panel { display: grid; gap: 12px; align-content: start; background: linear-gradient(180deg, color-mix(in srgb, #eff6ff 72%, var(--ac-surface)), var(--ac-surface)); }
    .ai-insight-card { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 12px; padding: 13px; border: 1px solid rgba(37,99,235,.16); border-radius: 8px; background: linear-gradient(135deg, rgba(37,99,235,.1), rgba(124,58,237,.08)); }
    .ai-orb { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 16px; background: radial-gradient(circle at 34% 32%, #ecfeff, #38bdf8 34%, #4f46e5 68%, #312e81); box-shadow: 0 12px 28px rgba(37,99,235,.22); }
    .ai-orb i { width: 14px; height: 14px; border-radius: 999px; background: #67e8f9; box-shadow: 16px 0 0 #bfdbfe, 8px 14px 0 #a78bfa; }
    .ai-insight-card strong { display: block; color: var(--ac-text); font-size: 14px; }
    .ai-insight-card p { margin: 5px 0 8px; color: var(--ac-text-2); font-size: 13px; line-height: 1.45; }
    .ai-insight-card small { color: var(--ac-muted); font-size: 11px; font-weight: 800; }
    .status-stack { display: grid; gap: 8px; }
    .status-panel { display: grid; gap: 10px; }
    .status-block { padding: 12px; border: 1px solid var(--ac-border); border-radius: 8px; display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; }
    .status-block.compact { min-height: 54px; background: rgba(255,255,255,.62); }
    .status-block span { color: #2563eb; }
    .status-block p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .status-block small { grid-column: 2 / -1; color: var(--ac-muted); }
    .pulse-card { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; padding: 13px; border: 1px solid color-mix(in srgb, var(--tone) 22%, var(--ac-border)); border-radius: 8px; background: color-mix(in srgb, var(--tone) 8%, var(--ac-surface)); }
    .pulse-card > .material-symbols-rounded { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; color: var(--tone); background: color-mix(in srgb, var(--tone) 14%, transparent); }
    .pulse-card small { color: var(--tone); font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .pulse-card strong { display: block; margin-top: 4px; color: var(--ac-text); font-size: 13.5px; }
    .pulse-card p { margin: 5px 0 0; color: var(--ac-muted); font-size: 12.5px; line-height: 1.45; }
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
    :host-context(.dark) .dashboard-hero {
      border-color: rgba(96,165,250,.22);
      background:
        radial-gradient(circle at 12% 18%, rgba(37,99,235,.28), transparent 32%),
        radial-gradient(circle at 76% 30%, rgba(20,184,166,.18), transparent 28%),
        linear-gradient(135deg, rgba(15,23,42,.96), rgba(8,20,27,.96) 58%, rgba(28,19,13,.92));
      box-shadow: 0 20px 60px rgba(0,0,0,.32);
    }
    :host-context(.dark) .dashboard-hero.staff-hero {
      background:
        radial-gradient(circle at 12% 18%, rgba(20,184,166,.24), transparent 32%),
        radial-gradient(circle at 78% 28%, rgba(37,99,235,.22), transparent 28%),
        linear-gradient(135deg, rgba(10,24,28,.96), rgba(12,22,38,.96) 58%, rgba(31,25,13,.9));
    }
    :host-context(.dark) .eyebrow { color: #2dd4bf; }
    :host-context(.dark) .dashboard-hero p { color: #cbd5e1; }
    :host-context(.dark) .hero-tags span {
      border-color: rgba(148,163,184,.22);
      background: rgba(15,23,42,.72);
      color: #e2e8f0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
    }
    :host-context(.dark) .hero-tags .material-symbols-rounded { color: #60a5fa; }
    :host-context(.dark) .hero-panel {
      border-color: rgba(148,163,184,.28);
      background: linear-gradient(180deg, rgba(30,41,59,.86), rgba(15,23,42,.88));
      box-shadow: 0 22px 50px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.07);
    }
    :host-context(.dark) .hero-panel > .material-symbols-rounded {
      color: #60a5fa;
      background: rgba(37,99,235,.2);
      box-shadow: inset 0 0 0 1px rgba(96,165,250,.12);
    }
    :host-context(.dark) .hero-panel p { color: #94a3b8; }
    :host-context(.dark) .icon-btn {
      background: rgba(15,23,42,.82);
      border-color: rgba(148,163,184,.24);
      color: #dbeafe;
    }
    :host-context(.dark) .metric-card,
    :host-context(.dark) .panel {
      border-color: rgba(148,163,184,.18);
      background: linear-gradient(180deg, rgba(22,30,42,.96), rgba(17,24,34,.96));
      box-shadow: 0 16px 36px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.04);
    }
    :host-context(.dark) .metric-card {
      border-top-color: var(--tone);
      box-shadow: 0 16px 34px rgba(0,0,0,.24), 0 -1px 0 color-mix(in srgb, var(--tone) 34%, transparent) inset;
    }
    :host-context(.dark) .metric-card:hover,
    :host-context(.dark) .panel:hover {
      border-color: color-mix(in srgb, var(--tone, #60a5fa) 28%, rgba(148,163,184,.2));
    }
    :host-context(.dark) .metric-icon,
    :host-context(.dark) .audit-icon,
    :host-context(.dark) .quick-action .material-symbols-rounded {
      background: color-mix(in srgb, var(--tone) 18%, rgba(15,23,42,.8));
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 22%, transparent);
    }
    :host-context(.dark) .metric-label,
    :host-context(.dark) .metric-card span,
    :host-context(.dark) .section-head p,
    :host-context(.dark) .section-head span,
    :host-context(.dark) .health-row p,
    :host-context(.dark) .login-row p,
    :host-context(.dark) .template-row span,
    :host-context(.dark) .status-block p,
    :host-context(.dark) .status-block small,
    :host-context(.dark) .empty,
    :host-context(.dark) .generated {
      color: #94a3b8;
    }
    :host-context(.dark) .metric-card strong,
    :host-context(.dark) .section-head h2,
    :host-context(.dark) .audit-name strong,
    :host-context(.dark) .health-row strong,
    :host-context(.dark) .login-row strong,
    :host-context(.dark) .template-row strong,
    :host-context(.dark) .status-block strong {
      color: #f8fafc;
    }
    :host-context(.dark) .login-row > small,
    :host-context(.dark) .login-pager,
    :host-context(.dark) .ai-insight-card p,
    :host-context(.dark) .ai-insight-card small,
    :host-context(.dark) .notification-empty p,
    :host-context(.dark) .pulse-card p {
      color: #94a3b8;
    }
    :host-context(.dark) .notification-empty {
      border-color: rgba(96,165,250,.2);
      background: linear-gradient(135deg, rgba(37,99,235,.12), rgba(20,184,166,.08));
    }
    :host-context(.dark) .notification-empty strong,
    :host-context(.dark) .ai-insight-card strong,
    :host-context(.dark) .pulse-card strong {
      color: #f8fafc;
    }
    :host-context(.dark) .intelligence-panel {
      background:
        radial-gradient(circle at 20% 0%, rgba(37,99,235,.14), transparent 34%),
        linear-gradient(180deg, rgba(22,30,42,.96), rgba(17,24,34,.96));
    }
    :host-context(.dark) .ai-insight-card {
      border-color: rgba(96,165,250,.2);
      background: linear-gradient(135deg, rgba(37,99,235,.18), rgba(124,58,237,.12));
    }
    :host-context(.dark) .status-block.compact {
      background: rgba(15,23,42,.42);
    }
    :host-context(.dark) .pulse-card {
      border-color: color-mix(in srgb, var(--tone) 28%, rgba(148,163,184,.16));
      background: color-mix(in srgb, var(--tone) 12%, rgba(15,23,42,.78));
    }
    :host-context(.dark) .bar-track {
      background: rgba(2,6,23,.72);
      box-shadow: inset 0 0 0 1px rgba(148,163,184,.08);
    }
    :host-context(.dark) .bar-fill {
      background: linear-gradient(90deg, var(--tone), color-mix(in srgb, var(--tone) 70%, #93c5fd));
      box-shadow: 0 0 18px color-mix(in srgb, var(--tone) 28%, transparent);
    }
    :host-context(.dark) .bar-row > strong,
    :host-context(.dark) .status,
    :host-context(.dark) .login-state {
      background: color-mix(in srgb, var(--tone, #16a34a) 16%, rgba(15,23,42,.8));
      color: color-mix(in srgb, var(--tone, #22c55e) 78%, #ffffff);
    }
    :host-context(.dark) .status.warning,
    :host-context(.dark) .login-state.failed {
      background: rgba(217,119,6,.18);
      color: #fbbf24;
    }
    :host-context(.dark) .health-row,
    :host-context(.dark) .login-row,
    :host-context(.dark) .template-row,
    :host-context(.dark) .status-block {
      border-color: rgba(148,163,184,.16);
      background: rgba(15,23,42,.42);
    }
    :host-context(.dark) .quick-action {
      border-color: rgba(148,163,184,.18);
      background: color-mix(in srgb, var(--tone) 10%, rgba(15,23,42,.82));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    }
    :host-context(.dark) .access-cloud span {
      border-color: rgba(148,163,184,.18);
      background: rgba(15,23,42,.62);
      color: #cbd5e1;
    }
    :host-context(.dark) .readiness-ring {
      background:
        radial-gradient(circle, rgba(45,212,191,.18), rgba(96,165,250,.1) 56%, transparent 57%),
        rgba(15,23,42,.54);
      border: 1px solid rgba(148,163,184,.14);
    }
    @media (max-width: 1280px) { .kpi-grid, .staff-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .main-grid, .lower-grid, .staff-grid { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .dashboard-hero { grid-template-columns: 1fr; } .kpi-grid, .staff-kpi-grid, .quick-actions { grid-template-columns: 1fr; } .section-head { flex-direction: column; } .bar-row { grid-template-columns: 1fr; } .audit-name small { white-space: normal; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  protected readonly dashboard = signal<AdministrationDashboard | null>(null);

  private readonly service = inject(AdministrationDashboardService);
  private readonly airaChat = inject(AiraChatService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly authStore = inject(AuthStore);
  private aiTimer: ReturnType<typeof setInterval> | null = null;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly isHospitalAdmin = computed(() => isHospitalAdminUser(this.authStore.session()));
  protected readonly roleLabel = computed(() => getUserRoleLabel(this.authStore.session()));
  protected readonly displayName = computed(() => this.authStore.session()?.fullName?.trim() || 'User');
  protected readonly staffActions = computed(() => createStaffActions(this.authStore.permissions()));
  protected readonly accessModules = computed(() => createAccessModules(this.authStore.permissions()));
  protected readonly loginPage = signal(1);
  protected readonly aiInsightLoading = signal(false);
  protected readonly aiInsightTitle = signal('Morning command brief');
  protected readonly aiInsightText = signal('AIRA is ready to read aggregate dashboard signals and suggest operational focus areas.');
  protected readonly aiInsightStamp = signal('Waiting for first refresh');
  protected readonly pulseIndex = signal(0);
  protected readonly currentPulse = computed(() => hospitalPulseItems[this.pulseIndex() % hospitalPulseItems.length]);

  async ngOnInit(): Promise<void> {
    await this.load();
    this.aiTimer = setInterval(() => {
      const model = this.dashboard();
      if (model && this.isHospitalAdmin()) {
        void this.refreshAiInsights(model, false);
      }
    }, 120_000);
    this.pulseTimer = setInterval(() => {
      this.pulseIndex.update(index => (index + 1) % hospitalPulseItems.length);
    }, 12_000);
  }

  ngOnDestroy(): void {
    if (this.aiTimer) {
      clearInterval(this.aiTimer);
    }
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
    }
  }

  protected t(key: string): string { return this.i18n.translate(key); }

  protected async load(): Promise<void> {
    const response = await this.service.getDashboard();
    if (response.success && response.data) {
      this.dashboard.set(response.data);
      this.loginPage.set(1);
      this.setFallbackInsight(response.data);
      if (this.isHospitalAdmin()) {
        void this.refreshAiInsights(response.data, false);
      }
      return;
    }

    this.toast.error(this.t(response.message));
  }

  protected pagedRecentLogins(model: AdministrationDashboard) {
    const start = (this.loginPage() - 1) * recentLoginPageSize;
    return model.recentLogins.slice(start, start + recentLoginPageSize);
  }

  protected recentLoginTotalPages(model: AdministrationDashboard): number {
    return Math.max(1, Math.ceil(model.recentLogins.length / recentLoginPageSize));
  }

  protected recentLoginRange(model: AdministrationDashboard): string {
    if (model.recentLogins.length === 0) {
      return '0';
    }

    const start = (this.loginPage() - 1) * recentLoginPageSize + 1;
    const end = Math.min(this.loginPage() * recentLoginPageSize, model.recentLogins.length);
    return `${start}-${end}`;
  }

  protected changeLoginPage(delta: number, model: AdministrationDashboard): void {
    const totalPages = this.recentLoginTotalPages(model);
    this.loginPage.update(page => Math.min(totalPages, Math.max(1, page + delta)));
  }

  protected async refreshAiInsights(model: AdministrationDashboard, notify = true): Promise<void> {
    if (this.aiInsightLoading()) {
      return;
    }

    this.aiInsightLoading.set(true);
    try {
      const response = await this.airaChat.send(createDashboardInsightPrompt(model), []);
      if (response.success && response.data?.message) {
        this.aiInsightTitle.set('AIRA live operations note');
        this.aiInsightText.set(compactText(response.data.message));
        this.aiInsightStamp.set(`Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        return;
      }

      this.setFallbackInsight(model);
      if (notify && response.message !== 'Ai.Chat.Errors.ProviderNotConfigured') {
        this.toast.error(response.message || 'AIRA insight refresh failed');
      }
    } catch {
      this.setFallbackInsight(model);
      if (notify) {
        this.toast.error('AIRA insight refresh failed');
      }
    } finally {
      this.aiInsightLoading.set(false);
    }
  }

  private setFallbackInsight(model: AdministrationDashboard): void {
    const failedLogins = model.recentLogins.filter(login => !login.wasSuccessful).length;
    const unhealthy = model.systemHealth.filter(item => item.statusCode !== 'HEALTHY').length;
    const templates = model.summary.notificationTemplateCount;
    const focus = unhealthy > 0
      ? `${unhealthy} system component needs attention before shift handover.`
      : failedLogins > 0
        ? `${failedLogins} recent sign-in attempt failed. Review access support if this repeats.`
        : templates === 0
          ? 'Notification templates are not configured yet. Add templates to reduce manual communication work.'
          : 'Systems look stable. Keep watching sign-ins, templates, and session load during peak hours.';

    this.aiInsightTitle.set('AIRA local operations note');
    this.aiInsightText.set(focus);
    this.aiInsightStamp.set(`Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
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

  protected auditLabel(actionCode: string): string {
    return auditCopy(actionCode).label;
  }

  protected auditHelp(actionCode: string): string {
    return auditCopy(actionCode).help;
  }

  protected auditIcon(actionCode: string): string {
    return auditCopy(actionCode).icon;
  }

  protected auditTone(actionCode: string): string {
    return auditCopy(actionCode).tone;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

const recentLoginPageSize = 6;

const hospitalPulseItems: HospitalPulseItem[] = [
  {
    title: 'Digital front desks are becoming command centers',
    detail: 'Hospitals are moving reception, appointment, and billing signals into one operational view for faster daily decisions.',
    region: 'Global',
    tag: 'Operations',
    icon: 'hub',
    tone: '#2563eb'
  },
  {
    title: 'Patient communication is shifting to automated journeys',
    detail: 'Appointment reminders, lab alerts, payment nudges, and discharge instructions work best when templates are ready before peak load.',
    region: 'APAC',
    tag: 'Patient experience',
    icon: 'forum',
    tone: '#0f766e'
  },
  {
    title: 'Access reviews remain a high-value admin habit',
    detail: 'Short weekly checks of roles, failed sign-ins, and active sessions reduce avoidable support and compliance friction.',
    region: 'Global',
    tag: 'Security',
    icon: 'admin_panel_settings',
    tone: '#7c3aed'
  },
  {
    title: 'Care teams need sharper inventory visibility',
    detail: 'Low-stock signals, pharmacy movement, and expiry tracking are becoming core daily indicators for hospital resilience.',
    region: 'India',
    tag: 'Pharmacy',
    icon: 'medication',
    tone: '#d97706'
  }
];

function createDashboardInsightPrompt(model: AdministrationDashboard): string {
  const failedLogins = model.recentLogins.filter(login => !login.wasSuccessful).length;
  const unhealthy = model.systemHealth.filter(item => item.statusCode !== 'HEALTHY').map(item => item.componentCode);
  return [
    'Create one concise hospital operations dashboard insight for an admin.',
    'Use only these aggregate metrics. Do not ask for or mention patient-level data.',
    `Total users: ${model.summary.totalUsers}`,
    `Active users: ${model.summary.activeUsers}`,
    `Active sessions: ${model.summary.activeSessions}`,
    `Logins today: ${model.summary.loginsToday}`,
    `Recent failed logins visible: ${failedLogins}`,
    `Notification templates: ${model.summary.notificationTemplateCount}`,
    `License status: ${model.summary.licenseStatusCode}`,
    `Subscription status: ${model.summary.subscriptionStatusCode}`,
    `System health: ${model.summary.systemHealthStatusCode}`,
    `Components needing attention: ${unhealthy.length > 0 ? unhealthy.join(', ') : 'none'}`,
    'Return 1-2 sentences with one practical next action.'
  ].join('\n');
}

function compactText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
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

function auditCopy(actionCode: string): { label: string; help: string; icon: string; tone: string } {
  const normalized = actionCode.replace(/[\s_-]+/g, '').toLowerCase();
  const labels: Record<string, { label: string; help: string; icon: string; tone: string }> = {
    httprequest: { label: 'Workspace usage', help: 'Screens and services used by the team', icon: 'monitoring', tone: '#2563eb' },
    httprequestfailed: { label: 'Needs support attention', help: 'Screen or service requests that did not complete', icon: 'report', tone: '#dc2626' },
    login: { label: 'Sign-in checks', help: 'People trying to access Care360', icon: 'login', tone: '#7c3aed' },
    loginsucceeded: { label: 'Successful sign-ins', help: 'Users who entered the system successfully', icon: 'verified_user', tone: '#16a34a' },
    loginfailed: { label: 'Unsuccessful sign-ins', help: 'Incorrect password or blocked access attempts', icon: 'lock', tone: '#d97706' },
    logout: { label: 'Sessions closed', help: 'Users who signed out of Care360', icon: 'logout', tone: '#0891b2' },
    create: { label: 'New records created', help: 'New hospital information added by users', icon: 'add_circle', tone: '#0f766e' },
    update: { label: 'Records updated', help: 'Existing hospital information changed', icon: 'edit', tone: '#2563eb' },
    delete: { label: 'Records removed', help: 'Hospital information removed from the workspace', icon: 'delete', tone: '#be123c' },
    updatebranding: { label: 'Hospital profile updated', help: 'Logo, colors, or identity settings changed', icon: 'palette', tone: '#c026d3' },
    setparent: { label: 'Access hierarchy changed', help: 'Role or organization relationship updated', icon: 'account_tree', tone: '#475569' }
  };

  return labels[normalized] ?? {
    label: humanizeAction(actionCode),
    help: 'Workspace event recorded by Care360',
    icon: 'history',
    tone: '#64748b'
  };
}

function humanizeAction(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
