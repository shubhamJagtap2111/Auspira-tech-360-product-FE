import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AcDropdownComponent } from '../../../shared/ui/dropdown/dropdown.component';
import { PermissionCatalogItem, RoleDto, RoleFormModel } from './rbac.models';
import { RbacService } from './rbac.service';

const permissions = {
  create: 'Administration.Roles.Create',
  edit: 'Administration.Roles.Edit',
  copy: 'Administration.Roles.Copy',
  assign: 'Administration.Roles.AssignPermissions'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent],
  template: `
    <section class="rbac-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Rbac.Roles.Title') }}</h1>
          <p>{{ t('Administration.Rbac.Roles.Subtitle') }}</p>
        </div>
        @if (can(permissions.create)) {
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
            <span class="material-symbols-rounded">add</span>
            {{ t('Administration.Rbac.Actions.NewRole') }}
          </button>
        }
      </header>

      <section class="toolbar">
        <label>
          <span>{{ t('Administration.Rbac.Filter.SearchRoles') }}</span>
          <input name="searchText" [(ngModel)]="searchText" (keyup.enter)="loadRoles()" />
        </label>
        <button class="icon-btn" type="button" (click)="loadRoles()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </section>

      <section class="content-grid ac-admin-layout" [class.drawer-open]="editorOpen()">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('Administration.Rbac.Columns.Role') }}</th>
                <th>{{ t('Administration.Rbac.Form.ParentRole') }}</th>
                <th>{{ t('Administration.Rbac.Columns.Permissions') }}</th>
                <th>{{ t('Administration.Rbac.Columns.Users') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Status') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Actions') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (role of roles(); track role.roleCode) {
                <tr [class.selected]="form.roleCode === role.roleCode">
                  <td>
                    <button class="role-link" type="button" (click)="startEdit(role)">
                      <strong>{{ t(role.roleNameKey) }}</strong>
                      <span>{{ role.roleCode }}</span>
                    </button>
                  </td>
                  <td>{{ role.parentRoleCode || '-' }}</td>
                  <td>{{ role.permissionCount }}</td>
                  <td>{{ role.userCount }}</td>
                  <td>
                    <span class="status" [class.inactive]="!role.isActive">
                      {{ t(role.isActive ? 'Administration.UserManagement.Status.Active' : 'Administration.UserManagement.Status.Inactive') }}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      @if (can(permissions.edit)) {
                        <button class="icon-btn" type="button" (click)="startEdit(role)" [attr.title]="t('Administration.UserManagement.Actions.Edit')">
                          <span class="material-symbols-rounded">edit</span>
                        </button>
                      }
                      @if (can(permissions.copy)) {
                        <button class="icon-btn" type="button" (click)="copyFrom(role)" [attr.title]="t('Administration.Rbac.Actions.CopyRole')">
                          <span class="material-symbols-rounded">content_copy</span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty">{{ t('Administration.Rbac.Empty.Roles') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (editorOpen()) {
        <aside class="ac-admin-drawer">
          <div class="ac-admin-drawer-head">
            <div class="ac-admin-drawer-title">
              <span class="ac-admin-drawer-icon material-symbols-rounded">admin_panel_settings</span>
              <div>
                <p>{{ t(form.rowVersion ? 'Administration.Rbac.Form.EditRole' : 'Administration.Rbac.Form.CreateRole') }}</p>
                <h2>{{ form.roleCode || t('Administration.Rbac.Actions.NewRole') }}</h2>
              </div>
            </div>
            <button class="icon-btn" type="button" (click)="closeEditor()" title="Close editor">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="ac-admin-drawer-summary">
            <span class="ac-admin-pill"><span class="material-symbols-rounded">key</span>{{ form.roleCode || 'NEW_ROLE' }}</span>
            <span class="ac-admin-pill"><span class="material-symbols-rounded">rule</span>{{ form.permissionCodes.length }} permissions</span>
            @if (form.isActive) {
              <span class="ac-admin-pill featured"><span class="material-symbols-rounded">check_circle</span>{{ t('Administration.UserManagement.Status.Active') }}</span>
            }
          </div>
          <div class="ac-admin-drawer-body">
          @if (errorKey()) {
            <p class="error">{{ t(errorKey()!) }}</p>
          }
          <form id="role-editor-form" (ngSubmit)="saveRole()">
            <section class="ac-admin-form-section">
              <div class="ac-admin-section-title"><span class="material-symbols-rounded">badge</span><h3>{{ t('Administration.Rbac.Form.CreateRole') }}</h3></div>
              <div class="ac-admin-form-grid">
                <label><span>{{ t('Administration.Rbac.Form.RoleCode') }}</span><input name="roleCode" [(ngModel)]="form.roleCode" [disabled]="!!form.rowVersion" required /></label>
                <label><span>{{ t('Administration.Rbac.Form.RoleNameKey') }}</span><input name="roleNameKey" [(ngModel)]="form.roleNameKey" required /></label>
                <label class="ac-admin-wide"><span>{{ t('Administration.Rbac.Form.DescriptionKey') }}</span><input name="roleDescriptionKey" [(ngModel)]="form.roleDescriptionKey" /></label>
                <label><span>{{ t('Administration.Rbac.Form.ParentRole') }}</span><ac-dropdown name="parentRoleCode" [(ngModel)]="parentRoleCode" [options]="parentRoleOptions()" /></label>
                <label class="ac-admin-switch-row"><input type="checkbox" name="isActive" [(ngModel)]="form.isActive" /><span>{{ t('Administration.Rbac.Form.Active') }}</span></label>
              </div>
            </section>
            <section class="ac-admin-form-section">
              <div class="ac-admin-section-title"><span class="material-symbols-rounded">rule</span><h3>{{ t('Administration.Rbac.Actions.AssignPermissions') }}</h3></div>
              <label><span>{{ t('Administration.Rbac.Columns.Permissions') }}</span><input name="permissionSearch" [(ngModel)]="permissionSearch" /></label>
              <fieldset class="ac-admin-fieldset">
                <legend>{{ t('Administration.Rbac.Actions.AssignPermissions') }}</legend>
                @for (item of filteredCatalog(); track item.permissionCode) {
                  <label class="ac-admin-switch-row">
                    <input type="checkbox" [name]="'perm_' + item.permissionCode" [checked]="hasPermission(item.permissionCode)" (change)="togglePermission(item.permissionCode)" />
                    <span>{{ t(item.permissionNameKey) }}</span>
                  </label>
                }
              </fieldset>
            </section>
          </form>
          </div>
          <div class="ac-admin-drawer-actions">
            <button class="ac-btn ac-btn-secondary" type="button" (click)="closeEditor()">{{ t('Common.Actions.Cancel') }}</button>
            <button class="ac-btn ac-btn-primary" type="submit" form="role-editor-form" [disabled]="saving() || (!can(permissions.create) && !can(permissions.edit))">
              <span class="material-symbols-rounded">save</span>
              {{ t('Administration.Rbac.Actions.SaveRole') }}
            </button>
          </div>
        </aside>
        }
      </section>
    </section>
  `,
  styles: `
    .rbac-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .toolbar, .content-grid, .row-actions, .form-actions { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .toolbar { align-items: end; padding: 14px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    .toolbar label { min-width: 240px; flex: 1; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 700; }
    input, select { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    .content-grid { align-items: flex-start; }
    .table-wrap { flex: 1 1 auto; overflow: auto; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--ac-border); text-align: left; font-size: 13px; vertical-align: middle; }
    th { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; background: var(--ac-bg); }
    tr.selected td { background: rgba(37,99,235,.06); }
    .role-link { border: 0; background: transparent; padding: 0; display: flex; flex-direction: column; gap: 3px; color: var(--ac-text); text-align: left; cursor: pointer; }
    .role-link span { color: var(--ac-muted); font-size: 12px; }
    .status { padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .editor { width: min(420px, 100%); flex: 0 0 420px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; padding: 16px; }
    .editor h2 { margin: 0 0 14px; font-size: 16px; }
    form { display: flex; flex-direction: column; gap: 12px; }
    fieldset { max-height: 280px; overflow: auto; border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    legend { padding: 0 4px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    .check-row { flex-direction: row; align-items: center; font-weight: 600; color: var(--ac-text-2); }
    .check-row input { width: 16px; height: 16px; }
    .form-actions { justify-content: flex-end; }
    .error { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--ac-error-light); color: var(--ac-error); font-size: 13px; }
    .empty { text-align: center; color: var(--ac-muted); padding: 32px; }
    @media (max-width: 1120px) { .content-grid { flex-direction: column; } .editor { width: 100%; flex-basis: auto; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleManagementPageComponent implements OnInit {
  protected readonly permissions = permissions;
  private readonly service = inject(RbacService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  protected searchText = '';
  protected permissionSearch = '';
  protected parentRoleCode = '';
  protected readonly roles = signal<RoleDto[]>([]);
  protected readonly catalog = signal<PermissionCatalogItem[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly editorOpen = signal(false);
  protected form = emptyForm();

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadRoles(), this.loadCatalog()]);
  }

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected can(permissionCode: string): boolean {
    return this.authStore.hasPermission(permissionCode);
  }

  protected parentRoleOptions() {
    return [
      { label: '', value: '' },
      ...this.roles()
        .filter(role => role.roleCode !== this.form.roleCode)
        .map(role => ({ label: this.t(role.roleNameKey), value: role.roleCode }))
    ];
  }

  protected async loadRoles(): Promise<void> {
    const response = await this.service.getRoles({ searchText: this.searchText.trim() });
    if (response.success && response.data) {
      this.roles.set(response.data);
      return;
    }

    this.errorKey.set(response.message);
  }

  protected async loadCatalog(): Promise<void> {
    const response = await this.service.getPermissionCatalog();
    if (response.success && response.data) {
      this.catalog.set(response.data);
    }
  }

  protected filteredCatalog(): PermissionCatalogItem[] {
    const search = this.permissionSearch.trim().toLowerCase();
    return search
      ? this.catalog().filter(item => `${item.permissionCode} ${this.t(item.permissionNameKey)}`.toLowerCase().includes(search))
      : this.catalog();
  }

  protected startCreate(): void {
    this.form = emptyForm();
    this.parentRoleCode = '';
    this.errorKey.set(null);
    this.permissionSearch = '';
    this.editorOpen.set(true);
  }

  protected async startEdit(role: RoleDto): Promise<void> {
    const response = await this.service.getRole(role.roleCode);
    const detail = response.data ?? role;
    this.form = {
      roleCode: detail.roleCode,
      roleNameKey: detail.roleNameKey,
      roleDescriptionKey: detail.roleDescriptionKey ?? '',
      sortOrder: detail.sortOrder,
      isActive: detail.isActive,
      rowVersion: detail.rowVersion,
      permissionCodes: [...detail.permissionCodes]
    };
    this.parentRoleCode = detail.parentRoleCode ?? '';
    this.errorKey.set(null);
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.form = emptyForm();
    this.parentRoleCode = '';
    this.permissionSearch = '';
    this.errorKey.set(null);
    this.editorOpen.set(false);
  }

  protected hasPermission(permissionCode: string): boolean {
    return this.form.permissionCodes.includes(permissionCode);
  }

  protected togglePermission(permissionCode: string): void {
    this.form.permissionCodes = this.hasPermission(permissionCode)
      ? this.form.permissionCodes.filter(code => code !== permissionCode)
      : [...this.form.permissionCodes, permissionCode].sort();
  }

  protected async saveRole(): Promise<void> {
    this.saving.set(true);
    this.errorKey.set(null);

    try {
      const response = this.form.rowVersion
        ? await this.service.updateRole(this.form)
        : await this.service.createRole(this.form);
      await this.handleSaveResponse(response, this.form.rowVersion ? 'Administration.Rbac.Messages.RoleUpdated' : 'Administration.Rbac.Messages.RoleCreated', true);
    } finally {
      this.saving.set(false);
    }
  }

  protected async copyFrom(role: RoleDto): Promise<void> {
    const response = await this.service.getRole(role.roleCode);
    const detail = response.data ?? role;
    this.form = {
      roleCode: `${role.roleCode}_COPY`,
      roleNameKey: `${role.roleNameKey}.Copy`,
      roleDescriptionKey: role.roleDescriptionKey ?? '',
      sortOrder: role.sortOrder + 1,
      isActive: true,
      rowVersion: '',
      permissionCodes: [...detail.permissionCodes]
    };
    this.parentRoleCode = detail.parentRoleCode ?? '';
    this.errorKey.set(null);
    this.editorOpen.set(true);
  }

  private async handleSaveResponse(response: { success: boolean; message: string; data: RoleDto | null }, successKey: string, updateParent: boolean): Promise<void> {
    if (!response.success || !response.data) {
      this.errorKey.set(response.message);
      this.toast.error(this.t(response.message));
      return;
    }

    if (updateParent) {
      await this.service.setRoleParent(response.data.roleCode, this.parentRoleCode || null);
    }

    this.toast.success(this.t(successKey));
    await this.loadRoles();
    await this.startEdit(response.data);
    this.editorOpen.set(false);
  }
}

function emptyForm(): RoleFormModel {
  return {
    roleCode: '',
    roleNameKey: '',
    roleDescriptionKey: '',
    sortOrder: 0,
    isActive: true,
    rowVersion: '',
    permissionCodes: []
  };
}
