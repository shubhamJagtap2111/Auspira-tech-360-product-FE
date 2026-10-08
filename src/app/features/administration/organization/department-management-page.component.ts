import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AcAdminDrawerComponent } from '../../../shared/ui/admin-drawer/admin-drawer.component';
import { Department } from './organization-management.models';
import { OrganizationManagementService } from './organization-management.service';
import { BranchContextService } from '../../../core/context/branch-context.service';
import { AcDropdownComponent } from '../../../shared/ui/dropdown/dropdown.component';
import { UserManagementService } from '../users/user-management.service';
import { ManagedUser } from '../users/user-management.models';

const permissions = {
  create: 'Administration.Department.Create',
  edit: 'Administration.Department.Edit',
  activate: 'Administration.Department.Activate',
  deactivate: 'Administration.Department.Deactivate',
  assignHead: 'Administration.Department.AssignHead'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcAdminDrawerComponent, AcDropdownComponent],
  template: `
    <section class="org-page ac-workspace">
      <header class="page-head ac-workspace-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Department.Title') }}</h1>
          <p>{{ t('Administration.Department.Subtitle') }}</p>
        </div>
        @if (can(permissions.create)) {
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()" [disabled]="!branches.selectedBranch()">
            <span class="material-symbols-rounded">add</span>
            {{ t('Administration.Department.Actions.New') }}
          </button>
        }
      </header>

      <section class="toolbar">
        <label><span>{{ t('Administration.Department.Filter.Search') }}</span><input name="searchText" [(ngModel)]="searchText" (keyup.enter)="load()" /></label>
        <button class="icon-btn" type="button" (click)="load()" [attr.title]="t('Administration.Rbac.Actions.Refresh')"><span class="material-symbols-rounded">refresh</span></button>
      </section>

      <section class="layout ac-admin-layout" [class.drawer-open]="drawerOpen()">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('Administration.Department.Columns.Department') }}</th>
                <th>{{ t('Administration.Department.Columns.Branch') }}</th>
                <th>{{ t('Administration.Department.Columns.Head') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Status') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Actions') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of departments(); track item.departmentGuid) {
                <tr [class.selected]="form().departmentGuid === item.departmentGuid">
                  <td><button class="link-btn" type="button" (click)="edit(item)"><strong>{{ item.departmentName }}</strong><span>{{ item.departmentCode }}</span></button></td>
                  <td>{{ item.branchName || item.branchCode || '-' }}</td>
                  <td>{{ item.departmentHeadName || '-' }}</td>
                  <td><span class="status" [class.inactive]="!item.isActive">{{ t(item.isActive ? 'Administration.UserManagement.Status.Active' : 'Administration.UserManagement.Status.Inactive') }}</span></td>
                  <td>
                    <div class="row-actions">
                      @if (can(permissions.edit)) { <button class="icon-btn" type="button" (click)="edit(item)" [attr.title]="t('Administration.UserManagement.Actions.Edit')"><span class="material-symbols-rounded">edit</span></button> }
                      @if (item.isActive && can(permissions.deactivate)) { <button class="icon-btn danger" type="button" (click)="setStatus(item, false)" [attr.title]="t('Administration.Branch.Actions.Deactivate')"><span class="material-symbols-rounded">block</span></button> }
                      @if (!item.isActive && can(permissions.activate)) { <button class="icon-btn" type="button" (click)="setStatus(item, true)" [attr.title]="t('Administration.Branch.Actions.Activate')"><span class="material-symbols-rounded">check_circle</span></button> }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty">{{ t('Administration.Department.Empty') }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (drawerOpen()) {
          @if (form(); as model) {
            <ac-admin-drawer
              [open]="drawerOpen()"
              [busy]="saving()"
              icon="business"
              [eyebrow]="model.departmentGuid ? t('Administration.UserManagement.Actions.Edit') : t('Administration.Department.Actions.New')"
              [title]="model.departmentName || t('Administration.Department.Title')"
              (closed)="closeDrawer()">
              <span drawer-summary class="ac-admin-pill"><span class="material-symbols-rounded">tag</span>{{ model.departmentCode || 'NEW' }}</span>
              <span drawer-summary class="ac-admin-pill"><span class="material-symbols-rounded">account_tree</span>{{ model.branchName || model.branchCode || 'Branch' }}</span>
              @if (model.isActive) { <span drawer-summary class="ac-admin-pill featured"><span class="material-symbols-rounded">check_circle</span>{{ t('Administration.UserManagement.Status.Active') }}</span> }
              <div drawer-body class="ac-admin-drawer-content">
                <form id="department-editor-form" (ngSubmit)="save()">
                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title"><span class="material-symbols-rounded">badge</span><h3>{{ t('Administration.Department.Title') }}</h3></div>
                  <div class="ac-admin-form-grid">
                    <label><span>Department name *</span><input name="departmentName" [(ngModel)]="model.departmentName" required placeholder="e.g. General Medicine" /></label>
                    <label><span>Department code *</span><input name="departmentCode" [(ngModel)]="model.departmentCode" required placeholder="e.g. GEN-MED" /></label>
                    <label><span>Branch *</span><ac-dropdown name="branchGuid" [(ngModel)]="model.branchGuid" [options]="branchOptions()" [disabled]="true" placeholder="Choose branch" /></label>
                    <label><span>Display order</span><input type="number" name="sortOrder" [(ngModel)]="model.sortOrder" min="0" /></label>
                    <label class="ac-admin-wide"><span>Description</span><textarea name="descriptionKey" [(ngModel)]="model.descriptionKey" rows="3" placeholder="Services offered by this department"></textarea></label>
                    @if (can(permissions.assignHead)) {
                      <label class="ac-admin-wide"><span>Department head</span><ac-dropdown name="departmentHeadUserGuid" [(ngModel)]="model.departmentHeadUserGuid" [options]="staffOptions()" placeholder="Choose staff member" /></label>
                    }
                  </div>
                </section>
                <p class="ac-admin-help">This department belongs to the branch selected in the top bar. Its head must be assigned to the same branch.</p>
                </form>
              </div>
              <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeDrawer()" [disabled]="saving()">{{ t('Common.Actions.Cancel') }}</button>
              <button drawer-actions class="ac-btn ac-btn-primary" type="submit" form="department-editor-form" [disabled]="saving() || !canSave(model) || !model.departmentName.trim() || !model.departmentCode.trim() || !model.branchGuid"><span class="material-symbols-rounded">save</span>{{ saving() ? 'Saving department...' : model.departmentGuid ? 'Update department' : t('Administration.Department.Actions.Save') }}</button>
            </ac-admin-drawer>
          }
        }
      </section>
    </section>
  `,
  styles: `
    .org-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .toolbar, .layout, .row-actions, .form-actions { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .toolbar { align-items: end; padding: 14px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    .toolbar label { flex: 1; }
    .layout { align-items: flex-start; }
    .table-wrap { flex: 1 1 auto; overflow: auto; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--ac-border); text-align: left; font-size: 13px; vertical-align: middle; }
    th { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; background: var(--ac-bg); }
    tr.selected td { background: rgba(37,99,235,.06); }
    .link-btn { border: 0; background: transparent; padding: 0; display: flex; flex-direction: column; gap: 3px; color: var(--ac-text); text-align: left; cursor: pointer; }
    .link-btn span { color: var(--ac-muted); font-size: 12px; }
    .status { padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .status.inactive { background: rgba(100,116,139,.12); color: var(--ac-muted); }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .icon-btn.danger { color: #b91c1c; }
    .editor { width: min(420px, 100%); flex: 0 0 420px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .editor h2 { margin: 0 0 4px; font-size: 16px; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 700; }
    input { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    .form-actions { justify-content: flex-end; margin-top: 8px; }
    .empty { text-align: center; color: var(--ac-muted); padding: 28px; }
    @media (max-width: 1100px) { .layout { flex-direction: column; } .editor { width: 100%; flex-basis: auto; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentManagementPageComponent implements OnInit {
  protected readonly permissions = permissions;
  protected readonly departments = signal<Department[]>([]);
  protected readonly form = signal<Department>(createEmptyDepartment());
  protected readonly drawerOpen = signal(false);
  protected readonly saving = signal(false);
  protected searchText = '';

  private readonly service = inject(OrganizationManagementService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  protected readonly branches = inject(BranchContextService);
  private readonly userService = inject(UserManagementService);
  private readonly staff = signal<ManagedUser[]>([]);

  async ngOnInit(): Promise<void> {
    await this.branches.loadBranches();
    await this.load();
    if (this.can(permissions.assignHead)) {
      const response = await this.userService.searchUsers({ pageNumber: 1, pageSize: 100, isActive: true });
      if (response.success && response.data) this.staff.set(response.data.items);
    }
  }
  protected branchOptions() { return this.branches.branches().map(b => ({ label:b.branchName,value:b.branchGuid })); }
  protected staffOptions() {
    const code = this.branches.branches().find(b => b.branchGuid === this.form().branchGuid)?.branchCode;
    return [{ label:'Not assigned',value:'' },...this.staff().filter(u => u.branchCode === code).map(u => ({label:u.fullName,value:u.userGuid}))];
  }
  protected t(key: string): string { return this.i18n.translate(key); }
  protected can(permission: string): boolean { return this.auth.hasPermission(permission); }
  protected canSave(item: Department): boolean { return item.departmentGuid ? this.can(permissions.edit) : this.can(permissions.create); }
  protected edit(item: Department): void {
    if (item.branchGuid !== this.branches.selectedBranch()?.branchGuid) { this.toast.error('Select this department’s branch in the top bar to edit it.'); return; }
    this.form.set({ ...item }); this.drawerOpen.set(true);
  }
  protected startCreate(): void { this.form.set({ ...createEmptyDepartment(),branchGuid:this.branches.selectedBranch()?.branchGuid ?? null }); this.drawerOpen.set(true); }
  protected closeDrawer(): void { if (!this.saving()) this.drawerOpen.set(false); }

  protected async load(): Promise<void> {
    const response = await this.service.searchDepartments(this.searchText, true);
    response.success && response.data ? this.departments.set(response.data.filter(d => !this.branches.selectedBranch() || d.branchGuid === this.branches.selectedBranch()?.branchGuid)) : this.toast.error(this.t(response.message));
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.form().branchGuid || !this.form().departmentName.trim() || !this.form().departmentCode.trim()) return;
    this.form().departmentHeadUserGuid ||= null;
    await this.saveOperation(() => this.form().departmentGuid ? this.service.updateDepartment(this.form()) : this.service.createDepartment(this.form()), 'Administration.Department.Messages.Saved');
  }

  protected async setStatus(item: Department, isActive: boolean): Promise<void> {
    if (item.branchGuid !== this.branches.selectedBranch()?.branchGuid) { this.toast.error('Select this department’s branch in the top bar to change its status.'); return; }
    const key = isActive ? 'Administration.Department.Messages.Activated' : 'Administration.Department.Messages.Deactivated';
    await this.saveOperation(() => this.service.setDepartmentStatus(item.departmentGuid, isActive), key);
  }

  private async saveOperation(operation: () => Promise<{ success: boolean; message: string; data: Department | null }>, successKey: string): Promise<void> {
    this.saving.set(true);
    try {
      const response = await operation();
      if (!response.success || !response.data) { this.toast.error(this.t(response.message)); return; }
      this.form.set(response.data);
      this.drawerOpen.set(false);
      await this.load();
      this.toast.success(this.t(successKey));
    } finally {
      this.saving.set(false);
    }
  }
}

function createEmptyDepartment(): Department {
  return { departmentGuid: '', hospitalGuid: '', branchGuid: null, branchCode: null, branchName: null, departmentCode: '', departmentName: '', descriptionKey: null, departmentHeadUserGuid: null, departmentHeadName: null, sortOrder: 0, isActive: true, createdDate: null, modifiedDate: null, rowVersion: '' };
}
