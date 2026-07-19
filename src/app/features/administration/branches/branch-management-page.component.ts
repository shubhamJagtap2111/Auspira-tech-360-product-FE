import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { BranchConfiguration, BranchProfile, BranchSummary, BranchWorkingHour } from './branch-management.models';
import { BranchManagementService } from './branch-management.service';

const permissions = {
  create: 'Administration.Branch.Create',
  edit: 'Administration.Branch.Edit',
  activate: 'Administration.Branch.Activate',
  deactivate: 'Administration.Branch.Deactivate',
  setDefault: 'Administration.Branch.SetDefault',
  configure: 'Administration.Branch.Configure'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="branch-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Branch.Title') }}</h1>
          <p>{{ t('Administration.Branch.Subtitle') }}</p>
        </div>
        @if (can(permissions.create)) {
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
            <span class="material-symbols-rounded">add</span>
            {{ t('Administration.Branch.Actions.NewBranch') }}
          </button>
        }
      </header>

      <section class="toolbar">
        <label>
          <span>{{ t('Administration.Branch.Filter.Search') }}</span>
          <input name="searchText" [(ngModel)]="searchText" (keyup.enter)="loadBranches()" />
        </label>
        <button class="icon-btn" type="button" (click)="loadBranches()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </section>

      <section class="layout">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('Administration.Branch.Columns.Branch') }}</th>
                <th>{{ t('Administration.Branch.Columns.Location') }}</th>
                <th>{{ t('Administration.Hospital.Section.Contact') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Status') }}</th>
                <th>{{ t('Administration.UserManagement.Columns.Actions') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (branch of branches(); track branch.branchGuid) {
                <tr [class.selected]="form().branchGuid === branch.branchGuid">
                  <td>
                    <button class="branch-link" type="button" (click)="selectBranch(branch)">
                      <strong>{{ branch.branchName }}</strong>
                      <span>{{ branch.branchCode }} · {{ branch.branchTypeCode }}</span>
                    </button>
                    @if (branch.isDefault) {
                      <span class="default-mark">{{ t('Administration.Branch.Fields.DefaultBranch') }}</span>
                    }
                  </td>
                  <td>{{ branch.cityName || '-' }}, {{ branch.stateName || '-' }}</td>
                  <td>{{ branch.primaryPhone || '-' }}<br /><span>{{ branch.email || '-' }}</span></td>
                  <td>
                    <span class="status" [class.inactive]="!branch.isActive">
                      {{ t(branch.isActive ? 'Administration.UserManagement.Status.Active' : 'Administration.UserManagement.Status.Inactive') }}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      @if (can(permissions.edit)) {
                        <button class="icon-btn" type="button" (click)="selectBranch(branch)" [attr.title]="t('Administration.UserManagement.Actions.Edit')">
                          <span class="material-symbols-rounded">edit</span>
                        </button>
                      }
                      @if (!branch.isDefault && branch.isActive && can(permissions.setDefault)) {
                        <button class="icon-btn" type="button" (click)="setDefault(branch)" [attr.title]="t('Administration.Branch.Actions.SetDefault')">
                          <span class="material-symbols-rounded">star</span>
                        </button>
                      }
                      @if (branch.isActive && can(permissions.deactivate)) {
                        <button class="icon-btn danger" type="button" (click)="setStatus(branch, false)" [attr.title]="t('Administration.Branch.Actions.Deactivate')">
                          <span class="material-symbols-rounded">block</span>
                        </button>
                      }
                      @if (!branch.isActive && can(permissions.activate)) {
                        <button class="icon-btn" type="button" (click)="setStatus(branch, true)" [attr.title]="t('Administration.Branch.Actions.Activate')">
                          <span class="material-symbols-rounded">check_circle</span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="empty">{{ t('Administration.Branch.Empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <aside class="editor">
          @if (form(); as branchForm) {
            <h2>{{ t('Administration.Branch.Section.Profile') }}</h2>
            <div class="form-grid">
              <label><span>{{ t('Administration.Branch.Fields.BranchCode') }}</span><input name="branchCode" [(ngModel)]="branchForm.branchCode" /></label>
              <label><span>{{ t('Administration.Branch.Fields.BranchName') }}</span><input name="branchName" [(ngModel)]="branchForm.branchName" /></label>
              <label><span>{{ t('Administration.Branch.Fields.BranchTypeCode') }}</span><input name="branchTypeCode" [(ngModel)]="branchForm.branchTypeCode" /></label>
              <label class="check-row"><input type="checkbox" name="isDefault" [(ngModel)]="branchForm.isDefault" /><span>{{ t('Administration.Branch.Fields.DefaultBranch') }}</span></label>
            </div>

            <h2>{{ t('Administration.Branch.Section.Address') }}</h2>
            <div class="form-grid">
              <label class="wide"><span>{{ t('Administration.Branch.Fields.AddressLine1') }}</span><input name="addressLine1" [(ngModel)]="branchForm.address.addressLine1" /></label>
              <label><span>{{ t('Administration.Branch.Fields.AddressLine2') }}</span><input name="addressLine2" [(ngModel)]="branchForm.address.addressLine2" /></label>
              <label><span>{{ t('Administration.Branch.Fields.CityName') }}</span><input name="cityName" [(ngModel)]="branchForm.address.cityName" /></label>
              <label><span>{{ t('Administration.Branch.Fields.StateName') }}</span><input name="stateName" [(ngModel)]="branchForm.address.stateName" /></label>
              <label><span>{{ t('Administration.Branch.Fields.CountryCode') }}</span><input name="countryCode" [(ngModel)]="branchForm.address.countryCode" /></label>
              <label><span>{{ t('Administration.Branch.Fields.PostalCode') }}</span><input name="postalCode" [(ngModel)]="branchForm.address.postalCode" /></label>
            </div>

            <h2>{{ t('Administration.Branch.Section.Contact') }}</h2>
            <div class="form-grid">
              <label><span>{{ t('Administration.Branch.Fields.PrimaryPhone') }}</span><input name="primaryPhone" [(ngModel)]="branchForm.contact.primaryPhone" /></label>
              <label><span>{{ t('Administration.Branch.Fields.SecondaryPhone') }}</span><input name="secondaryPhone" [(ngModel)]="branchForm.contact.secondaryPhone" /></label>
              <label><span>{{ t('Administration.Branch.Fields.EmergencyPhone') }}</span><input name="emergencyPhone" [(ngModel)]="branchForm.contact.emergencyPhone" /></label>
              <label><span>{{ t('Administration.Branch.Fields.Email') }}</span><input type="email" name="email" [(ngModel)]="branchForm.contact.email" /></label>
              <label><span>{{ t('Administration.Branch.Fields.Fax') }}</span><input name="fax" [(ngModel)]="branchForm.contact.fax" /></label>
            </div>

            <h2>{{ t('Administration.Branch.Section.WorkingHours') }}</h2>
            <div class="hours">
              @for (hour of branchForm.workingHours; track hour.dayOfWeek) {
                <div class="hour-row">
                  <strong>{{ t(dayKey(hour.dayOfWeek)) }}</strong>
                  <input type="time" [name]="'open_' + hour.dayOfWeek" [(ngModel)]="hour.openTime" [disabled]="hour.isClosed" />
                  <input type="time" [name]="'close_' + hour.dayOfWeek" [(ngModel)]="hour.closeTime" [disabled]="hour.isClosed" />
                  <label class="check-row"><input type="checkbox" [name]="'closed_' + hour.dayOfWeek" [(ngModel)]="hour.isClosed" /><span>{{ t('Administration.Branch.Fields.Closed') }}</span></label>
                </div>
              }
            </div>

            @if (can(permissions.configure)) {
              <h2>{{ t('Administration.Branch.Section.Configuration') }}</h2>
              @for (setting of branchForm.configuration; track setting.settingKey; let index = $index) {
                <div class="setting-row">
                  <input [name]="'settingKey_' + index" [(ngModel)]="setting.settingKey" [attr.aria-label]="t('Administration.Branch.Fields.SettingKey')" />
                  <input [name]="'settingValue_' + index" [(ngModel)]="setting.settingValue" [attr.aria-label]="t('Administration.Branch.Fields.SettingValue')" />
                </div>
              }
              <button class="ac-btn ac-btn-secondary" type="button" (click)="addSetting()">{{ t('Administration.Branch.Actions.AddSetting') }}</button>
            }

            <div class="form-actions">
              <button class="ac-btn ac-btn-secondary" type="button" (click)="startCreate()">{{ t('Common.Actions.Cancel') }}</button>
              <button class="ac-btn ac-btn-primary" type="button" (click)="save()" [disabled]="saving() || !canSave(branchForm)">
                <span class="material-symbols-rounded">save</span>
                {{ t('Administration.Branch.Actions.SaveBranch') }}
              </button>
            </div>
          }
        </aside>
      </section>
    </section>
  `,
  styles: `
    .branch-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .toolbar, .layout, .row-actions, .form-actions { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .toolbar { align-items: end; padding: 14px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    .toolbar label { min-width: 260px; flex: 1; }
    .layout { align-items: flex-start; }
    .table-wrap { flex: 1 1 auto; overflow: auto; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 840px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--ac-border); text-align: left; font-size: 13px; vertical-align: middle; }
    th { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; background: var(--ac-bg); }
    tr.selected td { background: rgba(37,99,235,.06); }
    .branch-link { border: 0; background: transparent; padding: 0; display: flex; flex-direction: column; gap: 3px; color: var(--ac-text); text-align: left; cursor: pointer; }
    .branch-link span, td span { color: var(--ac-muted); font-size: 12px; }
    .default-mark, .status { display: inline-flex; margin-top: 6px; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; }
    .default-mark { background: rgba(245,158,11,.12); color: #b45309; }
    .status { background: rgba(22,163,74,.1); color: #15803d; }
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .icon-btn.danger { color: #b91c1c; }
    .editor { width: min(520px, 100%); flex: 0 0 520px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; padding: 16px; max-height: calc(100vh - 150px); overflow: auto; }
    .editor h2 { margin: 16px 0 12px; font-size: 16px; }
    .editor h2:first-child { margin-top: 0; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 700; }
    input { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .wide { grid-column: 1 / -1; }
    .check-row { flex-direction: row; align-items: center; gap: 8px; }
    .check-row input { width: 16px; height: 16px; }
    .hours, .setting-row { display: flex; flex-direction: column; gap: 8px; }
    .hour-row, .setting-row { display: grid; grid-template-columns: 92px 1fr 1fr 86px; gap: 8px; align-items: center; }
    .setting-row { grid-template-columns: 1fr 1fr; margin-bottom: 8px; }
    .form-actions { justify-content: flex-end; margin-top: 16px; }
    .empty { text-align: center; color: var(--ac-muted); padding: 28px; }
    @media (max-width: 1180px) { .layout { flex-direction: column; } .editor { width: 100%; flex-basis: auto; max-height: none; } }
    @media (max-width: 760px) { .page-head, .toolbar { flex-direction: column; } .form-grid, .hour-row { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BranchManagementPageComponent implements OnInit {
  protected readonly permissions = permissions;
  protected readonly branches = signal<BranchSummary[]>([]);
  protected readonly form = signal<BranchProfile>(createEmptyBranch());
  protected readonly saving = signal(false);
  protected searchText = '';

  private readonly service = inject(BranchManagementService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    await this.loadBranches();
  }

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected can(permissionCode: string): boolean {
    return this.authStore.hasPermission(permissionCode);
  }

  protected dayKey(dayOfWeek: number): string {
    return `Common.Day.${dayOfWeek}`;
  }

  protected canSave(branch: BranchProfile): boolean {
    return branch.branchGuid ? this.can(permissions.edit) : this.can(permissions.create);
  }

  protected async loadBranches(): Promise<void> {
    const response = await this.service.search(this.searchText, true);
    if (response.success && response.data) {
      this.branches.set(response.data);
      return;
    }

    this.toast.error(this.t(response.message));
  }

  protected async selectBranch(branch: BranchSummary): Promise<void> {
    const response = await this.service.get(branch.branchGuid);
    if (response.success && response.data) {
      this.form.set(ensureWorkingHours(response.data));
      return;
    }

    this.toast.error(this.t(response.message));
  }

  protected startCreate(): void {
    this.form.set(createEmptyBranch());
  }

  protected addSetting(): void {
    const current = this.form();
    this.form.set({ ...current, configuration: [...current.configuration, createSetting()] });
  }

  protected async save(): Promise<void> {
    await this.saveOperation(
      () => this.form().branchGuid ? this.service.update(this.form()) : this.service.create(this.form()),
      'Administration.Branch.Messages.Saved');
  }

  protected async setStatus(branch: BranchSummary, isActive: boolean): Promise<void> {
    const messageKey = isActive ? 'Administration.Branch.Messages.Activated' : 'Administration.Branch.Messages.Deactivated';
    await this.saveOperation(() => this.service.setStatus(branch.branchGuid, isActive), messageKey);
  }

  protected async setDefault(branch: BranchSummary): Promise<void> {
    await this.saveOperation(() => this.service.setDefault(branch.branchGuid), 'Administration.Branch.Messages.DefaultUpdated');
  }

  private async saveOperation(operation: () => Promise<{ success: boolean; message: string; data: BranchProfile | null }>, successKey: string): Promise<void> {
    this.saving.set(true);
    try {
      const response = await operation();
      if (!response.success || !response.data) {
        this.toast.error(this.t(response.message));
        return;
      }

      this.form.set(ensureWorkingHours(response.data));
      await this.loadBranches();
      this.toast.success(this.t(successKey));
    } finally {
      this.saving.set(false);
    }
  }
}

function createEmptyBranch(): BranchProfile {
  return {
    branchGuid: '',
    hospitalGuid: '',
    branchCode: '',
    branchName: '',
    branchTypeCode: 'GENERAL',
    isDefault: false,
    address: { addressLine1: '', addressLine2: null, cityName: '', stateName: '', countryCode: 'IN', postalCode: '', latitude: null, longitude: null },
    contact: { primaryPhone: '', secondaryPhone: null, emergencyPhone: null, email: '', fax: null },
    workingHours: createDefaultHours(),
    configuration: [],
    isActive: true,
    createdDate: null,
    modifiedDate: null,
    rowVersion: ''
  };
}

function ensureWorkingHours(profile: BranchProfile): BranchProfile {
  const existing = new Map(profile.workingHours.map(hour => [hour.dayOfWeek, hour]));
  return { ...profile, workingHours: createDefaultHours().map(hour => existing.get(hour.dayOfWeek) ?? hour) };
}

function createDefaultHours(): BranchWorkingHour[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openTime: dayOfWeek === 0 ? null : '09:00',
    closeTime: dayOfWeek === 0 ? null : '18:00',
    isClosed: dayOfWeek === 0,
    notes: null,
    isActive: true
  }));
}

function createSetting(): BranchConfiguration {
  return { settingKey: '', settingValue: '', dataType: 'String', descriptionKey: null, isActive: true };
}
