import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AcDropdownComponent } from '../../../shared/ui/dropdown/dropdown.component';
import { AcAdminDrawerComponent } from '../../../shared/ui/admin-drawer/admin-drawer.component';
import { PermissionMatrixRow, RoleDto } from './rbac.models';
import { RbacService } from './rbac.service';

interface PermissionModuleGroup {
  moduleName: string;
  moduleKey: string;
  rows: PermissionMatrixRow[];
  assignedCount: number;
  totalCount: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcAdminDrawerComponent],
  template: `
    <section class="matrix-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Rbac.Matrix.Title') }}</h1>
          <p>Simple view of what each role can access.</p>
        </div>
        <button class="icon-btn" type="button" (click)="loadMatrix()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </header>

      <section class="summary-grid">
        <article>
          <span class="material-symbols-rounded">admin_panel_settings</span>
          <div>
            <strong>{{ visibleRoleCount() }}</strong>
            <p>Roles shown</p>
          </div>
        </article>
        <article>
          <span class="material-symbols-rounded">widgets</span>
          <div>
            <strong>{{ moduleGroups().length }}</strong>
            <p>Modules</p>
          </div>
        </article>
        <article>
          <span class="material-symbols-rounded">check_circle</span>
          <div>
            <strong>{{ assignedCount() }}</strong>
            <p>Assigned access</p>
          </div>
        </article>
        <article>
          <span class="material-symbols-rounded">radio_button_unchecked</span>
          <div>
            <strong>{{ unassignedCount() }}</strong>
            <p>Not assigned</p>
          </div>
        </article>
      </section>

      <section class="toolbar">
        <label>
          <span>Role</span>
          <ac-dropdown name="roleCode" [(ngModel)]="roleCode" [options]="roleOptions()" (selectionChange)="loadMatrix()" />
        </label>
        <label>
          <span>Search module or permission</span>
          <input name="searchText" [(ngModel)]="searchText" placeholder="Example: patients, create, billing" />
        </label>
        <label class="toggle-row">
          <input type="checkbox" name="showAssignedOnly" [(ngModel)]="showAssignedOnly" />
          <span>Show assigned only</span>
        </label>
      </section>

      <section class="permission-board">
        @for (group of moduleGroups(); track group.moduleKey) {
          <article class="module-card">
            <header>
              <div>
                <h2>{{ group.moduleName }}</h2>
                <p>{{ group.assignedCount }} of {{ group.totalCount }} permissions assigned</p>
              </div>
              <span>{{ group.rows.length }}</span>
            </header>

            <div class="permission-list">
              @for (row of group.rows; track row.roleCode + row.permissionCode) {
                <button class="permission-row" type="button" [class.unassigned]="!row.isAssigned" (click)="selectRow(row)">
                  <span class="state-icon material-symbols-rounded">{{ row.isAssigned ? 'check_circle' : 'radio_button_unchecked' }}</span>
                  <div>
                    <strong>{{ permissionActionLabel(row) }}</strong>
                    <p>{{ t(row.roleNameKey) }} · {{ row.roleCode }}</p>
                  </div>
                  <span class="status" [class.inactive]="!row.isAssigned">
                    {{ row.isAssigned ? 'Allowed' : 'Not allowed' }}
                  </span>
                </button>
              }
            </div>
          </article>
        } @empty {
          <section class="empty-state">
            <span class="material-symbols-rounded">manage_search</span>
            <h2>No permissions found</h2>
            <p>Try another role or search term.</p>
          </section>
        }
      </section>

      @if (selectedRow(); as row) {
        <ac-admin-drawer
          [open]="!!selectedRow()"
          icon="rule"
          eyebrow="Permission detail"
          [title]="permissionActionLabel(row)"
          closeTitle="Close details"
          (closed)="closeDetails()">
            <span drawer-summary class="ac-admin-pill"><span class="material-symbols-rounded">admin_panel_settings</span>{{ t(row.roleNameKey) }}</span>
            <span drawer-summary class="ac-admin-pill"><span class="material-symbols-rounded">widgets</span>{{ permissionModuleLabel(row) }}</span>
            <span drawer-summary class="ac-admin-pill" [class.featured]="row.isAssigned"><span class="material-symbols-rounded">{{ row.isAssigned ? 'check_circle' : 'radio_button_unchecked' }}</span>{{ row.isAssigned ? 'Allowed' : 'Not allowed' }}</span>
            <div drawer-body class="ac-admin-drawer-content">
              <section class="ac-admin-form-section">
                <div class="ac-admin-section-title"><span class="material-symbols-rounded">badge</span><h3>Role access</h3></div>
                <div class="detail-grid">
                  <div><span>Role</span><strong>{{ t(row.roleNameKey) }}</strong><small>{{ row.roleCode }}</small></div>
                  <div><span>Status</span><strong>{{ row.isAssigned ? 'Allowed' : 'Not allowed' }}</strong></div>
                  <div><span>Module</span><strong>{{ permissionModuleLabel(row) }}</strong><small>{{ row.permissionCode }}</small></div>
                  <div><span>Scope</span><strong>{{ readableScope(row.dataScopeCode) }}</strong><small>{{ row.permissionTypeCode }}</small></div>
                </div>
              </section>
            </div>
            <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeDetails()">{{ t('Common.Actions.Cancel') }}</button>
        </ac-admin-drawer>
      }
    </section>
  `,
  styles: `
    .matrix-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .summary-grid article {
      min-height: 84px;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .summary-grid .material-symbols-rounded {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--ac-primary-light);
      color: var(--ac-primary);
      font-size: 22px;
    }
    .summary-grid strong { display: block; color: var(--ac-text); font-size: 22px; line-height: 1.1; }
    .summary-grid p { margin: 4px 0 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(220px, .6fr) minmax(280px, 1fr) auto;
      align-items: end;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--ac-border);
      background: var(--ac-surface);
      border-radius: 8px;
      box-shadow: var(--ac-sh-sm);
    }
    label { min-width: 0; display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    input { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    input:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .toggle-row {
      min-height: 38px;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface-2);
      white-space: nowrap;
    }
    .toggle-row input { width: 16px; height: 16px; }
    .permission-board { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
    .module-card {
      min-width: 0;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
      overflow: hidden;
    }
    .module-card header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--ac-border);
      background: var(--ac-surface-2);
    }
    .module-card h2 { margin: 0; color: var(--ac-text); font-size: 15px; }
    .module-card p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .module-card header > span {
      min-width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: var(--ac-primary-light);
      color: var(--ac-primary);
      font-size: 12px;
      font-weight: 900;
    }
    .permission-list { display: grid; gap: 8px; padding: 12px; }
    .permission-row {
      width: 100%;
      min-height: 54px;
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      color: var(--ac-text);
      text-align: left;
      cursor: pointer;
    }
    .permission-row:hover { border-color: var(--ac-primary); box-shadow: 0 8px 20px rgba(37,99,235,.08); }
    .permission-row.unassigned { background: color-mix(in srgb, var(--ac-surface-2) 62%, var(--ac-surface)); }
    .state-icon { color: #16a34a; font-size: 22px; }
    .permission-row.unassigned .state-icon { color: #94a3b8; }
    .permission-row strong, .permission-row p { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .permission-row strong { font-size: 13px; line-height: 1.2; }
    .permission-row p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .status { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 900; white-space: nowrap; }
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .empty-state {
      min-height: 240px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      grid-column: 1 / -1;
      border: 1px dashed var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      text-align: center;
      color: var(--ac-muted);
    }
    .empty-state .material-symbols-rounded { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 8px; background: var(--ac-primary-light); color: var(--ac-primary); font-size: 28px; }
    .empty-state h2 { margin: 0; color: var(--ac-text); font-size: 16px; }
    .empty-state p { margin: 0; font-size: 13px; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .detail-grid div { min-height: 76px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; background: var(--ac-bg); display: flex; flex-direction: column; gap: 4px; }
    .detail-grid span { color: var(--ac-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .detail-grid strong { color: var(--ac-text); font-size: 13px; }
    .detail-grid small { color: var(--ac-muted); word-break: break-word; }
    @media (max-width: 1280px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .permission-board { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .page-head { flex-direction: column; } .toolbar, .summary-grid { grid-template-columns: 1fr; } .toggle-row { justify-content: flex-start; } .permission-row { grid-template-columns: 28px minmax(0, 1fr); } .permission-row .status { grid-column: 2; justify-self: start; } .detail-grid { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionMatrixPageComponent implements OnInit {
  private readonly service = inject(RbacService);
  private readonly i18n = inject(I18nService);

  protected roleCode = '';
  protected searchText = '';
  protected showAssignedOnly = true;
  protected readonly roles = signal<RoleDto[]>([]);
  protected readonly rows = signal<PermissionMatrixRow[]>([]);
  protected readonly selectedRow = signal<PermissionMatrixRow | null>(null);
  protected readonly searchedRows = computed(() => this.createSearchedRows());
  protected readonly visibleRows = computed(() => this.createVisibleRows());
  protected readonly moduleGroups = computed(() => this.createModuleGroups());
  protected readonly assignedCount = computed(() => this.searchedRows().filter(row => row.isAssigned).length);
  protected readonly unassignedCount = computed(() => this.searchedRows().filter(row => !row.isAssigned).length);
  protected readonly visibleRoleCount = computed(() => new Set(this.visibleRows().map(row => row.roleCode)).size);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadRoles(), this.loadMatrix()]);
  }

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected roleOptions() {
    return [
      { label: this.t('Administration.Rbac.Filter.AllRoles'), value: '' },
      ...this.roles().map(role => ({ label: this.t(role.roleNameKey), value: role.roleCode }))
    ];
  }

  protected async loadRoles(): Promise<void> {
    const response = await this.service.getRoles();
    if (response.success && response.data) {
      this.roles.set(response.data);
    }
  }

  protected async loadMatrix(): Promise<void> {
    const response = await this.service.getPermissionMatrix(this.roleCode || undefined);
    if (response.success && response.data) {
      this.rows.set(response.data);
      this.selectedRow.set(null);
    }
  }

  protected selectRow(row: PermissionMatrixRow): void {
    this.selectedRow.set(row);
  }

  protected closeDetails(): void {
    this.selectedRow.set(null);
  }

  protected permissionModuleLabel(row: PermissionMatrixRow): string {
    const token = row.permissionCode.split('.')[0] || row.menuCode || row.groupCode || row.categoryCode;
    return permissionModuleOverrides[token] ?? humanizeToken(token);
  }

  protected permissionActionLabel(row: PermissionMatrixRow): string {
    const parts = row.permissionCode.split('.');
    const action = parts[parts.length - 1] || row.actionCode || row.permissionCode;
    return permissionActionOverrides[action.toLowerCase()] ?? humanizeToken(action);
  }

  protected readableScope(scopeCode: string): string {
    return permissionScopeOverrides[scopeCode.toUpperCase()] ?? humanizeToken(scopeCode);
  }

  private createSearchedRows(): PermissionMatrixRow[] {
    const search = this.searchText.trim().toLowerCase();
    return [...this.rows()]
      .filter(row => !search || this.rowSearchText(row).includes(search))
      .sort((left, right) =>
        this.t(left.roleNameKey).localeCompare(this.t(right.roleNameKey))
        || this.permissionModuleLabel(left).localeCompare(this.permissionModuleLabel(right))
        || actionSortValue(left).localeCompare(actionSortValue(right))
        || left.permissionCode.localeCompare(right.permissionCode));
  }

  private createVisibleRows(): PermissionMatrixRow[] {
    return this.searchedRows().filter(row => !this.showAssignedOnly || row.isAssigned);
  }

  private createModuleGroups(): PermissionModuleGroup[] {
    const groups = new Map<string, PermissionModuleGroup>();
    for (const row of this.searchedRows()) {
      const moduleName = this.permissionModuleLabel(row);
      const moduleKey = moduleName.toLowerCase();
      const group = groups.get(moduleKey) ?? { moduleName, moduleKey, rows: [], assignedCount: 0, totalCount: 0 };
      group.totalCount += 1;
      if (row.isAssigned) {
        group.assignedCount += 1;
      }
      groups.set(moduleKey, group);
    }

    for (const row of this.visibleRows()) {
      const moduleKey = this.permissionModuleLabel(row).toLowerCase();
      groups.get(moduleKey)?.rows.push(row);
    }

    return Array.from(groups.values())
      .filter(group => group.rows.length > 0)
      .map(group => ({
        ...group,
        rows: group.rows.sort((left, right) =>
          this.t(left.roleNameKey).localeCompare(this.t(right.roleNameKey))
          || actionSortValue(left).localeCompare(actionSortValue(right))
          || left.permissionCode.localeCompare(right.permissionCode))
      }))
      .sort((left, right) => left.moduleName.localeCompare(right.moduleName));
  }

  private rowSearchText(row: PermissionMatrixRow): string {
    return [
      this.t(row.roleNameKey),
      row.roleCode,
      this.permissionModuleLabel(row),
      this.permissionActionLabel(row),
      row.permissionCode,
      this.readableScope(row.dataScopeCode)
    ].join(' ').toLowerCase();
  }
}

const permissionModuleOverrides: Record<string, string> = {
  Administration: 'Administration',
  Appointments: 'Appointments',
  Billing: 'Billing',
  Branch: 'Branches',
  Branches: 'Branches',
  Dashboard: 'Dashboard',
  Department: 'Departments',
  Departments: 'Departments',
  Designation: 'Designations',
  Designations: 'Designations',
  Doctors: 'Doctors',
  Emergency: 'Emergency',
  Hospital: 'Hospital Management',
  Inventory: 'Inventory',
  Ipd: 'IPD',
  Laboratory: 'Laboratory',
  Menus: 'Menus',
  Opd: 'OPD',
  Patients: 'Patients',
  Permissions: 'Permissions',
  Pharmacy: 'Pharmacy',
  Reports: 'Reports & Insights',
  Roles: 'Roles',
  SystemConfiguration: 'System Configuration',
  UserManagement: 'User Management',
  Users: 'Users'
};

const permissionActionOverrides: Record<string, string> = {
  assignpermissions: 'Assign permissions',
  assignroles: 'Assign roles',
  copy: 'Copy',
  create: 'Create',
  delete: 'Delete',
  edit: 'Edit',
  export: 'Export',
  import: 'Import',
  manage: 'Manage',
  resetpassword: 'Reset password',
  settings: 'Settings',
  subscription: 'Subscription',
  unlock: 'Unlock',
  view: 'View',
  viewaudit: 'View audit'
};

const permissionScopeOverrides: Record<string, string> = {
  GLOBAL: 'All hospitals',
  TENANT: 'This hospital',
  BRANCH: 'Selected branch',
  OWN: 'Own records'
};

const permissionActionOrder = [
  'view',
  'create',
  'edit',
  'manage',
  'assignroles',
  'assignpermissions',
  'settings',
  'subscription',
  'copy',
  'import',
  'export',
  'unlock',
  'resetpassword',
  'viewaudit',
  'delete'
];

function actionSortValue(row: PermissionMatrixRow): string {
  const parts = row.permissionCode.split('.');
  const action = (parts[parts.length - 1] || row.actionCode || row.permissionCode).toLowerCase();
  const index = permissionActionOrder.indexOf(action);
  return `${index === -1 ? 999 : index}`.padStart(3, '0');
}

function humanizeToken(value: string): string {
  return value
    .replace(/^Permission\./, '')
    .replace(/^Navigation\./, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}
