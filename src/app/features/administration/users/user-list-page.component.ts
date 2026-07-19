import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AssignableRole, ManagedUser, UserFormModel } from './user-management.models';
import { UserManagementService } from './user-management.service';

const permissions = {
  create: 'Administration.UserManagement.Create',
  edit: 'Administration.UserManagement.Edit',
  delete: 'Administration.UserManagement.Delete',
  activate: 'Administration.UserManagement.Activate',
  unlock: 'Administration.UserManagement.Unlock',
  assignRoles: 'Administration.UserManagement.AssignRoles',
  resetPassword: 'Administration.UserManagement.ResetPassword'
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
        <button class="icon-btn" type="button" (click)="loadUsers()" [attr.title]="t('Common.Actions.Updating')">
          <span class="material-symbols-rounded">search</span>
        </button>
      </section>

      <section class="content-grid">
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

        <aside class="editor">
          <header>
            <h2>{{ t(editingUserGuid() ? 'Administration.UserManagement.Form.EditTitle' : 'Administration.UserManagement.Form.CreateTitle') }}</h2>
          </header>

          @if (errorKey()) {
            <p class="error">{{ t(errorKey()!) }}</p>
          }

          <form (ngSubmit)="saveUser()">
            <label>
              <span>{{ t('Administration.UserManagement.Form.FullName') }}</span>
              <input name="fullName" [(ngModel)]="form.fullName" required />
            </label>
            <label>
              <span>{{ t('Administration.UserManagement.Form.Email') }}</span>
              <input type="email" name="email" [(ngModel)]="form.email" required />
            </label>
            <label>
              <span>{{ t('Administration.UserManagement.Form.Mobile') }}</span>
              <input name="mobileNo" [(ngModel)]="form.mobileNo" />
            </label>
            @if (!editingUserGuid()) {
              <label>
                <span>{{ t('Administration.UserManagement.Form.Password') }}</span>
                <input type="password" name="password" [(ngModel)]="form.password" required />
              </label>
            }
            <label class="check-row">
              <input type="checkbox" name="isEmailVerified" [(ngModel)]="form.isEmailVerified" />
              <span>{{ t('Administration.UserManagement.Form.EmailVerified') }}</span>
            </label>
            <fieldset>
              <legend>{{ t('Administration.UserManagement.Form.Roles') }}</legend>
              @for (role of roles(); track role.roleCode) {
                <label class="check-row">
                  <input type="checkbox" [name]="'role_' + role.roleCode" [checked]="hasRole(role.roleCode)" (change)="toggleRole(role.roleCode)" />
                  <span>{{ t(role.roleNameKey) }}</span>
                </label>
              }
            </fieldset>
            <div class="form-actions">
              <button class="ac-btn ac-btn-secondary" type="button" (click)="clearForm()">
                {{ t('Administration.UserManagement.Actions.Cancel') }}
              </button>
              <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">
                <span class="material-symbols-rounded">save</span>
                {{ t(saving() ? 'Common.Actions.Updating' : 'Administration.UserManagement.Actions.Save') }}
              </button>
            </div>
          </form>
        </aside>
      </section>
    </section>
  `,
  styles: `
    .user-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .toolbar, .content-grid, .form-actions, .row-actions { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .toolbar { align-items: end; padding: 14px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
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

  protected searchText = '';
  protected roleCode = '';
  protected statusFilter: 'all' | 'active' | 'inactive' = 'all';
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly roles = signal<AssignableRole[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly selectedUser = signal<ManagedUser | null>(null);
  protected readonly editingUserGuid = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly isDirty = computed(() => !!this.form.email || !!this.form.fullName || !!this.form.mobileNo);

  protected form: UserFormModel = emptyForm();

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadRoles(), this.loadUsers()]);
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

  protected selectUser(user: ManagedUser): void {
    this.selectedUser.set(user);
  }

  protected startCreate(): void {
    this.editingUserGuid.set(null);
    this.selectedUser.set(null);
    this.form = emptyForm();
    this.errorKey.set(null);
  }

  protected startEdit(user: ManagedUser): void {
    this.selectedUser.set(user);
    this.editingUserGuid.set(user.userGuid);
    this.form = {
      email: user.email,
      password: '',
      fullName: user.fullName,
      mobileNo: user.mobileNo ?? '',
      isEmailVerified: user.isEmailVerified,
      roleCodes: [...user.roleCodes],
      rowVersion: user.rowVersion
    };
    this.errorKey.set(null);
  }

  protected clearForm(): void {
    this.form = emptyForm();
    this.editingUserGuid.set(null);
    this.errorKey.set(null);
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

  protected async deleteUser(user: ManagedUser): Promise<void> {
    if (!window.confirm(this.t('Administration.UserManagement.Confirm.Delete'))) {
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
    await this.loadUsers();
  }
}

function emptyForm(): UserFormModel {
  return {
    email: '',
    password: '',
    fullName: '',
    mobileNo: '',
    isEmailVerified: false,
    roleCodes: [],
    rowVersion: ''
  };
}
