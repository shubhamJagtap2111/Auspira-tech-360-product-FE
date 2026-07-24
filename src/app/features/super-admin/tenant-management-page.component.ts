import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { PlanManagementService } from './plan-management.service';
import {
  RegisterTenantRequest,
  TenantDetails,
  TenantListItem,
  TenantListResponse
} from './tenant-management.models';
import { TenantManagementService } from './tenant-management.service';

type TenantTab = 'list' | 'new' | 'provisioning' | 'tenant-status' | 'database-status' | 'domains' | 'licenses';

interface TenantTabItem {
  id: TenantTab;
  label: string;
  icon: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent],
  template: `
    <section class="tenant-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Tenant Management</p>
          <h1 class="ac-page-title">Hospitals Control Plane</h1>
          <p>Manage hospital onboarding, tenant status, domains, database versions, licenses, and operational jobs.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin" title="Open Super Admin dashboard">
            <span class="material-symbols-rounded">dashboard</span>
          </a>
          <button class="icon-btn" type="button" (click)="loadTenants()" title="Refresh hospitals">
            <span class="material-symbols-rounded">refresh</span>
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="activeTab.set('new')">
            <span class="material-symbols-rounded">add_business</span>
            New Hospital
          </button>
        </div>
      </header>

      <nav class="tenant-tabs" aria-label="Tenant management sections">
        @for (tab of tabs; track tab.id) {
          <button type="button" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
            <span class="material-symbols-rounded">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        }
      </nav>

      <section class="filter-bar">
        <label>
          <span>Search</span>
          <input name="searchText" [(ngModel)]="searchText" (keyup.enter)="loadTenants()" placeholder="Hospital, tenant code, database" />
        </label>
        <label>
          <span>Tenant Status</span>
          <ac-dropdown name="tenantStatus" [(ngModel)]="tenantStatus" [options]="tenantStatusOptions()" (selectionChange)="loadTenants()" />
        </label>
        <label>
          <span>License</span>
          <ac-dropdown name="licenseStatus" [(ngModel)]="licenseStatus" [options]="licenseStatusOptions()" (selectionChange)="loadTenants()" />
        </label>
        <label>
          <span>Database</span>
          <ac-dropdown name="databaseStatus" [(ngModel)]="databaseStatus" [options]="databaseStatusOptions()" (selectionChange)="loadTenants()" />
        </label>
        <button class="icon-btn" type="button" (click)="loadTenants()" title="Search hospitals">
          <span class="material-symbols-rounded">search</span>
        </button>
      </section>

      <section class="stat-grid">
        @for (stat of stats(); track stat.label) {
          <article class="stat" [style.--tone]="stat.tone">
            <span class="material-symbols-rounded">{{ stat.icon }}</span>
            <p>{{ stat.label }}</p>
            <strong>{{ stat.value }}</strong>
          </article>
        }
      </section>

      @if (activeTab() === 'new') {
        <section class="new-hospital">
          <form (ngSubmit)="registerHospital()">
            <div class="section-head">
              <div>
                <h2>New Hospital</h2>
                <p>Provision the tenant metadata, database record, default domain, and first hospital admin.</p>
              </div>
            </div>
            <div class="form-grid">
              <label>
                <span>Hospital Name</span>
                <input name="hospitalName" [(ngModel)]="newHospital.hospitalName" required />
              </label>
              <label>
                <span>Tenant Code</span>
                <input name="tenantCode" [(ngModel)]="newHospital.tenantCode" />
              </label>
              <label>
                <span>Admin First Name</span>
                <input name="firstName" [(ngModel)]="newHospital.firstName" required />
              </label>
              <label>
                <span>Admin Last Name</span>
                <input name="lastName" [(ngModel)]="newHospital.lastName" required />
              </label>
              <label>
                <span>Admin Email</span>
                <input type="email" name="email" [(ngModel)]="newHospital.email" required />
              </label>
              <label>
                <span>Mobile</span>
                <input name="mobileNo" [(ngModel)]="newHospital.mobileNo" />
              </label>
              <label>
                <span>Password</span>
                <input type="password" name="password" [(ngModel)]="newHospital.password" required />
              </label>
              <label>
                <span>Time Zone</span>
                <input name="timeZone" [(ngModel)]="newHospital.timeZone" />
              </label>
            </div>
            <div class="form-actions">
              <button class="ac-btn ac-btn-secondary" type="button" (click)="resetNewHospital()">Reset</button>
              <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">
                <span class="material-symbols-rounded">add_business</span>
                Create Hospital
              </button>
            </div>
          </form>
        </section>
      } @else {
        <section class="workspace-grid">
          <div class="table-panel">
            <table>
              <thead>
                <tr>
                  <th>Hospital Name</th>
                  <th>Tenant Code</th>
                  <th>Database</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>License</th>
                  <th>Version</th>
                  <th>Storage</th>
                  <th>Users</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (tenant of tenants(); track tenant.tenantId) {
                  <tr [class.selected]="selectedTenantCode() === tenant.tenantCode">
                    <td>
                      <button class="tenant-link" type="button" (click)="openTenant(tenant)">
                        <strong>{{ tenant.hospitalName }}</strong>
                        <span>{{ tenant.databaseServerKey }}</span>
                      </button>
                    </td>
                    <td><code>{{ tenant.tenantCode }}</code></td>
                    <td>{{ tenant.databaseName }}</td>
                    <td>{{ tenant.planCode }}</td>
                    <td><span class="pill" [class]="statusClass(tenant.tenantStatus)">{{ tenant.tenantStatus }}</span></td>
                    <td><span class="pill" [class]="statusClass(tenant.licenseStatus)">{{ tenant.licenseStatus }}</span></td>
                    <td>{{ tenant.schemaVersion }}</td>
                    <td>{{ tenant.storageGb | number:'1.1-2' }} GB</td>
                    <td>{{ tenant.userCount | number }}</td>
                    <td>{{ tenant.createdAt | date:'mediumDate' }}</td>
                    <td>
                      <div class="row-actions">
                        <button class="icon-btn" type="button" (click)="openTenant(tenant)" title="Open">
                          <span class="material-symbols-rounded">open_in_new</span>
                        </button>
                        <button class="icon-btn warn" type="button" (click)="updateTenantStatus(tenant, 'Suspended')" title="Suspend">
                          <span class="material-symbols-rounded">pause_circle</span>
                        </button>
                        <button class="icon-btn ok" type="button" (click)="updateTenantStatus(tenant, 'Active')" title="Activate">
                          <span class="material-symbols-rounded">check_circle</span>
                        </button>
                        <button class="icon-btn danger" type="button" (click)="archiveTenant(tenant)" title="Delete">
                          <span class="material-symbols-rounded">delete</span>
                        </button>
                        <button class="icon-btn" type="button" (click)="upgradeTenant(tenant)" title="Upgrade">
                          <span class="material-symbols-rounded">workspace_premium</span>
                        </button>
                        <button class="icon-btn" type="button" (click)="queueJob(tenant, 'BACKUP')" title="Backup">
                          <span class="material-symbols-rounded">backup</span>
                        </button>
                        <button class="icon-btn" type="button" (click)="queueJob(tenant, 'PROVISION')" title="Provision">
                          <span class="material-symbols-rounded">deployed_code</span>
                        </button>
                        <button class="icon-btn" type="button" (click)="queueJob(tenant, 'MIGRATION')" title="Migration">
                          <span class="material-symbols-rounded">sync_alt</span>
                        </button>
                        <button class="icon-btn" type="button" (click)="viewLogs(tenant)" title="View Logs">
                          <span class="material-symbols-rounded">history</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="11" class="empty">No hospitals found.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <aside class="detail-panel">
            @if (selectedDetails(); as details) {
              <div class="section-head compact">
                <div>
                  <h2>{{ details.summary.hospitalName }}</h2>
                  <p>{{ details.summary.tenantCode }} | {{ details.summary.databaseName }}</p>
                </div>
                <span class="pill" [class]="statusClass(details.summary.tenantStatus)">{{ details.summary.tenantStatus }}</span>
              </div>

              <div class="quick-actions">
                <label>
                  <span>Plan</span>
                  <ac-dropdown name="selectedPlan" [(ngModel)]="selectedPlan" [options]="planDropdownOptions()" />
                </label>
                <label>
                  <span>Reason</span>
                  <input name="actionReason" [(ngModel)]="actionReason" />
                </label>
                <button class="icon-btn" type="button" (click)="upgradeTenant(details.summary)" title="Upgrade">
                  <span class="material-symbols-rounded">workspace_premium</span>
                </button>
              </div>

              @if (activeTab() === 'list') {
                <div class="detail-grid">
                  <div><span>Database</span><strong>{{ details.summary.databaseName }}</strong></div>
                  <div><span>Database Status</span><strong>{{ details.summary.databaseStatus }}</strong></div>
                  <div><span>License</span><strong>{{ details.summary.licenseStatus }}</strong></div>
                  <div><span>Version</span><strong>{{ details.summary.schemaVersion }}</strong></div>
                  <div><span>Storage</span><strong>{{ details.summary.storageGb | number:'1.1-2' }} GB</strong></div>
                  <div><span>Users</span><strong>{{ details.summary.userCount | number }}</strong></div>
                </div>
              }

              @if (activeTab() === 'provisioning') {
                <div class="button-row">
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="queueJob(details.summary, 'PROVISION')">
                    <span class="material-symbols-rounded">deployed_code</span>
                    Provision
                  </button>
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="queueJob(details.summary, 'MIGRATION')">
                    <span class="material-symbols-rounded">sync_alt</span>
                    Migration
                  </button>
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="queueJob(details.summary, 'BACKUP')">
                    <span class="material-symbols-rounded">backup</span>
                    Backup
                  </button>
                </div>
                <div class="timeline">
                  @for (job of details.provisionJobs; track job.jobId) {
                    <div class="timeline-row">
                      <span class="material-symbols-rounded">{{ jobIcon(job.jobType) }}</span>
                      <div>
                        <strong>{{ job.jobType }} | {{ job.status }}</strong>
                        <p>{{ job.message || 'Queued by ' + job.requestedBy }}</p>
                      </div>
                      <time>{{ job.createdAt | date:'short' }}</time>
                    </div>
                  } @empty {
                    <p class="empty">No provisioning jobs for this tenant.</p>
                  }
                </div>
                <h3>Activity Logs</h3>
                <div class="timeline">
                  @for (log of details.activityLogs; track log.activityLogId) {
                    <div class="timeline-row">
                      <span class="material-symbols-rounded">history</span>
                      <div>
                        <strong>{{ log.title }}</strong>
                        <p>{{ log.description }}</p>
                      </div>
                      <time>{{ log.createdAt | date:'short' }}</time>
                    </div>
                  } @empty {
                    <p class="empty">No activity logs for this tenant.</p>
                  }
                </div>
              }

              @if (activeTab() === 'tenant-status') {
                <div class="status-actions">
                  @for (status of statusOptions; track status) {
                    <button type="button" [class.active]="details.summary.tenantStatus === status" (click)="updateTenantStatus(details.summary, status)">
                      {{ status }}
                    </button>
                  }
                </div>
              }

              @if (activeTab() === 'database-status') {
                <div class="version-list">
                  @for (version of details.databaseVersions; track version.databaseVersionId) {
                    <div class="version-row">
                      <div>
                        <strong>{{ version.databaseName }}</strong>
                        <p>{{ version.schemaVersion }} | {{ version.migrationStatus }}</p>
                      </div>
                      <span>{{ version.storageGb | number:'1.1-2' }} GB</span>
                      <time>{{ version.updatedAt | date:'short' }}</time>
                    </div>
                  } @empty {
                    <p class="empty">No database version rows for this tenant.</p>
                  }
                </div>
              }

              @if (activeTab() === 'domains') {
                <div class="domain-list">
                  @for (domain of details.domains; track domain.domainId) {
                    <div class="domain-row">
                      <span class="material-symbols-rounded">{{ domain.isPrimary ? 'home_pin' : 'language' }}</span>
                      <div>
                        <strong>{{ domain.domainName }}</strong>
                        <p>{{ domain.domainType }} | {{ domain.verificationStatus }}</p>
                      </div>
                    </div>
                  } @empty {
                    <p class="empty">No domains configured.</p>
                  }
                </div>
              }

              @if (activeTab() === 'licenses') {
                <div class="license-panel">
                  <span class="material-symbols-rounded">workspace_premium</span>
                  <div>
                    <strong>{{ details.summary.licenseStatus }}</strong>
                    <p>{{ details.summary.planCode }} plan | {{ details.summary.userCount | number }} users | {{ details.summary.storageGb | number:'1.1-2' }} GB storage</p>
                  </div>
                </div>
              }
            } @else {
              <p class="empty">Select a hospital to inspect tenant operations.</p>
            }
          </aside>
        </section>
      }
    </section>
  `,
  styles: `
    .tenant-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .section-head, .head-actions, .filter-bar, .row-actions, .quick-actions, .form-actions, .button-row { display: flex; gap: 12px; }
    .page-head, .section-head { align-items: flex-start; justify-content: space-between; }
    .page-head p:not(.eyebrow), .section-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; max-width: 860px; }
    .eyebrow { margin: 0 0 4px; color: var(--ac-primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .head-actions { align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .tenant-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
    .tenant-tabs button, .status-actions button { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text-2); font-weight: 800; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; }
    .tenant-tabs button.active, .status-actions button.active { border-color: var(--ac-primary); color: var(--ac-primary); background: var(--ac-primary-light); }
    .tenant-tabs .material-symbols-rounded, .ac-btn .material-symbols-rounded { font-size: 18px; }
    .filter-bar, .new-hospital, .table-panel, .detail-panel, .stat, .timeline-row, .version-row, .domain-row, .license-panel { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); }
    .filter-bar { align-items: end; padding: 14px; }
    .filter-bar label, .quick-actions label { min-width: 160px; flex: 1; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    input, select { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; min-width: 0; }
    input:focus, select:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .icon-btn { width: 38px; height: 38px; min-width: 38px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); display: inline-grid; place-items: center; cursor: pointer; text-decoration: none; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .icon-btn.warn:hover { border-color: var(--ac-warning); color: var(--ac-warning-text); }
    .icon-btn.ok:hover { border-color: var(--ac-success); color: var(--ac-success-text); }
    .icon-btn.danger:hover { border-color: var(--ac-error); color: var(--ac-error); }
    .stat-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    .stat { min-height: 104px; padding: 12px; border-top: 3px solid var(--tone); display: flex; flex-direction: column; gap: 4px; }
    .stat .material-symbols-rounded { color: var(--tone); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .stat strong { font-size: 22px; line-height: 1.1; }
    .new-hospital { padding: 16px; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .form-actions { justify-content: flex-end; margin-top: 14px; }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 420px); gap: 16px; align-items: start; }
    .table-panel { overflow: auto; }
    table { width: 100%; min-width: 1320px; border-collapse: collapse; }
    th, td { padding: 11px 12px; border-bottom: 1px solid var(--ac-border); text-align: left; vertical-align: middle; font-size: 13px; }
    th { color: var(--ac-muted); background: var(--ac-bg); font-size: 11px; text-transform: uppercase; }
    tr.selected td { background: rgba(37,99,235,.06); }
    .tenant-link { border: 0; background: transparent; color: var(--ac-text); text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 3px; padding: 0; }
    .tenant-link span, code { color: var(--ac-muted); font-size: 12px; }
    code { background: var(--ac-bg); border-radius: 6px; padding: 3px 6px; }
    .row-actions { align-items: center; min-width: 368px; }
    .row-actions .icon-btn { width: 32px; height: 32px; min-width: 32px; }
    .row-actions .material-symbols-rounded { font-size: 17px; }
    .pill { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 999px; background: rgba(100,116,139,.12); color: #475569; font-size: 11px; font-weight: 900; white-space: nowrap; }
    .pill.active, .pill.live, .pill.healthy, .pill.valid { background: rgba(22,163,74,.12); color: #15803d; }
    .pill.trial, .pill.pending, .pill.warning { background: rgba(217,119,6,.12); color: #b45309; }
    .pill.suspended, .pill.expired, .pill.failed, .pill.archived { background: rgba(220,38,38,.1); color: #b91c1c; }
    .detail-panel { padding: 16px; position: sticky; top: 12px; }
    .section-head.compact h2 { margin: 0; font-size: 17px; }
    .quick-actions { align-items: end; margin-top: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--ac-border); }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .detail-grid div { min-height: 72px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 5px; }
    .detail-grid span { color: var(--ac-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .detail-grid strong { font-size: 14px; word-break: break-word; }
    .button-row, .status-actions { margin-top: 14px; flex-wrap: wrap; }
    .timeline, .version-list, .domain-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
    h3 { margin: 18px 0 0; font-size: 14px; }
    .timeline-row, .version-row, .domain-row, .license-panel { padding: 10px; display: flex; gap: 10px; align-items: center; }
    .timeline-row .material-symbols-rounded, .domain-row .material-symbols-rounded, .license-panel .material-symbols-rounded { color: var(--ac-primary); }
    .timeline-row p, .version-row p, .domain-row p, .license-panel p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .timeline-row time, .version-row time { margin-left: auto; color: var(--ac-muted); font-size: 12px; white-space: nowrap; }
    .version-row span { margin-left: auto; font-weight: 800; white-space: nowrap; }
    .license-panel { margin-top: 14px; }
    .empty { margin: 0; padding: 24px; color: var(--ac-muted); text-align: center; font-size: 13px; }
    @media (max-width: 1320px) { .stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .workspace-grid { grid-template-columns: 1fr; } .detail-panel { position: static; } }
    @media (max-width: 760px) { .page-head, .filter-bar, .head-actions, .quick-actions { flex-direction: column; align-items: stretch; } .form-grid, .stat-grid, .detail-grid { grid-template-columns: 1fr; } .row-actions { min-width: 348px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenantManagementPageComponent implements OnInit {
  protected readonly tabs: TenantTabItem[] = [
    { id: 'list', label: 'Hospital List', icon: 'local_hospital' },
    { id: 'new', label: 'New Hospital', icon: 'add_business' },
    { id: 'provisioning', label: 'Provisioning', icon: 'deployed_code' },
    { id: 'tenant-status', label: 'Tenant Status', icon: 'toggle_on' },
    { id: 'database-status', label: 'Database Status', icon: 'database' },
    { id: 'domains', label: 'Domains', icon: 'language' },
    { id: 'licenses', label: 'Licenses', icon: 'workspace_premium' }
  ];
  protected readonly statusOptions = ['Trial', 'Live', 'Active', 'Suspended', 'Expired', 'Inactive', 'Archived'];
  protected readonly licenseOptions = ['Trial', 'Active', 'Expired', 'Suspended'];
  protected readonly databaseOptions = ['Healthy', 'Provisioning', 'MigrationPending', 'Warning', 'Failed'];
  protected readonly planOptions = signal<string[]>([]);

  protected readonly activeTab = signal<TenantTab>('list');
  protected readonly tenants = signal<TenantListItem[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly selectedDetails = signal<TenantDetails | null>(null);
  protected readonly selectedTenantCode = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected searchText = '';
  protected tenantStatus = '';
  protected licenseStatus = '';
  protected databaseStatus = '';
  protected selectedPlan = '';
  protected actionReason = '';
  protected newHospital: RegisterTenantRequest = createHospitalForm();

  protected readonly stats = computed(() => {
    const rows = this.tenants();
    return [
      { label: 'Hospitals', value: this.totalCount().toLocaleString(), icon: 'local_hospital', tone: '#2563eb' },
      { label: 'Active', value: rows.filter(row => ['ACTIVE', 'LIVE'].includes(row.tenantStatus.toUpperCase())).length.toLocaleString(), icon: 'verified', tone: '#15803d' },
      { label: 'Trial', value: rows.filter(row => row.tenantStatus.toUpperCase() === 'TRIAL').length.toLocaleString(), icon: 'hourglass_top', tone: '#b45309' },
      { label: 'Expired', value: rows.filter(row => row.tenantStatus.toUpperCase() === 'EXPIRED').length.toLocaleString(), icon: 'event_busy', tone: '#b91c1c' },
      { label: 'Databases', value: rows.filter(row => row.databaseStatus.toUpperCase() === 'HEALTHY').length.toLocaleString(), icon: 'database', tone: '#0f766e' },
      { label: 'Users', value: rows.reduce((total, row) => total + row.userCount, 0).toLocaleString(), icon: 'groups', tone: '#0891b2' }
    ];
  });

  private readonly service = inject(TenantManagementService);
  private readonly planService = inject(PlanManagementService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly newHospitalBaseline = JSON.stringify(createHospitalForm());

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadPlanOptions(), this.loadTenants()]);
  }

  protected tenantStatusOptions() {
    return [{ label: 'All', value: '' }, ...this.statusOptions.map(status => ({ label: status, value: status }))];
  }

  protected licenseStatusOptions() {
    return [{ label: 'All', value: '' }, ...this.licenseOptions.map(status => ({ label: status, value: status }))];
  }

  protected databaseStatusOptions() {
    return [{ label: 'All', value: '' }, ...this.databaseOptions.map(status => ({ label: status, value: status }))];
  }

  protected planDropdownOptions() {
    return this.planOptions().map(plan => ({ label: plan, value: plan }));
  }

  protected async loadPlanOptions(): Promise<void> {
    const response = await this.planService.getCatalog();
    if (response.success && response.data) {
      const codes = response.data.plans.filter(plan => plan.isActive).map(plan => plan.code);
      this.planOptions.set(codes);
      this.selectedPlan = codes[0] ?? '';
    }
  }

  protected async loadTenants(): Promise<void> {
    const response = await this.service.searchTenants({
      searchText: this.searchText.trim(),
      tenantStatus: this.tenantStatus,
      licenseStatus: this.licenseStatus,
      databaseStatus: this.databaseStatus,
      pageNumber: 1,
      pageSize: 50
    });
    this.applyTenantList(response);
  }

  protected async openTenant(tenant: TenantListItem): Promise<void> {
    this.selectedTenantCode.set(tenant.tenantCode);
    const response = await this.service.getTenant(tenant.tenantCode);
    if (response.success && response.data) {
      this.selectedDetails.set(response.data);
      this.selectedPlan = response.data.summary.planCode || this.selectedPlan || this.planOptions()[0] || '';
      return;
    }

    this.toast.error(response.message || 'Could not open tenant');
  }

  protected async registerHospital(): Promise<void> {
    if (!this.newHospital.hospitalName.trim() || !this.newHospital.email.trim() || !this.newHospital.password.trim()) {
      this.toast.error('Hospital name, admin email, and password are required.');
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.service.registerHospital({
        ...this.newHospital,
        tenantCode: this.newHospital.tenantCode?.trim() || null,
        mobileNo: this.newHospital.mobileNo?.trim() || null,
        timeZone: this.newHospital.timeZone?.trim() || null
      });

      if (!response.success || !response.data) {
        this.toast.error(response.message || 'Could not create hospital');
        return;
      }

      this.toast.success('Hospital tenant created.');
      const tenantCode = response.data.tenantCode;
      this.resetNewHospital();
      this.activeTab.set('list');
      await this.loadTenants();
      const created = this.tenants().find(tenant => tenant.tenantCode === tenantCode);
      if (created) {
        await this.openTenant(created);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected resetNewHospital(): void {
    this.newHospital = createHospitalForm();
  }

  protected async updateTenantStatus(tenant: TenantListItem, status: string): Promise<void> {
    const response = await this.service.updateStatus(tenant.tenantCode, {
      status,
      reason: this.actionReason.trim() || null
    });
    await this.applyDetailsResponse(response, `${tenant.hospitalName} marked ${status}.`);
  }

  protected async archiveTenant(tenant: TenantListItem): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Archive hospital?',
      message: `Archive ${tenant.hospitalName}?`,
      details: 'This moves the hospital out of active operations. You can still review its audit and tenant history later.',
      confirmText: 'Archive hospital',
      cancelText: 'Keep active',
      intent: 'danger',
      icon: 'archive'
    });

    if (!confirmed) {
      return;
    }

    await this.updateTenantStatus(tenant, 'Archived');
  }

  hasUnsavedChanges(): boolean {
    return JSON.stringify(this.newHospital) !== this.newHospitalBaseline || !!this.actionReason.trim();
  }

  unsavedChangesMessage(): string {
    return 'Your hospital form or action reason has changes that have not been saved.';
  }

  protected async upgradeTenant(tenant: TenantListItem): Promise<void> {
    const response = await this.service.upgradePlan(tenant.tenantCode, {
      planCode: this.selectedPlan || tenant.planCode,
      reason: this.actionReason.trim() || null
    });
    await this.applyDetailsResponse(response, `${tenant.hospitalName} upgraded to ${this.selectedPlan || tenant.planCode}.`);
  }

  protected async queueJob(tenant: TenantListItem, jobType: string): Promise<void> {
    const response = await this.service.queueJob(tenant.tenantCode, {
      jobType,
      message: this.actionReason.trim() || `${jobType} requested from Super Admin`
    });
    await this.applyDetailsResponse(response, `${jobType} job queued for ${tenant.hospitalName}.`);
    this.activeTab.set('provisioning');
  }

  protected async viewLogs(tenant: TenantListItem): Promise<void> {
    if (this.selectedTenantCode() !== tenant.tenantCode) {
      await this.openTenant(tenant);
    }

    const response = await this.service.getLogs(tenant.tenantCode);
    if (response.success && response.data && this.selectedDetails()) {
      this.selectedDetails.update(details => details ? { ...details, activityLogs: response.data ?? [] } : details);
    }

    this.activeTab.set('provisioning');
  }

  protected statusClass(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  protected jobIcon(jobType: string): string {
    const normalized = jobType.toUpperCase();
    if (normalized.includes('BACKUP')) {
      return 'backup';
    }

    if (normalized.includes('MIGRATION')) {
      return 'sync_alt';
    }

    return 'deployed_code';
  }

  private applyTenantList(response: { success: boolean; message: string; data: TenantListResponse | null }): void {
    if (response.success && response.data) {
      this.tenants.set(response.data.items);
      this.totalCount.set(response.data.totalCount);
      const selectedCode = this.selectedTenantCode();
      if (!selectedCode && response.data.items.length > 0) {
        void this.openTenant(response.data.items[0]);
      }
      return;
    }

    this.toast.error(response.message || 'Could not load hospitals');
  }

  private async applyDetailsResponse(response: { success: boolean; message: string; data: TenantDetails | null }, successMessage: string): Promise<void> {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Tenant action failed');
      return;
    }

    this.toast.success(successMessage);
    this.selectedDetails.set(response.data);
    this.selectedTenantCode.set(response.data.summary.tenantCode);
    this.actionReason = '';
    await this.loadTenants();
  }
}

function createHospitalForm(): RegisterTenantRequest {
  return {
    hospitalName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    tenantCode: '',
    mobileNo: '',
    timeZone: 'Asia/Kolkata'
  };
}
