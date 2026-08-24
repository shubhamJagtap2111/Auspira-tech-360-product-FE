import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiraChatService } from '../../core/ai/aira-chat.service';
import { AuthStore } from '../../core/auth/auth.store';
import { getUserRoleLabel, isHospitalAdminUser } from '../../core/auth/user-access';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ActivityTrendItem, AdministrationDashboard, AdministrationDashboardSummary, AdministrationOperationalSummary, RecentLoginItem, SystemHealthItem } from './administration-dashboard.models';
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

interface QuickAction {
  label: string;
  path: string;
  icon: string;
  tone: string;
}

interface AttentionItem {
  title: string;
  detail: string;
  actionLabel: string;
  path: string;
  icon: string;
  severity: 'critical' | 'warning' | 'info';
}

interface OperationalMetric {
  label: string;
  value: string;
  subLabel: string;
  icon: string;
  tone: string;
  path: string;
}

interface ActivitySeries {
  label: string;
  key: keyof Pick<ActivityTrendItem, 'loginAttempts' | 'recordUpdates' | 'securityEvents'>;
  tone: string;
}

interface HospitalPulseItem {
  title: string;
  detail: string;
  rows: string[];
  region: string;
  tag: string;
  icon: string;
  tone: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
          <section class="quick-action-strip">
            <div class="section-head">
              <div>
                <h2>Quick actions</h2>
                <p>Start common hospital administration work without hunting through menus.</p>
              </div>
              <span>{{ adminQuickActions.length }} actions</span>
            </div>
            <div class="admin-quick-actions">
              @for (action of adminQuickActions; track action.path + action.label) {
                <a [routerLink]="action.path" class="admin-quick-action" [style.--tone]="action.tone">
                  <span class="material-symbols-rounded">{{ action.icon }}</span>
                  <strong>{{ action.label }}</strong>
                </a>
              }
            </div>
          </section>

          <section class="attention-grid">
            <article class="panel attention-panel">
              <div class="section-head">
                <div>
                  <h2>Requires attention</h2>
                  <p>Priority actions that can affect hospital operations today.</p>
                </div>
                <span>{{ attentionItems(model).length }} open</span>
              </div>
              <div class="attention-list">
                @for (item of attentionItems(model); track item.title) {
                  <div class="attention-row" [class.critical]="item.severity === 'critical'" [class.info]="item.severity === 'info'">
                    <span class="material-symbols-rounded">{{ item.icon }}</span>
                    <div>
                      <strong>{{ item.title }}</strong>
                      <p>{{ item.detail }}</p>
                    </div>
                    <a [routerLink]="item.path">{{ item.actionLabel }}</a>
                  </div>
                }
              </div>
            </article>
          </section>

          <section class="kpi-grid">
            @for (card of createOperationalCards(model.operationalSummary); track card.label) {
              <article class="metric-card" [style.--tone]="card.tone">
                <div class="metric-icon"><span class="material-symbols-rounded">{{ card.icon }}</span></div>
                <div>
                  <p class="metric-label">{{ card.label }}</p>
                  <strong>{{ card.value }}</strong>
                  <span>{{ card.subLabel }}</span>
                </div>
              </article>
            }
          </section>

          <section class="main-grid">
            <article class="panel chart-panel">
              <div class="section-head">
                <div>
                  <h2>Activity overview</h2>
                  <p>Login, record, and security movement by day.</p>
                </div>
                <div class="range-controls">
                  <button type="button" [class.active]="activityDays() === 1" (click)="setActivityRange(1)">Today</button>
                  <button type="button" [class.active]="activityDays() === 7" (click)="setActivityRange(7)">Last 7 days</button>
                  <button type="button" [class.active]="activityDays() === 30" (click)="setActivityRange(30)">Last 30 days</button>
                  <label>
                    <span>Custom</span>
                    <input type="number" min="1" max="30" [ngModel]="customActivityDays()" (ngModelChange)="setCustomActivityDays($event)" />
                  </label>
                </div>
              </div>
              <div class="activity-chart">
                @for (day of model.activityTrend; track day.activityDate) {
                  <div class="activity-day">
                    <div class="activity-bars">
                      @for (series of activitySeries; track series.key) {
                        <span [style.--tone]="series.tone" [style.height.%]="activityHeight(day[series.key], model.activityTrend)">
                          <i>{{ day[series.key] }}</i>
                        </span>
                      }
                    </div>
                    <small>{{ day.activityDate | date: 'EEE' }}</small>
                  </div>
                } @empty {
                  <p class="empty">{{ t('Administration.Dashboard.Labels.NoData') }}</p>
                }
              </div>
              <div class="chart-legend">
                @for (series of activitySeries; track series.key) {
                  <span [style.--tone]="series.tone"><i></i>{{ series.label }}</span>
                }
              </div>
            </article>

            <article class="panel">
              <div class="section-head">
                <div>
                  <h2>{{ t('Administration.Dashboard.Widgets.SystemHealth') }}</h2>
                  <p>Current service readiness and next action.</p>
                </div>
                <span class="status" [class.warning]="model.summary.systemHealthStatusCode !== 'HEALTHY'">
                  {{ t('Administration.Dashboard.Health.' + model.summary.systemHealthStatusCode) }}
                </span>
              </div>
              <div class="health-list">
                @for (item of model.systemHealth; track item.componentCode) {
                  <div class="health-row">
                    <span class="dot" [class.warning]="item.statusCode !== 'HEALTHY'"></span>
                    <div>
                      <strong>{{ healthTitle(item) }}</strong>
                      <p>{{ healthDetail(item) }}</p>
                    </div>
                    @if (healthAction(item); as action) {
                      <a class="health-action" [routerLink]="action.path">{{ action.label }}</a>
                    } @else {
                      <span class="status" [class.warning]="item.statusCode !== 'HEALTHY'">{{ t('Administration.Dashboard.Health.' + item.statusCode) }}</span>
                    }
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
                      <p>{{ login.email }}</p>
                    </div>
                    <small><b>Device</b>{{ loginDevice(login) }}</small>
                    <small><b>Location</b>{{ loginLocation(login) }}</small>
                    <small><b>Login</b>{{ login.loginDate | date: 'shortTime' }}</small>
                  </div>
                } @empty {
                  <p class="empty">{{ t('Administration.Dashboard.Labels.NoData') }}</p>
                }
              </div>
              <footer class="login-pager">
                <span>Showing {{ recentLoginRange(model) }} of {{ model.recentLogins.length }} logins</span>
                <a routerLink="/profile/activity-logs">View all login activity</a>
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

            <div class="dashboard-side-stack">
              <article class="panel account-panel">
                <div class="section-head">
                  <div>
                    <h2>Account & subscription</h2>
                    <p>License, plan, and usage limits in one place.</p>
                  </div>
                  <strong class="status-value" [class]="statusToneClass(model.summary.subscriptionStatusCode)">
                    <i></i>{{ t('Hospital.Subscription.Status.' + model.summary.subscriptionStatusCode) }}
                  </strong>
                </div>
                <div class="account-lines">
                  <div><span>Plan</span><strong>Care360 Enterprise</strong></div>
                  <div><span>Hospitals</span><strong>{{ model.summary.totalHospitals }} / 5</strong></div>
                  <div><span>Users</span><strong>{{ model.summary.totalUsers }} / Unlimited</strong></div>
                  <div><span>License</span><strong>{{ t('Administration.Dashboard.License.' + model.summary.licenseStatusCode) }}</strong></div>
                </div>
                <a class="panel-action" routerLink="/administration/hospital">Manage subscription</a>
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
                      <strong>Templates are not configured</strong>
                      <p>Configure SMS, email, and reminder templates so hospital communication can run without manual follow-up.</p>
                      <a routerLink="/administration/system-configuration">Configure</a>
                    </div>
                  }
                </div>
              </article>

              <article class="panel readiness-panel">
                <div class="section-head">
                  <div>
                    <h2>Operational readiness</h2>
                    <p>Branch-ready actions from the current dashboard signals.</p>
                  </div>
                </div>
                <div class="readiness-list">
                  <div>
                    <span class="material-symbols-rounded">account_tree</span>
                    <p>Use the branch selector before reviewing patients, doctors, users, and reports.</p>
                  </div>
                  <div>
                    <span class="material-symbols-rounded">fact_check</span>
                    <p>{{ model.summary.notificationTemplateCount === 0 ? 'Notification templates are still pending configuration.' : 'Notification templates are configured for operational follow-up.' }}</p>
                  </div>
                  <div>
                    <span class="material-symbols-rounded">health_and_safety</span>
                    <p>{{ model.summary.systemHealthStatusCode === 'HEALTHY' ? 'Core services are healthy for today’s administration work.' : 'System health needs review before peak workflow hours.' }}</p>
                  </div>
                </div>
              </article>
            </div>

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
                <div class="ai-card-head">
                  <span class="ai-orb" aria-hidden="true">
                    <span class="aira-message-icon"></span>
                    <i></i>
                  </span>
                  <div>
                    <strong>{{ aiInsightTitle() }}</strong>
                    <small>{{ aiInsightStamp() }}</small>
                  </div>
                  <span class="ai-live-chip"><i></i>AIRA live</span>
                </div>
                <p>{{ attentionItems(model).length }} insights require attention.</p>
                <div class="ai-next-actions compact">
                  @for (item of aiAttentionItems(model); track item.title) {
                    <a [routerLink]="item.path">
                      <span class="material-symbols-rounded">{{ item.icon }}</span>
                      <p>{{ item.title }}</p>
                    </a>
                  }
                </div>
                <a class="panel-action" routerLink="/reports">View AI insights</a>
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
    .quick-action-strip { padding: 14px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); box-shadow: var(--ac-shadow-soft); }
    .admin-quick-actions { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
    .admin-quick-action { min-height: 54px; display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); text-decoration: none; background: color-mix(in srgb, var(--tone) 6%, var(--ac-surface)); }
    .admin-quick-action:hover { border-color: var(--tone); transform: translateY(-1px); }
    .admin-quick-action .material-symbols-rounded { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--tone) 13%, transparent); color: var(--tone); font-size: 19px; }
    .admin-quick-action strong { font-size: 12.5px; line-height: 1.2; }
    .attention-grid { display: grid; grid-template-columns: 1fr; }
    .attention-panel { border-color: rgba(217,119,6,.22); background: linear-gradient(135deg, rgba(255,247,237,.75), var(--ac-surface)); }
    .attention-list { display: grid; gap: 10px; margin-top: 12px; }
    .attention-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px; border: 1px solid rgba(217,119,6,.22); border-radius: 8px; background: rgba(255,255,255,.72); }
    .attention-row.critical { border-color: rgba(220,38,38,.24); background: rgba(254,242,242,.76); }
    .attention-row.info { border-color: rgba(34,197,94,.22); background: rgba(240,253,244,.74); }
    .attention-row > .material-symbols-rounded { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; color: #b45309; background: rgba(245,158,11,.13); }
    .attention-row.critical > .material-symbols-rounded { color: #dc2626; background: rgba(220,38,38,.1); }
    .attention-row.info > .material-symbols-rounded { color: #15803d; background: rgba(34,197,94,.12); }
    .attention-row strong { display: block; font-size: 13.5px; }
    .attention-row p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
    .attention-row a, .health-action, .panel-action, .login-pager a { min-height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-primary); text-decoration: none; font-size: 12px; font-weight: 900; white-space: nowrap; }
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
    .lower-grid { display: grid; grid-template-columns: minmax(360px, 1.08fr) minmax(360px, .98fr) minmax(360px, .98fr); gap: 16px; align-items: start; }
    .dashboard-side-stack { display: grid; gap: 10px; min-width: 0; align-content: start; }
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
    .range-controls { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
    .range-controls button, .range-controls label { min-height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); font-size: 11px; font-weight: 900; }
    .range-controls button { cursor: pointer; }
    .range-controls button.active { border-color: var(--ac-primary); background: rgba(37,99,235,.1); color: var(--ac-primary); }
    .range-controls input { width: 52px; border: 0; outline: 0; background: transparent; color: var(--ac-text); font-weight: 900; }
    .activity-chart { min-height: 250px; display: grid; grid-template-columns: repeat(auto-fit, minmax(46px, 1fr)); align-items: end; gap: 10px; margin-top: 18px; padding: 14px 12px 8px; border: 1px solid var(--ac-border); border-radius: 8px; background: linear-gradient(180deg, color-mix(in srgb, #eff6ff 42%, var(--ac-surface)), var(--ac-surface)); }
    .activity-day { min-width: 0; display: grid; gap: 8px; align-items: end; justify-items: center; }
    .activity-bars { width: 100%; height: 190px; display: grid; grid-template-columns: repeat(3, minmax(7px, 1fr)); align-items: end; gap: 4px; }
    .activity-bars span { position: relative; min-height: 6px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, var(--tone), color-mix(in srgb, var(--tone) 72%, #ffffff)); box-shadow: 0 8px 18px color-mix(in srgb, var(--tone) 18%, transparent); }
    .activity-bars i { position: absolute; left: 50%; bottom: calc(100% + 4px); transform: translateX(-50%); color: var(--ac-muted); font-size: 10px; font-style: normal; font-weight: 900; opacity: 0; transition: opacity .16s ease; }
    .activity-bars span:hover i { opacity: 1; }
    .activity-day small { color: var(--ac-muted); font-size: 11px; font-weight: 900; }
    .chart-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .chart-legend span { display: inline-flex; align-items: center; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    .chart-legend i { width: 9px; height: 9px; border-radius: 999px; background: var(--tone); }
    .health-row, .login-row, .template-row { display: flex; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--ac-border); border-radius: 8px; }
    .health-row p, .login-row p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .login-row { min-height: 58px; }
    .login-row > div { min-width: 0; flex: 1; }
    .lower-grid .login-row { display: grid; grid-template-columns: 72px minmax(180px, 1fr) repeat(3, minmax(92px, auto)); }
    .login-row > small { display: grid; gap: 2px; color: var(--ac-muted); font-size: 11px; white-space: nowrap; }
    .login-row > small b { color: var(--ac-text-2); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
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
    .notification-empty { min-height: 168px; display: grid; place-items: center; align-content: center; gap: 8px; text-align: center; border: 1px dashed var(--ac-border); border-radius: 8px; background: linear-gradient(135deg, rgba(37,99,235,.06), rgba(20,184,166,.05)); padding: 16px; margin-top: 12px; }
    .notification-empty .material-symbols-rounded { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 16px; background: rgba(37,99,235,.1); color: var(--ac-primary); font-size: 28px; }
    .notification-empty strong { color: var(--ac-text); }
    .notification-empty p { max-width: 360px; margin: 0; color: var(--ac-muted); font-size: 13px; line-height: 1.45; }
    .notification-empty a { min-height: 34px; display: inline-flex; align-items: center; padding: 7px 12px; border-radius: 999px; background: var(--ac-primary); color: #fff; text-decoration: none; font-size: 12px; font-weight: 900; }
    .intelligence-panel { display: grid; gap: 12px; align-content: start; background: linear-gradient(180deg, color-mix(in srgb, #eff6ff 72%, var(--ac-surface)), var(--ac-surface)); }
    .ai-insight-card { position: relative; display: grid; gap: 12px; padding: 14px; border: 1px solid rgba(37,99,235,.18); border-radius: 8px; overflow: hidden; background: radial-gradient(circle at 0% 0%, rgba(34,211,238,.18), transparent 34%), linear-gradient(135deg, rgba(37,99,235,.12), rgba(124,58,237,.08) 52%, rgba(20,184,166,.08)); box-shadow: 0 16px 36px rgba(37,99,235,.12), inset 0 1px 0 rgba(255,255,255,.62); }
    .ai-insight-card::after { content: ''; position: absolute; inset: auto -38px -58px auto; width: 150px; height: 150px; border-radius: 999px; background: radial-gradient(circle, rgba(37,99,235,.16), transparent 68%); pointer-events: none; }
    .ai-orb { position: relative; z-index: 1; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 14px; color: #2563eb; background: linear-gradient(135deg, rgba(37,99,235,.16), rgba(20,184,166,.12)); box-shadow: 0 14px 28px rgba(37,99,235,.12); }
    .ai-orb::before { content: ''; position: absolute; inset: 7px; border-radius: 11px; background: rgba(255,255,255,.44); }
    .ai-orb .aira-message-icon { position: relative; z-index: 1; width: 26px; height: 26px; background: currentColor; mask: url('/assets/brand/aira-message.png') center / contain no-repeat; -webkit-mask: url('/assets/brand/aira-message.png') center / contain no-repeat; filter: drop-shadow(0 8px 16px rgba(37,99,235,.18)); }
    .ai-orb i { position: absolute; top: 5px; right: 5px; width: 9px; height: 9px; border-radius: 999px; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.14); }
    .ai-insight-card > * { position: relative; z-index: 1; min-width: 0; }
    .ai-card-head { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: 12px; margin-bottom: 0; }
    .ai-card-head strong { display: block; color: var(--ac-text); font-size: 14.5px; line-height: 1.2; }
    .ai-card-head small { display: block; margin-top: 4px; color: var(--ac-muted); font-size: 11px; font-weight: 900; }
    .ai-live-chip { min-height: 26px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.72); color: #0f766e; border: 1px solid rgba(20,184,166,.18); font-size: 11px; font-weight: 900; white-space: nowrap; }
    .ai-live-chip i { width: 7px; height: 7px; border-radius: 999px; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.12); }
    .ai-insight-card p { margin: 0; color: var(--ac-text-2); font-size: 13px; line-height: 1.5; }
    .ai-signal-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; margin-bottom: 0; }
    .ai-signal-grid span { min-height: 48px; display: grid; align-content: center; gap: 2px; padding: 8px; border-radius: 8px; background: rgba(255,255,255,.66); border: 1px solid rgba(37,99,235,.1); color: var(--ac-muted); font-size: 10.5px; font-weight: 800; }
    .ai-signal-grid b { color: var(--ac-text); font-size: 14px; line-height: 1; }
    .ai-next-actions { display: grid; gap: 9px; }
    .ai-next-actions div { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: center; padding: 9px; border-radius: 8px; background: rgba(255,255,255,.54); border: 1px solid rgba(37,99,235,.1); }
    .ai-next-actions.compact a { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: center; padding: 9px; border-radius: 8px; background: rgba(255,255,255,.54); border: 1px solid rgba(37,99,235,.1); color: var(--ac-text); text-decoration: none; }
    .ai-next-actions .material-symbols-rounded { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: #2563eb; background: rgba(37,99,235,.1); font-size: 18px; }
    .ai-next-actions p { margin: 0; color: var(--ac-text-2); font-size: 12px; line-height: 1.35; }
    .account-panel { display: grid; gap: 12px; }
    .account-lines { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .account-lines div { min-height: 54px; display: grid; align-content: center; gap: 3px; padding: 9px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); }
    .account-lines span { color: var(--ac-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
    .account-lines strong { color: var(--ac-text); font-size: 13px; }
    .status-stack { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
    .readiness-panel { background: linear-gradient(135deg, rgba(20,184,166,.05), rgba(37,99,235,.04)); }
    .readiness-list { display: grid; gap: 9px; margin-top: 12px; }
    .readiness-list div { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 9px; align-items: center; min-height: 50px; padding: 9px; border: 1px solid var(--ac-border); border-radius: 8px; background: color-mix(in srgb, #eff6ff 34%, var(--ac-surface)); }
    .readiness-list .material-symbols-rounded { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; color: #2563eb; background: rgba(37,99,235,.1); font-size: 19px; }
    .readiness-list p { margin: 0; color: var(--ac-text-2); font-size: 12.5px; line-height: 1.35; }
    .status-panel { display: grid; gap: 10px; }
    .status-block { padding: 12px; border: 1px solid var(--ac-border); border-radius: 8px; display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; }
    .status-block.compact { min-height: 58px; background: rgba(255,255,255,.62); }
    .status-block span { color: #2563eb; }
    .status-block p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .status-value {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 6px 11px;
      border-radius: 999px;
      border: 1px solid var(--status-border, rgba(37,99,235,.14));
      background: var(--status-bg, rgba(37,99,235,.08));
      color: var(--status-color, var(--ac-primary));
      font-size: 12px;
      font-weight: 900;
      box-shadow: 0 10px 20px var(--status-shadow, rgba(37,99,235,.08));
      white-space: nowrap;
    }
    .status-value i {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 13%, transparent);
    }
    .status-value.active,
    .status-value.valid,
    .status-value.live {
      --status-color: #15803d;
      --status-bg: rgba(34,197,94,.13);
      --status-border: rgba(34,197,94,.22);
      --status-shadow: rgba(34,197,94,.10);
    }
    .status-value.trial,
    .status-value.warning,
    .status-value.pending {
      --status-color: #b45309;
      --status-bg: rgba(245,158,11,.14);
      --status-border: rgba(245,158,11,.24);
      --status-shadow: rgba(245,158,11,.10);
    }
    .status-value.expired,
    .status-value.suspended,
    .status-value.inactive {
      --status-color: #be123c;
      --status-bg: rgba(244,63,94,.12);
      --status-border: rgba(244,63,94,.24);
      --status-shadow: rgba(244,63,94,.10);
    }
    .status-block small { grid-column: 2 / -1; color: var(--ac-muted); }
    .pulse-panel { display: grid; gap: 12px; padding: 14px; border: 1px solid color-mix(in srgb, var(--tone) 24%, var(--ac-border)); border-radius: 8px; background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 10%, var(--ac-surface)), var(--ac-surface)); box-shadow: inset 0 1px 0 rgba(255,255,255,.5); }
    .pulse-topline { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 10px; align-items: center; }
    .pulse-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; color: var(--tone); background: color-mix(in srgb, var(--tone) 15%, transparent); }
    .pulse-topline small { color: var(--tone); font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; }
    .pulse-topline strong { display: block; margin-top: 2px; color: var(--ac-text); font-size: 13px; }
    .pulse-live { min-height: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 9%, var(--ac-surface)); color: var(--ac-text-2); font-size: 11px; font-weight: 900; }
    .pulse-live i { width: 7px; height: 7px; border-radius: 999px; background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.12); }
    .pulse-story { padding: 11px 12px; border-radius: 8px; background: rgba(255,255,255,.62); border: 1px solid color-mix(in srgb, var(--tone) 14%, transparent); }
    .pulse-story h3 { margin: 0; color: var(--ac-text); font-size: 15px; line-height: 1.25; }
    .pulse-story p { margin: 6px 0 0; color: var(--ac-text-2); font-size: 12.5px; line-height: 1.45; }
    .pulse-rows { display: grid; gap: 8px; }
    .pulse-row { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: center; min-height: 42px; padding: 8px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--tone) 12%, var(--ac-border)); background: color-mix(in srgb, var(--tone) 5%, var(--ac-surface)); }
    .pulse-row .material-symbols-rounded { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent); font-size: 18px; }
    .pulse-row p { margin: 0; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
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
    :host-context(.dark) .ai-card-head small,
    :host-context(.dark) .ai-signal-grid span,
    :host-context(.dark) .notification-empty p,
    :host-context(.dark) .pulse-story p,
    :host-context(.dark) .pulse-row p {
      color: #94a3b8;
    }
    :host-context(.dark) .notification-empty {
      border-color: rgba(96,165,250,.2);
      background: linear-gradient(135deg, rgba(37,99,235,.12), rgba(20,184,166,.08));
    }
    :host-context(.dark) .notification-empty strong,
    :host-context(.dark) .ai-card-head strong,
    :host-context(.dark) .ai-signal-grid b,
    :host-context(.dark) .pulse-topline strong,
    :host-context(.dark) .pulse-story h3 {
      color: #f8fafc;
    }
    :host-context(.dark) .intelligence-panel {
      background:
        radial-gradient(circle at 20% 0%, rgba(37,99,235,.14), transparent 34%),
        linear-gradient(180deg, rgba(22,30,42,.96), rgba(17,24,34,.96));
    }
    :host-context(.dark) .ai-insight-card {
      border-color: rgba(96,165,250,.2);
      background: radial-gradient(circle at 0% 0%, rgba(34,211,238,.12), transparent 34%), linear-gradient(135deg, rgba(37,99,235,.18), rgba(124,58,237,.12) 52%, rgba(20,184,166,.08));
      box-shadow: 0 16px 34px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.05);
    }
    :host-context(.dark) .ai-live-chip,
    :host-context(.dark) .ai-signal-grid span,
    :host-context(.dark) .ai-next-actions div {
      background: rgba(15,23,42,.52);
      border-color: rgba(148,163,184,.16);
    }
    :host-context(.dark) .ai-next-actions p {
      color: #cbd5e1;
    }
    :host-context(.dark) .status-block.compact {
      background: rgba(15,23,42,.42);
    }
    :host-context(.dark) .status-value {
      color: var(--status-color, #60a5fa);
      background: color-mix(in srgb, var(--status-color, #60a5fa) 16%, rgba(15,23,42,.74));
      border-color: color-mix(in srgb, var(--status-color, #60a5fa) 30%, rgba(148,163,184,.18));
      box-shadow: 0 12px 24px rgba(0,0,0,.18);
    }
    :host-context(.dark) .pulse-panel {
      border-color: color-mix(in srgb, var(--tone) 28%, rgba(148,163,184,.16));
      background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 13%, rgba(15,23,42,.86)), rgba(15,23,42,.78));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    }
    :host-context(.dark) .pulse-story,
    :host-context(.dark) .pulse-row,
    :host-context(.dark) .pulse-live {
      background: rgba(15,23,42,.48);
      border-color: color-mix(in srgb, var(--tone) 18%, rgba(148,163,184,.14));
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
    :host-context(.dark) .status-block,
    :host-context(.dark) .readiness-list div {
      border-color: rgba(148,163,184,.16);
      background: rgba(15,23,42,.42);
    }
    :host-context(.dark) .quick-action-strip,
    :host-context(.dark) .attention-panel,
    :host-context(.dark) .activity-chart {
      border-color: rgba(148,163,184,.18);
      background: linear-gradient(180deg, rgba(22,30,42,.96), rgba(17,24,34,.96));
    }
    :host-context(.dark) .admin-quick-action,
    :host-context(.dark) .attention-row,
    :host-context(.dark) .range-controls button,
    :host-context(.dark) .range-controls label,
    :host-context(.dark) .account-lines div,
    :host-context(.dark) .health-action,
    :host-context(.dark) .panel-action,
    :host-context(.dark) .login-pager a,
    :host-context(.dark) .ai-next-actions.compact a {
      border-color: rgba(148,163,184,.16);
      background: rgba(15,23,42,.48);
    }
    :host-context(.dark) .attention-row p,
    :host-context(.dark) .activity-day small,
    :host-context(.dark) .chart-legend span,
    :host-context(.dark) .account-lines span {
      color: #94a3b8;
    }
    :host-context(.dark) .attention-row strong,
    :host-context(.dark) .admin-quick-action,
    :host-context(.dark) .account-lines strong {
      color: #f8fafc;
    }
    :host-context(.dark) .range-controls button.active {
      border-color: rgba(96,165,250,.45);
      background: rgba(37,99,235,.22);
      color: #bfdbfe;
    }
    :host-context(.dark) .readiness-panel {
      background: linear-gradient(135deg, rgba(20,184,166,.08), rgba(37,99,235,.08));
    }
    :host-context(.dark) .readiness-list p {
      color: #cbd5e1;
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
    @media (max-width: 1280px) { .kpi-grid, .staff-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .admin-quick-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); } .main-grid, .lower-grid, .staff-grid { grid-template-columns: 1fr; } }
    @media (max-width: 900px) { .lower-grid .login-row { grid-template-columns: 72px minmax(0, 1fr); } .login-row > small { white-space: normal; } }
    @media (max-width: 760px) { .dashboard-hero { grid-template-columns: 1fr; } .kpi-grid, .staff-kpi-grid, .quick-actions, .admin-quick-actions, .account-lines { grid-template-columns: 1fr; } .section-head { flex-direction: column; } .range-controls { justify-content: flex-start; } .attention-row { grid-template-columns: 34px minmax(0, 1fr); } .attention-row a { grid-column: 2; justify-self: start; } .bar-row { grid-template-columns: 1fr; } .audit-name small { white-space: normal; } }
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
  protected readonly activityDays = signal(7);
  protected readonly customActivityDays = signal(14);
  protected readonly aiInsightLoading = signal(false);
  protected readonly aiInsightTitle = signal('Morning command brief');
  protected readonly aiInsightText = signal('AIRA is ready to read aggregate dashboard signals and suggest operational focus areas.');
  protected readonly aiInsightStamp = signal('Waiting for first refresh');
  protected readonly pulseIndex = signal(0);
  protected readonly currentPulse = computed(() => hospitalPulseItems[this.pulseIndex() % hospitalPulseItems.length]);
  protected readonly adminQuickActions = adminQuickActions;
  protected readonly activitySeries = activitySeries;

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

  protected statusToneClass(statusCode: string | null | undefined): string {
    return (statusCode ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'pending';
  }

  protected async load(): Promise<void> {
    const response = await this.service.getDashboard(this.activityDays());
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

  protected async setActivityRange(days: number): Promise<void> {
    const normalized = clampDashboardDays(days);
    this.activityDays.set(normalized);
    if (normalized !== 1 && normalized !== 7 && normalized !== 30) {
      this.customActivityDays.set(normalized);
    }
    await this.load();
  }

  protected setCustomActivityDays(value: string | number): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    void this.setActivityRange(parsed);
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

  protected createOperationalCards(summary: AdministrationOperationalSummary): OperationalMetric[] {
    return [
      { label: 'Total patients', value: formatNumber(summary.totalPatients), subLabel: `${formatNumber(summary.patientsToday)} registered today`, icon: 'patient_list', tone: '#2563eb', path: '/patients' },
      { label: "Today's appointments", value: formatNumber(summary.todaysAppointments), subLabel: `${formatNumber(summary.todaysOpdVisits)} OPD visits today`, icon: 'event_available', tone: '#7c3aed', path: '/appointments' },
      { label: 'Doctors available', value: `${formatNumber(summary.doctorsAvailable)} / ${formatNumber(summary.totalDoctors)}`, subLabel: 'active doctors', icon: 'stethoscope', tone: '#0f766e', path: '/doctors' },
      { label: 'Current IPD patients', value: formatNumber(summary.currentIpdPatients), subLabel: `${formatNumber(summary.availableBeds)} / ${formatNumber(summary.totalBeds)} beds available`, icon: 'king_bed', tone: '#0891b2', path: '/ipd' },
      { label: 'Pending bills', value: formatCurrency(summary.pendingBillAmount), subLabel: `${formatNumber(summary.pendingBills)} invoices need follow-up`, icon: 'receipt_long', tone: '#d97706', path: '/billing' },
      { label: 'Care queue', value: formatNumber(summary.pendingLabTests + summary.pharmacyOrdersToday + summary.emergencyCasesToday), subLabel: `${formatNumber(summary.pendingLabTests)} lab, ${formatNumber(summary.pharmacyOrdersToday)} pharmacy, ${formatNumber(summary.emergencyCasesToday)} emergency`, icon: 'medical_information', tone: '#be123c', path: '/reports' }
    ];
  }

  protected attentionItems(model: AdministrationDashboard): AttentionItem[] {
    const failedLogins = model.recentLogins.filter(login => !login.wasSuccessful).length;
    const unhealthy = model.systemHealth.filter(item => item.statusCode !== 'HEALTHY').length;
    const items: AttentionItem[] = [];

    if (unhealthy > 0) {
      items.push({
        title: `${unhealthy} system component${unhealthy === 1 ? '' : 's'} need review`,
        detail: 'Resolve service warnings before peak clinical workflows.',
        actionLabel: 'Review health',
        path: '/administration/system-configuration',
        icon: 'monitor_heart',
        severity: 'critical'
      });
    }

    if (model.summary.notificationTemplateCount === 0) {
      items.push({
        title: 'Notification templates are not configured',
        detail: 'Configure SMS, email, and reminder templates for patient communication.',
        actionLabel: 'Configure',
        path: '/administration/system-configuration',
        icon: 'notifications_active',
        severity: 'warning'
      });
    }

    if (model.summary.departmentCount === 0) {
      items.push({
        title: 'Departments are not configured',
        detail: 'Add departments to organize doctors, visits, billing, and reports.',
        actionLabel: 'Add department',
        path: '/administration/departments',
        icon: 'business',
        severity: 'warning'
      });
    }

    if (failedLogins > 0) {
      items.push({
        title: `${failedLogins} failed sign-in ${failedLogins === 1 ? 'attempt' : 'attempts'}`,
        detail: 'Review access activity for blocked users or incorrect passwords.',
        actionLabel: 'Review users',
        path: '/administration/users',
        icon: 'lock',
        severity: 'critical'
      });
    }

    if (model.summary.licenseStatusCode !== 'ACTIVE' || model.summary.subscriptionStatusCode !== 'ACTIVE') {
      items.push({
        title: 'Account status needs review',
        detail: 'License or subscription is not marked active.',
        actionLabel: 'Manage',
        path: '/administration/hospital',
        icon: 'workspace_premium',
        severity: 'critical'
      });
    }

    return items.length > 0 ? items.slice(0, 4) : [{
      title: 'No critical setup items',
      detail: 'System health, access, and setup signals look stable.',
      actionLabel: 'Open reports',
      path: '/reports',
      icon: 'task_alt',
      severity: 'info'
    }];
  }

  protected aiAttentionItems(model: AdministrationDashboard): AttentionItem[] {
    return this.attentionItems(model).slice(0, 3);
  }

  protected healthTitle(item: SystemHealthItem): string {
    const titles: Record<string, string> = {
      HospitalDatabase: 'Database',
      Localization: 'Localization',
      Notifications: 'Notifications'
    };

    return titles[item.componentCode] ?? humanizeAction(item.componentCode);
  }

  protected healthDetail(item: SystemHealthItem): string {
    if (item.componentCode === 'HospitalDatabase') {
      return item.statusCode === 'HEALTHY' ? 'Healthy - connected successfully.' : 'Action required - hospital profile is missing.';
    }
    if (item.componentCode === 'Localization') {
      return item.statusCode === 'HEALTHY' ? 'Healthy - display resources are configured.' : 'Action required - localization resources are missing.';
    }
    if (item.componentCode === 'Notifications') {
      return item.statusCode === 'HEALTHY' ? 'Healthy - notification templates exist.' : 'Action required - templates are not configured.';
    }

    return this.t(item.messageKey);
  }

  protected healthAction(item: SystemHealthItem): { label: string; path: string } | null {
    if (item.statusCode === 'HEALTHY') {
      return null;
    }

    return item.componentCode === 'HospitalDatabase'
      ? { label: 'Open hospital', path: '/administration/hospital' }
      : { label: 'Configure', path: '/administration/system-configuration' };
  }

  protected activityHeight(value: number, items: ActivityTrendItem[]): number {
    const max = Math.max(...items.flatMap(item => this.activitySeries.map(series => Number(item[series.key]) || 0)), 1);
    return Math.max(value > 0 ? 14 : 4, Math.round((value / max) * 100));
  }

  protected loginDevice(login: RecentLoginItem): string {
    return login.machineName?.trim() || 'Browser session';
  }

  protected loginLocation(login: RecentLoginItem): string {
    return login.ipAddress?.trim() || 'Location unavailable';
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function clampDashboardDays(value: number): number {
  return Math.min(30, Math.max(1, Math.round(value)));
}

const recentLoginPageSize = 6;

const adminQuickActions: QuickAction[] = [
  { label: 'Add patient', path: '/patients', icon: 'person_add', tone: '#2563eb' },
  { label: 'Add doctor', path: '/doctors', icon: 'medical_services', tone: '#0f766e' },
  { label: 'Create appointment', path: '/appointments', icon: 'event_available', tone: '#7c3aed' },
  { label: 'Add user', path: '/administration/users', icon: 'manage_accounts', tone: '#0891b2' },
  { label: 'Add department', path: '/administration/departments', icon: 'business', tone: '#d97706' },
  { label: 'Configure notifications', path: '/administration/system-configuration', icon: 'notifications_active', tone: '#be123c' }
];

const activitySeries: ActivitySeries[] = [
  { label: 'Login activity', key: 'loginAttempts', tone: '#2563eb' },
  { label: 'Patient / record updates', key: 'recordUpdates', tone: '#0f766e' },
  { label: 'Security reviews', key: 'securityEvents', tone: '#d97706' }
];

const hospitalPulseItems: HospitalPulseItem[] = [
  {
    title: 'Digital front desks are becoming command centers',
    detail: 'Hospitals are moving reception, appointment, and billing signals into one operational view for faster daily decisions.',
    rows: [
      'Reception queues, appointment flow, and payments are best reviewed together.',
      'Front-office dashboards help teams act before waiting rooms become overloaded.',
      'Daily morning checks can surface missed follow-ups and pending bills.'
    ],
    region: 'Global',
    tag: 'Operations',
    icon: 'hub',
    tone: '#2563eb'
  },
  {
    title: 'Patient communication is shifting to automated journeys',
    detail: 'Appointment reminders, lab alerts, payment nudges, and discharge instructions work best when templates are ready before peak load.',
    rows: [
      'SMS, email, and WhatsApp templates reduce repeated manual calls.',
      'Reminder quality improves when language and department context are prepared.',
      'Discharge communication should continue after the patient leaves the hospital.'
    ],
    region: 'APAC',
    tag: 'Patient experience',
    icon: 'forum',
    tone: '#0f766e'
  },
  {
    title: 'Access reviews remain a high-value admin habit',
    detail: 'Short weekly checks of roles, failed sign-ins, and active sessions reduce avoidable support and compliance friction.',
    rows: [
      'Review inactive users and open sessions before weekly reporting.',
      'Failed sign-ins can reveal password friction or unauthorized attempts.',
      'Role cleanup keeps module access aligned with hospital responsibilities.'
    ],
    region: 'Global',
    tag: 'Security',
    icon: 'admin_panel_settings',
    tone: '#7c3aed'
  },
  {
    title: 'Care teams need sharper inventory visibility',
    detail: 'Low-stock signals, pharmacy movement, and expiry tracking are becoming core daily indicators for hospital resilience.',
    rows: [
      'Low-stock alerts should be visible before pharmacy counters are blocked.',
      'Expiry tracking protects patient safety and reduces avoidable write-offs.',
      'Fast-moving items deserve a daily reorder and consumption review.'
    ],
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
