import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { AssignableRole, ManagedUser, UserAuditHistoryItem, UserFormModel, UserLanguageOption, UserTimeZoneOption } from './user-management.models';
import { UserManagementService } from './user-management.service';

const permissions = {
  create: 'Administration.UserManagement.Create',
  edit: 'Administration.UserManagement.Edit',
  delete: 'Administration.UserManagement.Delete',
  activate: 'Administration.UserManagement.Activate',
  unlock: 'Administration.UserManagement.Unlock',
  assignRoles: 'Administration.UserManagement.AssignRoles',
  resetPassword: 'Administration.UserManagement.ResetPassword',
  uploadProfileImage: 'Administration.UserManagement.UploadProfileImage',
  export: 'Administration.UserManagement.Export',
  import: 'Administration.UserManagement.Import',
  viewAudit: 'Administration.UserManagement.ViewAudit'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="user-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.UserManagement.Title') }}</h1>
          <p>{{ t('Administration.UserManagement.Subtitle') }}</p>
        </div>
        @if (can(permissions.create)) {
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
            <span class="material-symbols-rounded">person_add</span>
            {{ t('Administration.UserManagement.Actions.New') }}
          </button>
        }
        @if (can(permissions.export)) {
          <button class="ac-btn ac-btn-secondary" type="button" (click)="exportUsers()">
            <span class="material-symbols-rounded">download</span>
            {{ t('Administration.UserManagement.Actions.Export') }}
          </button>
        }
      </header>

      <section class="toolbar">
        <label>
          <span>{{ t('Administration.UserManagement.Search.Placeholder') }}</span>
          <input name="searchText" [(ngModel)]="searchText" (keyup.enter)="loadUsers()" />
        </label>
        <label>
          <span>{{ t('Administration.UserManagement.Filter.Role') }}</span>
          <select name="roleCode" [(ngModel)]="roleCode" (change)="loadUsers()">
            <option value="">{{ t('Administration.UserManagement.Filter.AllRoles') }}</option>
            @for (role of roles(); track role.roleCode) {
              <option [value]="role.roleCode">{{ t(role.roleNameKey) }}</option>
            }
          </select>
        </label>
        <label>
          <span>{{ t('Administration.UserManagement.Filter.Status') }}</span>
          <select name="status" [(ngModel)]="statusFilter" (change)="loadUsers()">
            <option value="all">{{ t('Administration.UserManagement.Filter.AllStatuses') }}</option>
            <option value="active">{{ t('Administration.UserManagement.Status.Active') }}</option>
            <option value="inactive">{{ t('Administration.UserManagement.Status.Inactive') }}</option>
          </select>
        </label>
        <label>
          <span>{{ t('Administration.UserManagement.Columns.Branch') }}</span>
          <input name="branchFilter" [(ngModel)]="branchFilter" (keyup.enter)="loadUsers()" />
        </label>
        <label>
          <span>{{ t('Administration.UserManagement.Columns.Department') }}</span>
          <input name="departmentFilter" [(ngModel)]="departmentFilter" (keyup.enter)="loadUsers()" />
        </label>
        <button class="icon-btn" type="button" (click)="loadUsers()" [attr.title]="t('Common.Actions.Updating')">
          <span class="material-symbols-rounded">search</span>
        </button>
      </section>

      @if (can(permissions.import)) {
        <section class="import-panel">
          <label>
            <span>{{ t('Administration.UserManagement.Actions.Import') }}</span>
            <textarea name="importText" [(ngModel)]="importText" [placeholder]="t('Administration.UserManagement.Import.Placeholder')"></textarea>
          </label>
          <label>
            <span>{{ t('Administration.UserManagement.Form.Password') }}</span>
            <input type="password" name="importPassword" [(ngModel)]="importPassword" />
          </label>
          <button class="ac-btn ac-btn-secondary" type="button" (click)="importUsers()">
            <span class="material-symbols-rounded">upload_file</span>
            {{ t('Administration.UserManagement.Actions.Import') }}
          </button>
        </section>
      }

      <section class="content-grid ac-admin-layout" [class.drawer-open]="editorOpen()">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('Administration.UserManagement.Columns.Name') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Email') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Roles') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Status') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.LastLogin') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Actions') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.userGuid) {
                <tr [class.selected]="selectedUser()?.userGuid === user.userGuid">
                  <td>
                    <button class="user-link" type="button" (click)="selectUser(user)">
                      <strong>{{ user.fullName }}</strong>
                      <span>{{ user.mobileNo || '-' }}</span>
                    </button>
                  </td>
                  <td>{{ user.email }}</td>
                  <td>
                    <div class="role-list">
                      @for (role of user.roleCodes; track role) {
                        <span>{{ role }}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="status" [class.inactive]="!user.isActive" [class.locked]="isLocked(user)">
                      {{ statusLabel(user) }}
                    </span>
                  </td>
                  <td>{{ user.lastLoginDate ? (user.lastLoginDate | date:'short') : '-' }}</td>
                  <td>
                    <div class="row-actions">
                      @if (can(permissions.edit)) {
                        <button class="icon-btn" type="button" (click)="startEdit(user)" [attr.title]="t('Administration.UserManagement.Actions.Edit')">
                          <span class="material-symbols-rounded">edit</span>
                        </button>
                      }
                      @if (can(permissions.activate)) {
                        <button class="icon-btn" type="button" (click)="toggleStatus(user)" [attr.title]="t(user.isActive ? 'Administration.UserManagement.Actions.Deactivate' : 'Administration.UserManagement.Actions.Activate')">
                          <span class="material-symbols-rounded">{{ user.isActive ? 'block' : 'check_circle' }}</span>
                        </button>
                      }
                      @if (can(permissions.unlock) && isLocked(user)) {
                        <button class="icon-btn" type="button" (click)="unlock(user)" [attr.title]="t('Administration.UserManagement.Actions.Unlock')">
                          <span class="material-symbols-rounded">lock_open</span>
                        </button>
                      }
                      @if (can(permissions.resetPassword)) {
                        <button class="icon-btn" type="button" (click)="resetPassword(user)" [attr.title]="t('Administration.UserManagement.Actions.ResetPassword')">
                          <span class="material-symbols-rounded">key</span>
                        </button>
                      }
                      @if (can(permissions.viewAudit)) {
                        <button class="icon-btn" type="button" (click)="loadAudit(user)" [attr.title]="t('Administration.UserManagement.Actions.ViewAudit')">
                          <span class="material-symbols-rounded">history</span>
                        </button>
                      }
                      @if (can(permissions.delete)) {
                        <button class="icon-btn danger" type="button" (click)="deleteUser(user)" [attr.title]="t('Administration.UserManagement.Actions.Delete')">
                          <span class="material-symbols-rounded">delete</span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty">{{ t('Administration.UserManagement.Empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (editorOpen()) {
        <aside class="ac-admin-drawer">
          <div class="ac-admin-drawer-head">
            <div class="ac-admin-drawer-title">
              <span class="ac-admin-drawer-icon material-symbols-rounded">manage_accounts</span>
              <div>
                <p>{{ editingUserGuid() ? t('Administration.UserManagement.Actions.Edit') : t('Administration.UserManagement.Actions.New') }}</p>
                <h2>{{ form.fullName || t(editingUserGuid() ? 'Administration.UserManagement.Form.EditTitle' : 'Administration.UserManagement.Form.CreateTitle') }}</h2>
              </div>
            </div>
            <button class="icon-btn" type="button" (click)="closeEditor()" title="Close editor">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="ac-admin-drawer-summary">
            <span class="ac-admin-pill"><span class="material-symbols-rounded">mail</span>{{ form.email || 'New account' }}</span>
            <span class="ac-admin-pill"><span class="material-symbols-rounded">badge</span>{{ form.roleCodes.length || 0 }} roles</span>
            @if (form.isEmailVerified) {
              <span class="ac-admin-pill featured"><span class="material-symbols-rounded">verified</span>{{ t('Administration.UserManagement.Form.EmailVerified') }}</span>
            }
          </div>
          <div class="ac-admin-drawer-body">
          <header>
            <h2>{{ t(editingUserGuid() ? 'Administration.UserManagement.Form.EditTitle' : 'Administration.UserManagement.Form.CreateTitle') }}</h2>
          </header>

          @if (errorKey()) {
            <p class="error">{{ t(errorKey()!) }}</p>
          }

          <form id="user-editor-form" (ngSubmit)="saveUser()">
            <section class="ac-admin-form-section">
              <div class="ac-admin-section-title"><span class="material-symbols-rounded">person</span><h3>{{ t('Administration.UserManagement.Form.CreateTitle') }}</h3></div>
              <div class="ac-admin-form-grid">
                <label><span>{{ t('Administration.UserManagement.Form.FullName') }}</span><input name="fullName" [(ngModel)]="form.fullName" required /></label>
                <label><span>{{ t('Administration.UserManagement.Form.Email') }}</span><input type="email" name="email" [(ngModel)]="form.email" required /></label>
                <label><span>{{ t('Administration.UserManagement.Form.Mobile') }}</span><input name="mobileNo" [(ngModel)]="form.mobileNo" /></label>
                @if (!editingUserGuid()) {
                  <label><span>{{ t('Administration.UserManagement.Form.Password') }}</span><input type="password" name="password" [(ngModel)]="form.password" required /></label>
                }
                @if (editingUserGuid() && can(permissions.uploadProfileImage)) {
                  <label class="ac-admin-wide"><span>{{ t('Administration.UserManagement.Form.ProfileImage') }}</span><input type="file" accept="image/png,image/jpeg" (change)="uploadProfileImage($event)" /></label>
                }
                <label class="ac-admin-switch-row"><input type="checkbox" name="isEmailVerified" [(ngModel)]="form.isEmailVerified" /><span>{{ t('Administration.UserManagement.Form.EmailVerified') }}</span></label>
              </div>
            </section>

            <section class="ac-admin-form-section">
              <div class="ac-admin-section-title"><span class="material-symbols-rounded">corporate_fare</span><h3>{{ t('Administration.Branch.Section.Profile') }}</h3></div>
              <div class="ac-admin-form-grid">
                <label><span>{{ t('Administration.UserManagement.Form.HospitalName') }}</span><input name="hospitalName" [(ngModel)]="form.hospitalName" /></label>
                <label><span>{{ t('Administration.UserManagement.Form.BranchCode') }}</span><input name="branchCode" [(ngModel)]="form.branchCode" /></label>
                <label><span>{{ t('Administration.UserManagement.Form.DepartmentCode') }}</span><input name="departmentCode" [(ngModel)]="form.departmentCode" /></label>
                <label><span>{{ t('Administration.UserManagement.Form.Language') }}</span><select name="languageCode" [(ngModel)]="form.languageCode"><option value=""></option>@for (language of languages(); track language.languageCode) { <option [value]="language.languageCode">{{ language.englishName }}</option> }</select></label>
                <label><span>{{ t('Administration.UserManagement.Form.TimeZone') }}</span><select name="timeZoneCode" [(ngModel)]="form.timeZoneCode"><option value=""></option>@for (timeZone of timeZones(); track timeZone.timeZoneCode) { <option [value]="timeZone.timeZoneCode">{{ t(timeZone.displayNameKey) }}</option> }</select></label>
              </div>
            </section>

            <section class="ac-admin-form-section">
              <div class="ac-admin-section-title"><span class="material-symbols-rounded">admin_panel_settings</span><h3>{{ t('Administration.UserManagement.Form.Roles') }}</h3></div>
              <fieldset class="ac-admin-fieldset">
                <legend>{{ t('Administration.UserManagement.Form.Roles') }}</legend>
                @for (role of roles(); track role.roleCode) {
                  <label class="ac-admin-switch-row">
                    <input type="checkbox" [name]="'role_' + role.roleCode" [checked]="hasRole(role.roleCode)" (change)="toggleRole(role.roleCode)" />
                    <span>{{ t(role.roleNameKey) }}</span>
                  </label>
                }
              </fieldset>
            </section>
          </form>
          </div>
          <div class="ac-admin-drawer-actions">
            <button class="ac-btn ac-btn-secondary" type="button" (click)="closeEditor()">
              {{ t('Administration.UserManagement.Actions.Cancel') }}
            </button>
            <button class="ac-btn ac-btn-primary" type="submit" form="user-editor-form" [disabled]="saving()">
              <span class="material-symbols-rounded">save</span>
              {{ t(saving() ? 'Common.Actions.Updating' : 'Administration.UserManagement.Actions.Save') }}
            </button>
          </div>
        </aside>
        }
      </section>

      @if (auditRows().length > 0) {
        <section class="audit-panel">
          <h2>{{ t('Administration.UserManagement.Actions.ViewAudit') }}</h2>
          @for (audit of auditRows(); track audit.auditTrailId) {
            <div class="audit-row">
              <strong>{{ audit.action }}</strong>
              <span>{{ audit.createdDate | date:'medium' }}</span>
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: `
    .user-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .toolbar, .content-grid, .form-actions, .row-actions { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .toolbar { align-items: end; padding: 14px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    .import-panel, .audit-panel { padding: 14px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; display: flex; gap: 12px; align-items: end; }
    .import-panel textarea { min-height: 76px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; font: inherit; resize: vertical; }
    .audit-panel { flex-direction: column; align-items: stretch; }
    .audit-panel h2 { margin: 0; font-size: 16px; }
    .audit-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--ac-border); font-size: 13px; }
    .toolbar label { min-width: 180px; flex: 1; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 700; }
    input, select { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    input:focus, select:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .content-grid { align-items: flex-start; }
    .table-wrap { flex: 1 1 auto; overflow: auto; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 880px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--ac-border); text-align: left; font-size: 13px; vertical-align: middle; }
    th { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; background: var(--ac-bg); }
    tr.selected td { background: rgba(37,99,235,.06); }
    .user-link { border: 0; background: transparent; padding: 0; display: flex; flex-direction: column; gap: 3px; color: var(--ac-text); text-align: left; cursor: pointer; }
    .user-link span { color: var(--ac-muted); font-size: 12px; }
    .role-list { display: flex; gap: 6px; flex-wrap: wrap; }
    .role-list span { padding: 3px 7px; border-radius: 6px; background: rgba(15,118,110,.1); color: #0f766e; font-size: 11px; font-weight: 700; }
    .status { padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
    .status.locked { background: rgba(220,38,38,.1); color: #b91c1c; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .icon-btn .material-symbols-rounded, .ac-btn .material-symbols-rounded { font-size: 18px; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .icon-btn.danger:hover { border-color: var(--ac-error); color: var(--ac-error); }
    .empty { text-align: center; color: var(--ac-muted); padding: 32px; }
    .editor { width: min(380px, 100%); flex: 0 0 380px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; padding: 16px; }
    .editor h2 { margin: 0 0 14px; font-size: 16px; }
    form { display: flex; flex-direction: column; gap: 12px; }
    fieldset { border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    legend { padding: 0 4px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    .check-row { flex-direction: row; align-items: center; font-weight: 600; color: var(--ac-text-2); }
    .check-row input { width: 16px; height: 16px; }
    .form-actions { justify-content: flex-end; margin-top: 4px; }
    .error { margin: 0 0 10px; padding: 10px 12px; border-radius: 8px; background: var(--ac-error-light); color: var(--ac-error); font-size: 13px; }
    @media (max-width: 1120px) { .content-grid { flex-direction: column; } .editor { width: 100%; flex-basis: auto; } }
    @media (max-width: 720px) { .page-head, .toolbar { flex-direction: column; align-items: stretch; } table { min-width: 760px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserListPageComponent implements OnInit {
  protected readonly permissions = permissions;
  private readonly service = inject(UserManagementService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);

  protected searchText = '';
  protected roleCode = '';
  protected importText = '';
  protected importPassword = '';
  protected branchFilter = '';
  protected departmentFilter = '';
  protected statusFilter: 'all' | 'active' | 'inactive' = 'all';
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly roles = signal<AssignableRole[]>([]);
  protected readonly languages = signal<UserLanguageOption[]>([]);
  protected readonly timeZones = signal<UserTimeZoneOption[]>([]);
  protected readonly auditRows = signal<UserAuditHistoryItem[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly selectedUser = signal<ManagedUser | null>(null);
  protected readonly editingUserGuid = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly editorOpen = signal(false);

  protected form: UserFormModel = emptyForm();
  private formBaseline = serializeUserForm(this.form);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadRoles(), this.loadReferenceData(), this.loadUsers()]);
  }

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected can(permissionCode: string): boolean {
    return this.authStore.hasPermission(permissionCode);
  }

  protected async loadUsers(): Promise<void> {
    const response = await this.service.searchUsers({
      searchText: this.searchText.trim(),
      roleCode: this.roleCode,
      isActive: this.statusFilter === 'all' ? null : this.statusFilter === 'active',
      branchCode: this.branchFilter.trim(),
      departmentCode: this.departmentFilter.trim(),
      languageCode: undefined,
      timeZoneCode: undefined,
      sortColumn: 'FullName',
      sortDirection: 'ASC',
      pageNumber: 1,
      pageSize: 50
    });

    if (response.success && response.data) {
      this.users.set(response.data.items);
      this.totalCount.set(response.data.totalCount);
      return;
    }

    this.errorKey.set(response.message);
  }

  protected async loadRoles(): Promise<void> {
    const response = await this.service.getAssignableRoles();
    if (response.success && response.data) {
      this.roles.set(response.data);
    }
  }

  protected async loadReferenceData(): Promise<void> {
    const response = await this.service.getReferenceData();
    if (response.success && response.data) {
      this.languages.set(response.data.languages);
      this.timeZones.set(response.data.timeZones);
    }
  }

  protected selectUser(user: ManagedUser): void {
    this.selectedUser.set(user);
  }

  protected startCreate(): void {
    this.editingUserGuid.set(null);
    this.selectedUser.set(null);
    this.form = emptyForm();
    this.formBaseline = serializeUserForm(this.form);
    this.errorKey.set(null);
    this.editorOpen.set(true);
  }

  protected startEdit(user: ManagedUser): void {
    this.selectedUser.set(user);
    this.editingUserGuid.set(user.userGuid);
    this.form = {
      email: user.email,
      password: '',
      fullName: user.fullName,
      mobileNo: user.mobileNo ?? '',
      hospitalGuid: user.hospitalGuid ?? '',
      hospitalName: user.hospitalName ?? '',
      branchCode: user.branchCode ?? '',
      branchNameKey: user.branchNameKey ?? '',
      departmentCode: user.departmentCode ?? '',
      departmentNameKey: user.departmentNameKey ?? '',
      languageCode: user.languageCode ?? '',
      timeZoneCode: user.timeZoneCode ?? '',
      isEmailVerified: user.isEmailVerified,
      roleCodes: [...user.roleCodes],
      rowVersion: user.rowVersion
    };
    this.formBaseline = serializeUserForm(this.form);
    this.errorKey.set(null);
    this.editorOpen.set(true);
  }

  protected clearForm(): void {
    this.form = emptyForm();
    this.formBaseline = serializeUserForm(this.form);
    this.editingUserGuid.set(null);
    this.errorKey.set(null);
    this.editorOpen.set(false);
  }

  protected closeEditor(): void {
    this.clearForm();
  }

  protected hasRole(roleCode: string): boolean {
    return this.form.roleCodes.includes(roleCode);
  }

  protected toggleRole(roleCode: string): void {
    this.form.roleCodes = this.hasRole(roleCode)
      ? this.form.roleCodes.filter((code) => code !== roleCode)
      : [...this.form.roleCodes, roleCode].sort();
  }

  protected async saveUser(): Promise<void> {
    this.saving.set(true);
    this.errorKey.set(null);

    try {
      const userGuid = this.editingUserGuid();
      const response = userGuid
        ? await this.service.updateUser(userGuid, this.form)
        : await this.service.createUser(this.form);

      await this.handleUserResponse(response, userGuid ? 'Administration.UserManagement.Messages.Updated' : 'Administration.UserManagement.Messages.Created');
    } catch {
      this.errorKey.set('Administration.UserManagement.Errors.ConcurrencyConflict');
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleStatus(user: ManagedUser): Promise<void> {
    const response = await this.service.setStatus(user.userGuid, !user.isActive);
    await this.handleUserResponse(response, 'Administration.UserManagement.Messages.StatusChanged');
  }

  protected async unlock(user: ManagedUser): Promise<void> {
    const response = await this.service.unlockUser(user.userGuid);
    await this.handleUserResponse(response, 'Administration.UserManagement.Messages.Unlocked');
  }

  protected async resetPassword(user: ManagedUser): Promise<void> {
    const response = await this.service.initiatePasswordReset(user.userGuid);
    response.success
      ? this.toast.success(this.t('Auth.Messages.ForgotPasswordAccepted'))
      : this.toast.error(this.t(response.message));
  }

  protected async uploadProfileImage(event: Event): Promise<void> {
    const userGuid = this.editingUserGuid();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!userGuid || !file) {
      return;
    }

    const base64Content = await readFileAsBase64(file);
    const response = await this.service.uploadProfileImage(userGuid, file.name, file.type, base64Content);
    await this.handleUserResponse(response, 'Administration.UserManagement.Messages.ProfileImageUploaded');
  }

  protected async exportUsers(): Promise<void> {
    const response = await this.service.exportUsers({
      searchText: this.searchText.trim(),
      roleCode: this.roleCode,
      isActive: this.statusFilter === 'all' ? null : this.statusFilter === 'active',
      branchCode: this.branchFilter.trim(),
      departmentCode: this.departmentFilter.trim(),
      languageCode: undefined,
      timeZoneCode: undefined
    });

    if (!response.success || !response.data) {
      this.toast.error(this.t(response.message));
      return;
    }

    downloadBase64(response.data.fileName, response.data.contentType, response.data.base64Content);
    this.toast.success(this.t('Administration.UserManagement.Messages.ExportReady'));
  }

  protected async importUsers(): Promise<void> {
    const rows = parseImportRows(this.importText);
    const response = await this.service.importUsers(this.importPassword, rows);
    if (!response.success || !response.data) {
      this.toast.error(this.t(response.message));
      return;
    }

    this.toast.success(`${this.t('Administration.UserManagement.Messages.ImportCompleted')} ${response.data.createdCount}/${rows.length}`);
    this.importText = '';
    await this.loadUsers();
  }

  protected async loadAudit(user: ManagedUser): Promise<void> {
    const response = await this.service.getAuditHistory(user.userGuid);
    if (response.success && response.data) {
      this.auditRows.set(response.data);
    }
  }

  protected async deleteUser(user: ManagedUser): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: this.t('Administration.UserManagement.Actions.Delete'),
      message: this.t('Administration.UserManagement.Confirm.Delete'),
      details: user.fullName,
      confirmText: this.t('Administration.UserManagement.Actions.Delete'),
      cancelText: this.t('Administration.UserManagement.Actions.Cancel'),
      intent: 'danger',
      icon: 'delete'
    });

    if (!confirmed) {
      return;
    }

    const response = await this.service.deleteUser(user.userGuid);
    if (!response.success) {
      this.toast.error(this.t(response.message));
      return;
    }

    this.toast.success(this.t('Administration.UserManagement.Messages.Deleted'));
    await this.loadUsers();
    this.clearForm();
  }

  hasUnsavedChanges(): boolean {
    return serializeUserForm(this.form) !== this.formBaseline;
  }

  unsavedChangesMessage(): string {
    return 'Your user form has changes that have not been saved.';
  }

  protected isLocked(user: ManagedUser): boolean {
    return !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now();
  }

  protected statusLabel(user: ManagedUser): string {
    if (this.isLocked(user)) {
      return this.t('Administration.UserManagement.Status.Locked');
    }

    return this.t(user.isActive ? 'Administration.UserManagement.Status.Active' : 'Administration.UserManagement.Status.Inactive');
  }

  private async handleUserResponse(response: { success: boolean; message: string; data: ManagedUser | null }, successKey: string): Promise<void> {
    if (!response.success || !response.data) {
      this.errorKey.set(response.message);
      this.toast.error(this.t(response.message));
      return;
    }

    this.toast.success(this.t(successKey));
    this.startEdit(response.data);
    this.editorOpen.set(false);
    await this.loadUsers();
  }
}

function emptyForm(): UserFormModel {
  return {
    email: '',
    password: '',
    fullName: '',
    mobileNo: '',
    hospitalGuid: '',
    hospitalName: '',
    branchCode: '',
    branchNameKey: '',
    departmentCode: '',
    departmentNameKey: '',
    languageCode: '',
    timeZoneCode: '',
    isEmailVerified: false,
    roleCodes: [],
    rowVersion: ''
  };
}

function serializeUserForm(form: UserFormModel): string {
  return JSON.stringify({
    ...form,
    roleCodes: [...form.roleCodes].sort()
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}

function downloadBase64(fileName: string, contentType: string, base64Content: string): void {
  const bytes = Uint8Array.from(atob(base64Content), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function parseImportRows(text: string) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [email, fullName, mobileNo, roleCodes, branchCode, departmentCode, languageCode, timeZoneCode] = line.split(',').map(value => value?.trim() ?? '');
      return {
        email,
        fullName,
        mobileNo: mobileNo || null,
        roleCodes: roleCodes ? roleCodes.split('|').map(role => role.trim()).filter(Boolean) : [],
        hospitalGuid: null,
        hospitalName: null,
        branchCode: branchCode || null,
        branchNameKey: branchCode ? `Organization.Branch.${branchCode}` : null,
        departmentCode: departmentCode || null,
        departmentNameKey: departmentCode ? `Organization.Department.${departmentCode}` : null,
        languageCode: languageCode || null,
        timeZoneCode: timeZoneCode || null
      };
    });
}
