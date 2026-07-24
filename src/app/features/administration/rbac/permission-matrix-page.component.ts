import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AcDropdownComponent } from '../../../shared/ui/dropdown/dropdown.component';
import { PermissionMatrixRow, RoleDto } from './rbac.models';
import { RbacService } from './rbac.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent],
  template: `
    <section class="matrix-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Rbac.Matrix.Title') }}</h1>
          <p>{{ t('Administration.Rbac.Matrix.Subtitle') }}</p>
        </div>
        <button class="icon-btn" type="button" (click)="loadMatrix()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </header>

      <section class="toolbar">
        <label>
          <span>{{ t('Administration.Rbac.Columns.Role') }}</span>
          <ac-dropdown name="roleCode" [(ngModel)]="roleCode" [options]="roleOptions()" (selectionChange)="loadMatrix()" />
        </label>
        <label>
          <span>{{ t('Administration.Rbac.Columns.Permission') }}</span>
          <input name="searchText" [(ngModel)]="searchText" />
        </label>
      </section>

      <section class="ac-admin-layout" [class.drawer-open]="!!selectedRow()">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('Administration.Rbac.Columns.Role') }}</th>
              <th>{{ t('Administration.Rbac.Columns.Category') }}</th>
              <th>{{ t('Administration.Rbac.Columns.Group') }}</th>
              <th>{{ t('Administration.Rbac.Columns.Permission') }}</th>
              <th>{{ t('Administration.Rbac.Columns.Type') }}</th>
              <th>{{ t('Administration.Rbac.Columns.Scope') }}</th>
              <th>{{ t('Administration.Rbac.Columns.Assigned') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of filteredRows(); track row.roleCode + row.permissionCode) {
              <tr [class.selected]="selectedRow()?.roleCode === row.roleCode && selectedRow()?.permissionCode === row.permissionCode" (click)="selectRow(row)">
                <td>
                  <strong>{{ t(row.roleNameKey) }}</strong>
                  <span>{{ row.roleCode }}</span>
                </td>
                <td>{{ t(row.categoryNameKey) }}</td>
                <td>{{ t(row.groupNameKey) }}</td>
                <td>
                  <strong>{{ t(row.permissionNameKey) }}</strong>
                  <span>{{ row.permissionCode }}</span>
                </td>
                <td>{{ row.permissionTypeCode }}</td>
                <td>{{ row.dataScopeCode }}</td>
                <td>
                  <span class="status" [class.inactive]="!row.isAssigned">
                    {{ t(row.isAssigned ? 'Common.Labels.Yes' : 'Common.Labels.No') }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">{{ t('Administration.Rbac.Empty.Matrix') }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (selectedRow(); as row) {
        <aside class="ac-admin-drawer">
          <div class="ac-admin-drawer-head">
            <div class="ac-admin-drawer-title">
              <span class="ac-admin-drawer-icon material-symbols-rounded">rule</span>
              <div>
                <p>{{ t('Administration.Rbac.Columns.Permission') }}</p>
                <h2>{{ t(row.permissionNameKey) }}</h2>
              </div>
            </div>
            <button class="icon-btn" type="button" (click)="closeDetails()" title="Close details">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="ac-admin-drawer-summary">
            <span class="ac-admin-pill"><span class="material-symbols-rounded">admin_panel_settings</span>{{ row.roleCode }}</span>
            <span class="ac-admin-pill"><span class="material-symbols-rounded">category</span>{{ row.categoryCode }}</span>
            <span class="ac-admin-pill" [class.featured]="row.isAssigned"><span class="material-symbols-rounded">{{ row.isAssigned ? 'check_circle' : 'radio_button_unchecked' }}</span>{{ t(row.isAssigned ? 'Common.Labels.Yes' : 'Common.Labels.No') }}</span>
          </div>
          <div class="ac-admin-drawer-body">
            <section class="ac-admin-form-section">
              <div class="ac-admin-section-title"><span class="material-symbols-rounded">badge</span><h3>{{ t('Administration.Rbac.Columns.Role') }}</h3></div>
              <div class="detail-grid">
                <div><span>{{ t('Administration.Rbac.Columns.Role') }}</span><strong>{{ t(row.roleNameKey) }}</strong><small>{{ row.roleCode }}</small></div>
                <div><span>{{ t('Administration.Rbac.Columns.Assigned') }}</span><strong>{{ t(row.isAssigned ? 'Common.Labels.Yes' : 'Common.Labels.No') }}</strong></div>
              </div>
            </section>
            <section class="ac-admin-form-section">
              <div class="ac-admin-section-title"><span class="material-symbols-rounded">account_tree</span><h3>{{ t('Administration.Rbac.Columns.Permission') }}</h3></div>
              <div class="detail-grid">
                <div><span>{{ t('Administration.Rbac.Columns.Permission') }}</span><strong>{{ t(row.permissionNameKey) }}</strong><small>{{ row.permissionCode }}</small></div>
                <div><span>{{ t('Administration.Rbac.Columns.Category') }}</span><strong>{{ t(row.categoryNameKey) }}</strong><small>{{ row.categoryCode }}</small></div>
                <div><span>{{ t('Administration.Rbac.Columns.Group') }}</span><strong>{{ t(row.groupNameKey) }}</strong><small>{{ row.groupCode }}</small></div>
                <div><span>{{ t('Administration.Rbac.Columns.Type') }}</span><strong>{{ row.permissionTypeCode }}</strong><small>{{ row.dataScopeCode }}</small></div>
              </div>
            </section>
          </div>
          <div class="ac-admin-drawer-actions">
            <button class="ac-btn ac-btn-secondary" type="button" (click)="closeDetails()">{{ t('Common.Actions.Cancel') }}</button>
          </div>
        </aside>
      }
      </section>
    </section>
  `,
  styles: `
    .matrix-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .toolbar { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .toolbar { align-items: end; padding: 14px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    .toolbar label { min-width: 220px; flex: 1; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 700; }
    input, select { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    .table-wrap { overflow: auto; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 920px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--ac-border); text-align: left; font-size: 13px; vertical-align: middle; }
    th { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; background: var(--ac-bg); }
    tbody tr { cursor: pointer; }
    tr.selected td { background: rgba(37,99,235,.06); }
    td span { display: block; color: var(--ac-muted); font-size: 12px; margin-top: 3px; }
    .status { display: inline-block; padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .empty { text-align: center; color: var(--ac-muted); padding: 32px; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .detail-grid div { min-height: 76px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; background: var(--ac-bg); display: flex; flex-direction: column; gap: 4px; }
    .detail-grid span { color: var(--ac-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .detail-grid strong { color: var(--ac-text); font-size: 13px; }
    .detail-grid small { color: var(--ac-muted); word-break: break-word; }
    @media (max-width: 720px) { .page-head, .toolbar { flex-direction: column; align-items: stretch; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionMatrixPageComponent implements OnInit {
  private readonly service = inject(RbacService);
  private readonly i18n = inject(I18nService);

  protected roleCode = '';
  protected searchText = '';
  protected readonly roles = signal<RoleDto[]>([]);
  protected readonly rows = signal<PermissionMatrixRow[]>([]);
  protected readonly selectedRow = signal<PermissionMatrixRow | null>(null);

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
    }
  }

  protected filteredRows(): PermissionMatrixRow[] {
    const search = this.searchText.trim().toLowerCase();
    return search
      ? this.rows().filter(row => `${row.permissionCode} ${this.t(row.permissionNameKey)} ${row.groupCode}`.toLowerCase().includes(search))
      : this.rows();
  }

  protected selectRow(row: PermissionMatrixRow): void {
    this.selectedRow.set(row);
  }

  protected closeDetails(): void {
    this.selectedRow.set(null);
  }
}
