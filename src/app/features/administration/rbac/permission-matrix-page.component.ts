import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AcDropdownComponent } from '../../../shared/ui/dropdown/dropdown.component';
import { AcAdminDrawerComponent } from '../../../shared/ui/admin-drawer/admin-drawer.component';
import { PermissionMatrixRow, RoleDto } from './rbac.models';
import { RbacService } from './rbac.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcAdminDrawerComponent],
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
          <colgroup>
            @for (width of columnWidths(); track $index) {
              <col [style.width.%]="width" />
            }
          </colgroup>
          <thead>
            <tr>
              <th><span class="th-content">{{ t('Administration.Rbac.Columns.Role') }}</span><span class="resize-handle" (pointerdown)="startColumnResize(0, $event)"></span></th>
              <th><span class="th-content">{{ t('Administration.Rbac.Columns.Category') }}</span><span class="resize-handle" (pointerdown)="startColumnResize(1, $event)"></span></th>
              <th><span class="th-content">{{ t('Administration.Rbac.Columns.Group') }}</span><span class="resize-handle" (pointerdown)="startColumnResize(2, $event)"></span></th>
              <th><span class="th-content">{{ t('Administration.Rbac.Columns.Permission') }}</span><span class="resize-handle" (pointerdown)="startColumnResize(3, $event)"></span></th>
              <th><span class="th-content">{{ t('Administration.Rbac.Columns.Type') }}</span><span class="resize-handle" (pointerdown)="startColumnResize(4, $event)"></span></th>
              <th><span class="th-content">{{ t('Administration.Rbac.Columns.Scope') }}</span><span class="resize-handle" (pointerdown)="startColumnResize(5, $event)"></span></th>
              <th><span class="th-content">{{ t('Administration.Rbac.Columns.Assigned') }}</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of filteredRows(); track row.roleCode + row.permissionCode) {
              <tr [class.selected]="selectedRow()?.roleCode === row.roleCode && selectedRow()?.permissionCode === row.permissionCode" (click)="selectRow(row)">
                <td>
                  <strong>{{ t(row.roleNameKey) }}</strong>
                  <span>{{ row.roleCode }}</span>
                </td>
                <td [title]="t(row.categoryNameKey)">{{ t(row.categoryNameKey) }}</td>
                <td [title]="t(row.groupNameKey)">{{ t(row.groupNameKey) }}</td>
                <td>
                  <strong [title]="t(row.permissionNameKey)">{{ t(row.permissionNameKey) }}</strong>
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
        <ac-admin-drawer
          [open]="!!selectedRow()"
          icon="rule"
          [eyebrow]="t('Administration.Rbac.Columns.Permission')"
          [title]="t(row.permissionNameKey)"
          closeTitle="Close details"
          (closed)="closeDetails()">
            <span drawer-summary class="ac-admin-pill"><span class="material-symbols-rounded">admin_panel_settings</span>{{ row.roleCode }}</span>
            <span drawer-summary class="ac-admin-pill"><span class="material-symbols-rounded">category</span>{{ row.categoryCode }}</span>
            <span drawer-summary class="ac-admin-pill" [class.featured]="row.isAssigned"><span class="material-symbols-rounded">{{ row.isAssigned ? 'check_circle' : 'radio_button_unchecked' }}</span>{{ t(row.isAssigned ? 'Common.Labels.Yes' : 'Common.Labels.No') }}</span>
            <div drawer-body class="ac-admin-drawer-content">
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
            <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeDetails()">{{ t('Common.Actions.Cancel') }}</button>
        </ac-admin-drawer>
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
    .table-wrap { overflow-x: hidden; overflow-y: auto; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; }
    th, td { min-width: 0; padding: 12px 14px; border-bottom: 1px solid var(--ac-border); text-align: left; font-size: 13px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    th { position: relative; color: var(--ac-muted); font-size: 11px; text-transform: uppercase; background: var(--ac-bg); user-select: none; }
    .th-content { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .resize-handle { position: absolute; top: 8px; right: -3px; bottom: 8px; width: 8px; cursor: col-resize; z-index: 2; border-radius: 999px; }
    .resize-handle::after { content: ''; position: absolute; inset: 0 3px; border-radius: inherit; background: transparent; transition: background .16s ease; }
    .resize-handle:hover::after { background: color-mix(in srgb, var(--ac-primary) 55%, transparent); }
    tbody tr { cursor: pointer; }
    tr.selected td { background: rgba(37,99,235,.06); }
    td strong, td span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: baseline; }
    td strong { display: inline; }
    td strong + span::before { content: ' · '; color: var(--ac-muted); font-weight: 600; }
    td span { display: inline; color: var(--ac-muted); font-size: 12px; margin-top: 0; }
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
  protected readonly columnWidths = signal([14, 22, 22, 24, 7, 7, 4]);
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

  protected startColumnResize(index: number, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const table = (event.currentTarget as HTMLElement).closest('table');
    const tableWidth = table?.clientWidth ?? 0;
    if (tableWidth <= 0 || index >= this.columnWidths().length - 1) {
      return;
    }

    const minWidth = 4;
    const startX = event.clientX;
    const startWidths = [...this.columnWidths()];

    const onMove = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - startX) / tableWidth) * 100;
      const current = startWidths[index];
      const next = startWidths[index + 1];
      const clampedDelta = Math.max(minWidth - current, Math.min(delta, next - minWidth));
      const updated = [...startWidths];
      updated[index] = roundWidth(current + clampedDelta);
      updated[index + 1] = roundWidth(next - clampedDelta);
      this.columnWidths.set(updated);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }
}

function roundWidth(value: number): number {
  return Math.round(value * 10) / 10;
}
