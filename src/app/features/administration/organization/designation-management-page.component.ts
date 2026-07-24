import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Designation } from './organization-management.models';
import { OrganizationManagementService } from './organization-management.service';

const permissions = {
  create: 'Administration.Designation.Create',
  edit: 'Administration.Designation.Edit',
  activate: 'Administration.Designation.Activate',
  deactivate: 'Administration.Designation.Deactivate'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="org-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Designation.Title') }}</h1>
          <p>{{ t('Administration.Designation.Subtitle') }}</p>
        </div>
        @if (can(permissions.create)) {
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()"><span class="material-symbols-rounded">add</span>{{ t('Administration.Designation.Actions.New') }}</button>
        }
      </header>
      <section class="toolbar">
        <label><span>{{ t('Administration.Designation.Filter.Search') }}</span><input name="searchText" [(ngModel)]="searchText" (keyup.enter)="load()" /></label>
        <button class="icon-btn" type="button" (click)="load()" [attr.title]="t('Administration.Rbac.Actions.Refresh')"><span class="material-symbols-rounded">refresh</span></button>
      </section>
      <section class="layout ac-admin-layout" [class.drawer-open]="drawerOpen()">
        <div class="table-wrap">
          <table>
            <thead><tr><th>{{ t('Administration.Designation.Columns.Designation') }}</th><th>{{ t('Administration.Designation.Columns.Parent') }}</th><th>{{ t('Administration.Designation.Columns.Level') }}</th><th>{{ t('Administration.UserManagement.Columns.Status') }}</th><th>{{ t('Administration.UserManagement.Columns.Actions') }}</th></tr></thead>
            <tbody>
              @for (item of designations(); track item.designationGuid) {
                <tr [class.selected]="form().designationGuid === item.designationGuid">
                  <td><button class="link-btn" type="button" (click)="edit(item)"><strong>{{ item.designationName }}</strong><span>{{ item.designationCode }}</span></button></td>
                  <td>{{ item.parentDesignationName || '-' }}</td>
                  <td>{{ item.levelNo }}</td>
                  <td><span class="status" [class.inactive]="!item.isActive">{{ t(item.isActive ? 'Administration.UserManagement.Status.Active' : 'Administration.UserManagement.Status.Inactive') }}</span></td>
                  <td><div class="row-actions">
                    @if (can(permissions.edit)) { <button class="icon-btn" type="button" (click)="edit(item)" [attr.title]="t('Administration.UserManagement.Actions.Edit')"><span class="material-symbols-rounded">edit</span></button> }
                    @if (item.isActive && can(permissions.deactivate)) { <button class="icon-btn danger" type="button" (click)="setStatus(item, false)" [attr.title]="t('Administration.Branch.Actions.Deactivate')"><span class="material-symbols-rounded">block</span></button> }
                    @if (!item.isActive && can(permissions.activate)) { <button class="icon-btn" type="button" (click)="setStatus(item, true)" [attr.title]="t('Administration.Branch.Actions.Activate')"><span class="material-symbols-rounded">check_circle</span></button> }
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty">{{ t('Administration.Designation.Empty') }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (drawerOpen()) {
        <aside class="ac-admin-drawer">
          @if (form(); as model) {
            <div class="ac-admin-drawer-head">
              <div class="ac-admin-drawer-title">
                <span class="ac-admin-drawer-icon material-symbols-rounded">badge</span>
                <div>
                  <p>{{ model.designationGuid ? t('Administration.UserManagement.Actions.Edit') : t('Administration.Designation.Actions.New') }}</p>
                  <h2>{{ model.designationName || t('Administration.Designation.Title') }}</h2>
                </div>
              </div>
              <button class="icon-btn" type="button" (click)="closeDrawer()" title="Close editor"><span class="material-symbols-rounded">close</span></button>
            </div>
            <div class="ac-admin-drawer-summary">
              <span class="ac-admin-pill"><span class="material-symbols-rounded">tag</span>{{ model.designationCode || 'NEW' }}</span>
              <span class="ac-admin-pill"><span class="material-symbols-rounded">stairs</span>Level {{ model.levelNo }}</span>
              @if (model.isActive) { <span class="ac-admin-pill featured"><span class="material-symbols-rounded">check_circle</span>{{ t('Administration.UserManagement.Status.Active') }}</span> }
            </div>
            <div class="ac-admin-drawer-body">
              <section class="ac-admin-form-section">
                <div class="ac-admin-section-title"><span class="material-symbols-rounded">workspace_premium</span><h3>{{ t('Administration.Designation.Title') }}</h3></div>
                <div class="ac-admin-form-grid">
                  <label><span>{{ t('Administration.Designation.Fields.DesignationCode') }}</span><input name="designationCode" [(ngModel)]="model.designationCode" /></label>
                  <label><span>{{ t('Administration.Designation.Fields.DesignationName') }}</span><input name="designationName" [(ngModel)]="model.designationName" /></label>
                  <label><span>{{ t('Administration.Designation.Fields.ParentDesignationGuid') }}</span><input name="parentDesignationGuid" [(ngModel)]="model.parentDesignationGuid" /></label>
                  <label><span>{{ t('Administration.Designation.Fields.LevelNo') }}</span><input type="number" name="levelNo" [(ngModel)]="model.levelNo" /></label>
                  <label><span>{{ t('Administration.Designation.Fields.SortOrder') }}</span><input type="number" name="sortOrder" [(ngModel)]="model.sortOrder" /></label>
                  <label class="ac-admin-wide"><span>{{ t('Administration.Designation.Fields.DescriptionKey') }}</span><input name="descriptionKey" [(ngModel)]="model.descriptionKey" /></label>
                </div>
              </section>
            </div>
            <div class="ac-admin-drawer-actions">
              <button class="ac-btn ac-btn-secondary" type="button" (click)="closeDrawer()">{{ t('Common.Actions.Cancel') }}</button>
              <button class="ac-btn ac-btn-primary" type="button" (click)="save()" [disabled]="saving() || !canSave(model)"><span class="material-symbols-rounded">save</span>{{ t('Administration.Designation.Actions.Save') }}</button>
            </div>
          }
        </aside>
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
export class DesignationManagementPageComponent implements OnInit {
  protected readonly permissions = permissions;
  protected readonly designations = signal<Designation[]>([]);
  protected readonly form = signal<Designation>(createEmptyDesignation());
  protected readonly drawerOpen = signal(false);
  protected readonly saving = signal(false);
  protected searchText = '';

  private readonly service = inject(OrganizationManagementService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> { await this.load(); }
  protected t(key: string): string { return this.i18n.translate(key); }
  protected can(permission: string): boolean { return this.auth.hasPermission(permission); }
  protected canSave(item: Designation): boolean { return item.designationGuid ? this.can(permissions.edit) : this.can(permissions.create); }
  protected edit(item: Designation): void { this.form.set({ ...item }); this.drawerOpen.set(true); }
  protected startCreate(): void { this.form.set(createEmptyDesignation()); this.drawerOpen.set(true); }
  protected closeDrawer(): void { this.drawerOpen.set(false); }

  protected async load(): Promise<void> {
    const response = await this.service.searchDesignations(this.searchText, true);
    response.success && response.data ? this.designations.set(response.data) : this.toast.error(this.t(response.message));
  }

  protected async save(): Promise<void> {
    await this.saveOperation(() => this.form().designationGuid ? this.service.updateDesignation(this.form()) : this.service.createDesignation(this.form()), 'Administration.Designation.Messages.Saved');
  }

  protected async setStatus(item: Designation, isActive: boolean): Promise<void> {
    const key = isActive ? 'Administration.Designation.Messages.Activated' : 'Administration.Designation.Messages.Deactivated';
    await this.saveOperation(() => this.service.setDesignationStatus(item.designationGuid, isActive), key);
  }

  private async saveOperation(operation: () => Promise<{ success: boolean; message: string; data: Designation | null }>, successKey: string): Promise<void> {
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

function createEmptyDesignation(): Designation {
  return { designationGuid: '', hospitalGuid: '', designationCode: '', designationName: '', descriptionKey: null, parentDesignationGuid: null, parentDesignationCode: null, parentDesignationName: null, levelNo: 0, sortOrder: 0, isActive: true, createdDate: null, modifiedDate: null, rowVersion: '' };
}
