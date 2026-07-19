import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { PermissionMatrixRow, RoleDto } from './rbac.models';
import { RbacService } from './rbac.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <select name="roleCode" [(ngModel)]="roleCode" (change)="loadMatrix()">
            <option value="">{{ t('Administration.Rbac.Filter.AllRoles') }}</option>
            @for (role of roles(); track role.roleCode) {
              <option [value]="role.roleCode">{{ t(role.roleNameKey) }}</option>
            }
          </select>
        </label>
        <label>
          <span>{{ t('Administration.Rbac.Columns.Permission') }}</span>
          <input name="searchText" [(ngModel)]="searchText" />
        </label>
      </section>

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
              <tr>
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
    td span { display: block; color: var(--ac-muted); font-size: 12px; margin-top: 3px; }
    .status { display: inline-block; padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .empty { text-align: center; color: var(--ac-muted); padding: 32px; }
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

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadRoles(), this.loadMatrix()]);
  }

  protected t(key: string): string {
    return this.i18n.translate(key);
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
}
