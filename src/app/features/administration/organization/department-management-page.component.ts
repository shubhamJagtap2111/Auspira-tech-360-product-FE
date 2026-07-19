import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Department } from './organization-management.models';
import { OrganizationManagementService } from './organization-management.service';

const permissions = {
  create: 'Administration.Department.Create',
  edit: 'Administration.Department.Edit',
  activate: 'Administration.Department.Activate',
  deactivate: 'Administration.Department.Deactivate',
  assignHead: 'Administration.Department.AssignHead'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="org-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Department.Title') }}</h1>
          <p>{{ t('Administration.Department.Subtitle') }}</p>
        </div>
        @if (can(permissions.create)) {
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
            <span class="material-symbols-rounded">add</span>
            {{ t('Administration.Department.Actions.New') }}
          </button>
        }
      </header>

      <section class="toolbar">
        <label><span>{{ t('Administration.Department.Filter.Search') }}</span><input name="searchText" [(ngModel)]="searchText" (keyup.enter)="load()" /></label>
        <button class="icon-btn" type="button" (click)="load()" [attr.title]="t('Administration.Rbac.Actions.Refresh')"><span class="material-symbols-rounded">refresh</span></button>
      </section>

      <section class="layout">
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

        <aside class="editor">
          @if (form(); as model) {
            <h2>{{ t('Administration.Department.Title') }}</h2>
            <label><span>{{ t('Administration.Department.Fields.DepartmentCode') }}</span><input name="departmentCode" [(ngModel)]="model.departmentCode" /></label>
            <label><span>{{ t('Administration.Department.Fields.DepartmentName') }}</span><input name="departmentName" [(ngModel)]="model.departmentName" /></label>
            <label><span>{{ t('Administration.Department.Fields.BranchGuid') }}</span><input name="branchGuid" [(ngModel)]="model.branchGuid" /></label>
            <label><span>{{ t('Administration.Department.Fields.DescriptionKey') }}</span><input name="descriptionKey" [(ngModel)]="model.descriptionKey" /></label>
            @if (can(permissions.assignHead)) {
              <label><span>{{ t('Administration.Department.Fields.DepartmentHeadUserGuid') }}</span><input name="departmentHeadUserGuid" [(ngModel)]="model.departmentHeadUserGuid" /></label>
            }
            <label><span>{{ t('Administration.Department.Fields.SortOrder') }}</span><input type="number" name="sortOrder" [(ngModel)]="model.sortOrder" /></label>
            <div class="form-actions">
              <button class="ac-btn ac-btn-secondary" type="button" (click)="startCreate()">{{ t('Common.Actions.Cancel') }}</button>
              <button class="ac-btn ac-btn-primary" type="button" (click)="save()" [disabled]="saving() || !canSave(model)">
                <span class="material-symbols-rounded">save</span>{{ t('Administration.Department.Actions.Save') }}
              </button>
            </div>
          }
        </aside>
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
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
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
  protected readonly saving = signal(false);
  protected searchText = '';

  private readonly service = inject(OrganizationManagementService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> { await this.load(); }
  protected t(key: string): string { return this.i18n.translate(key); }
  protected can(permission: string): boolean { return this.auth.hasPermission(permission); }
  protected canSave(item: Department): boolean { return item.departmentGuid ? this.can(permissions.edit) : this.can(permissions.create); }
  protected edit(item: Department): void { this.form.set({ ...item }); }
  protected startCreate(): void { this.form.set(createEmptyDepartment()); }

  protected async load(): Promise<void> {
    const response = await this.service.searchDepartments(this.searchText, true);
    response.success && response.data ? this.departments.set(response.data) : this.toast.error(this.t(response.message));
  }

  protected async save(): Promise<void> {
    await this.saveOperation(() => this.form().departmentGuid ? this.service.updateDepartment(this.form()) : this.service.createDepartment(this.form()), 'Administration.Department.Messages.Saved');
  }

  protected async setStatus(item: Department, isActive: boolean): Promise<void> {
    const key = isActive ? 'Administration.Department.Messages.Activated' : 'Administration.Department.Messages.Deactivated';
    await this.saveOperation(() => this.service.setDepartmentStatus(item.departmentGuid, isActive), key);
  }

  private async saveOperation(operation: () => Promise<{ success: boolean; message: string; data: Department | null }>, successKey: string): Promise<void> {
    this.saving.set(true);
    try {
      const response = await operation();
      if (!response.success || !response.data) { this.toast.error(this.t(response.message)); return; }
      this.form.set(response.data);
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
