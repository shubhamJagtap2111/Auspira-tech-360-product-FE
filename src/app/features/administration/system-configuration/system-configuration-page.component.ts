import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AcDropdownComponent } from '../../../shared/ui/dropdown/dropdown.component';
import { FiscalYear, NotificationTemplate, NumberSeries, SystemConfigurationSetting } from './system-configuration.models';
import { SystemConfigurationService } from './system-configuration.service';

const permissions = {
  edit: 'Administration.SystemConfiguration.Edit',
  security: 'Administration.SystemConfiguration.Security',
  notifications: 'Administration.SystemConfiguration.Notifications',
  numberSeries: 'Administration.SystemConfiguration.NumberSeries',
  fiscalYear: 'Administration.SystemConfiguration.FiscalYear',
  theme: 'Administration.SystemConfiguration.Theme',
  branding: 'Administration.SystemConfiguration.Branding'
};

const resetFrequencies = ['NONE', 'FISCAL_YEAR', 'YEAR', 'MONTH', 'DAY'];
const channels = ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'];
const languages = ['en-US', 'hi-IN', 'mr-IN'];
type ConfigEditorMode = 'number-series' | 'fiscal-year' | 'template';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent],
  template: `
    <section class="config-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.SystemConfiguration.Title') }}</h1>
          <p>{{ t('Administration.SystemConfiguration.Subtitle') }}</p>
        </div>
        <button class="icon-btn" type="button" (click)="load()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </header>

      <section class="panel settings-panel">
        <div class="section-head">
          <h2>{{ t('Administration.SystemConfiguration.Section.Settings') }}</h2>
          @if (can(permissions.edit)) {
            <button class="ac-btn ac-btn-primary" type="button" (click)="saveSettings()" [disabled]="saving()">
              <span class="material-symbols-rounded">save</span>
              {{ t('Administration.SystemConfiguration.Actions.SaveSettings') }}
            </button>
          }
        </div>

        <div class="settings-grid">
          @for (setting of settings(); track setting.settingKey) {
            @if (canEditCategory(setting.settingCategoryCode)) {
              <label class="setting-row">
                <span>{{ t(setting.displayNameKey) }}</span>
                @if (setting.dataType === 'Boolean') {
                  <input type="checkbox" [name]="setting.settingKey" [ngModel]="setting.settingValue === 'true'" (ngModelChange)="setting.settingValue = $event ? 'true' : 'false'" />
                } @else {
                  <input [name]="setting.settingKey" [(ngModel)]="setting.settingValue" />
                }
              </label>
            }
          } @empty {
            <p class="empty">{{ t('Administration.SystemConfiguration.Empty') }}</p>
          }
        </div>
      </section>

      <section class="workspace">
        <div class="panel">
          <div class="section-head">
            <h2>{{ t('Administration.SystemConfiguration.Section.NumberSeries') }}</h2>
            @if (can(permissions.numberSeries)) {
              <button class="ac-btn ac-btn-secondary" type="button" (click)="newNumberSeries()">{{ t('Administration.SystemConfiguration.Actions.NewNumberSeries') }}</button>
            }
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ t('Administration.SystemConfiguration.Columns.Code') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Columns.Name') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Fields.NextNumber') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Columns.Status') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Columns.Actions') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of numberSeries(); track item.numberSeriesGuid) {
                  <tr [class.selected]="numberSeriesForm().numberSeriesGuid === item.numberSeriesGuid">
                    <td><button class="link-btn" type="button" (click)="editNumberSeries(item)"><strong>{{ item.seriesCode }}</strong><span>{{ item.prefix }}{{ item.suffix || '' }}</span></button></td>
                    <td>{{ t(item.seriesNameKey) }}</td>
                    <td>{{ item.nextNumber }}</td>
                    <td><span class="status" [class.inactive]="!item.isActive">{{ t(item.isActive ? 'Administration.UserManagement.Status.Active' : 'Administration.UserManagement.Status.Inactive') }}</span></td>
                    <td>
                      @if (can(permissions.numberSeries)) {
                        <div class="row-actions">
                          <button class="icon-btn" type="button" (click)="editNumberSeries(item)" [attr.title]="t('Administration.UserManagement.Actions.Edit')"><span class="material-symbols-rounded">edit</span></button>
                          <button class="icon-btn" type="button" (click)="setNumberSeriesStatus(item, !item.isActive)" [attr.title]="t(item.isActive ? 'Administration.SystemConfiguration.Actions.Deactivate' : 'Administration.SystemConfiguration.Actions.Activate')"><span class="material-symbols-rounded">{{ item.isActive ? 'block' : 'check_circle' }}</span></button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </div>

        <div class="panel">
          <div class="section-head">
            <h2>{{ t('Administration.SystemConfiguration.Section.FiscalYear') }}</h2>
            @if (can(permissions.fiscalYear)) {
              <button class="ac-btn ac-btn-secondary" type="button" (click)="newFiscalYear()">{{ t('Administration.SystemConfiguration.Actions.NewFiscalYear') }}</button>
            }
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ t('Administration.SystemConfiguration.Fields.FiscalYearCode') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Fields.StartDate') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Fields.EndDate') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Columns.Status') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Columns.Actions') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of fiscalYears(); track item.fiscalYearGuid) {
                  <tr [class.selected]="fiscalYearForm().fiscalYearGuid === item.fiscalYearGuid">
                    <td><button class="link-btn" type="button" (click)="editFiscalYear(item)"><strong>{{ item.fiscalYearCode }}</strong><span>{{ item.isCurrent ? t('Administration.SystemConfiguration.Fields.Current') : '' }}</span></button></td>
                    <td>{{ item.startDate | date: 'yyyy-MM-dd' }}</td>
                    <td>{{ item.endDate | date: 'yyyy-MM-dd' }}</td>
                    <td><span class="status" [class.inactive]="item.isClosed">{{ t(item.isClosed ? 'Administration.SystemConfiguration.Fields.Closed' : 'Administration.UserManagement.Status.Active') }}</span></td>
                    <td>
                      @if (can(permissions.fiscalYear)) {
                        <div class="row-actions">
                          <button class="icon-btn" type="button" (click)="editFiscalYear(item)" [attr.title]="t('Administration.UserManagement.Actions.Edit')"><span class="material-symbols-rounded">edit</span></button>
                          <button class="icon-btn" type="button" (click)="setFiscalYearStatus(item, !item.isClosed)" [attr.title]="t(item.isClosed ? 'Administration.SystemConfiguration.Actions.OpenFiscalYear' : 'Administration.SystemConfiguration.Actions.CloseFiscalYear')"><span class="material-symbols-rounded">{{ item.isClosed ? 'lock_open' : 'lock' }}</span></button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>{{ t('Administration.SystemConfiguration.Section.NotificationTemplates') }}</h2>
          @if (can(permissions.notifications)) {
            <button class="ac-btn ac-btn-secondary" type="button" (click)="newTemplate()">{{ t('Administration.SystemConfiguration.Actions.NewTemplate') }}</button>
          }
        </div>

        <div class="template-layout">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ t('Administration.SystemConfiguration.Fields.TemplateCode') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Fields.Channel') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Fields.Language') }}</th>
                  <th>{{ t('Administration.SystemConfiguration.Columns.Actions') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of templates(); track item.notificationTemplateGuid) {
                  <tr [class.selected]="templateForm().notificationTemplateGuid === item.notificationTemplateGuid">
                    <td><button class="link-btn" type="button" (click)="editTemplate(item)"><strong>{{ item.templateCode }}</strong><span>{{ item.subjectTemplate || '-' }}</span></button></td>
                    <td>{{ t('Administration.SystemConfiguration.Channel.' + item.channelCode) }}</td>
                    <td>{{ item.languageName }}</td>
                    <td>
                      @if (can(permissions.notifications)) {
                        <div class="row-actions">
                          <button class="icon-btn" type="button" (click)="editTemplate(item)" [attr.title]="t('Administration.UserManagement.Actions.Edit')"><span class="material-symbols-rounded">edit</span></button>
                          <button class="icon-btn" type="button" (click)="setTemplateStatus(item, !item.isActive)" [attr.title]="t(item.isActive ? 'Administration.SystemConfiguration.Actions.Deactivate' : 'Administration.SystemConfiguration.Actions.Activate')"><span class="material-symbols-rounded">{{ item.isActive ? 'block' : 'check_circle' }}</span></button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </div>
      </section>

      @if (editorMode(); as mode) {
        <aside class="ac-admin-drawer">
          <div class="ac-admin-drawer-head">
            <div class="ac-admin-drawer-title">
              <span class="ac-admin-drawer-icon material-symbols-rounded">{{ editorIcon(mode) }}</span>
              <div>
                <p>{{ t('Administration.SystemConfiguration.Title') }}</p>
                <h2>{{ editorTitle(mode) }}</h2>
              </div>
            </div>
            <button class="icon-btn" type="button" (click)="closeEditor()" title="Close editor"><span class="material-symbols-rounded">close</span></button>
          </div>
          <div class="ac-admin-drawer-summary">
            @if (mode === 'number-series') {
              <span class="ac-admin-pill"><span class="material-symbols-rounded">tag</span>{{ numberSeriesForm().seriesCode || 'NEW' }}</span>
              <span class="ac-admin-pill"><span class="material-symbols-rounded">pin</span>{{ numberSeriesForm().nextNumber }}</span>
            }
            @if (mode === 'fiscal-year') {
              <span class="ac-admin-pill"><span class="material-symbols-rounded">event</span>{{ fiscalYearForm().fiscalYearCode || 'NEW' }}</span>
              @if (fiscalYearForm().isCurrent) { <span class="ac-admin-pill featured"><span class="material-symbols-rounded">check_circle</span>{{ t('Administration.SystemConfiguration.Fields.Current') }}</span> }
            }
            @if (mode === 'template') {
              <span class="ac-admin-pill"><span class="material-symbols-rounded">draft</span>{{ templateForm().templateCode || 'NEW' }}</span>
              <span class="ac-admin-pill"><span class="material-symbols-rounded">language</span>{{ templateForm().languageCode }}</span>
            }
          </div>
          <div class="ac-admin-drawer-body">
            @if (mode === 'number-series') {
              <section class="ac-admin-form-section">
                <div class="ac-admin-section-title"><span class="material-symbols-rounded">format_list_numbered</span><h3>{{ t('Administration.SystemConfiguration.Section.NumberSeries') }}</h3></div>
                <div class="ac-admin-form-grid">
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.SeriesCode') }}</span><input name="seriesCode" [(ngModel)]="numberSeriesForm().seriesCode" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.SeriesNameKey') }}</span><input name="seriesNameKey" [(ngModel)]="numberSeriesForm().seriesNameKey" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.Prefix') }}</span><input name="prefix" [(ngModel)]="numberSeriesForm().prefix" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.Suffix') }}</span><input name="suffix" [(ngModel)]="numberSeriesForm().suffix" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.NextNumber') }}</span><input type="number" name="nextNumber" [(ngModel)]="numberSeriesForm().nextNumber" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.PaddingLength') }}</span><input type="number" name="paddingLength" [(ngModel)]="numberSeriesForm().paddingLength" /></label>
                  <label class="ac-admin-wide"><span>{{ t('Administration.SystemConfiguration.Fields.ResetFrequency') }}</span><ac-dropdown name="resetFrequency" [(ngModel)]="numberSeriesForm().resetFrequencyCode" [options]="resetFrequencyOptions()" /></label>
                </div>
              </section>
            }
            @if (mode === 'fiscal-year') {
              <section class="ac-admin-form-section">
                <div class="ac-admin-section-title"><span class="material-symbols-rounded">event_available</span><h3>{{ t('Administration.SystemConfiguration.Section.FiscalYear') }}</h3></div>
                <div class="ac-admin-form-grid">
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.FiscalYearCode') }}</span><input name="fiscalYearCode" [(ngModel)]="fiscalYearForm().fiscalYearCode" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.StartDate') }}</span><input type="date" name="startDate" [(ngModel)]="fiscalYearForm().startDate" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.EndDate') }}</span><input type="date" name="endDate" [(ngModel)]="fiscalYearForm().endDate" /></label>
                  <label class="ac-admin-switch-row"><input type="checkbox" name="isCurrent" [(ngModel)]="fiscalYearForm().isCurrent" /><span>{{ t('Administration.SystemConfiguration.Fields.Current') }}</span></label>
                  <label class="ac-admin-switch-row"><input type="checkbox" name="isClosed" [(ngModel)]="fiscalYearForm().isClosed" /><span>{{ t('Administration.SystemConfiguration.Fields.Closed') }}</span></label>
                </div>
              </section>
            }
            @if (mode === 'template') {
              <section class="ac-admin-form-section">
                <div class="ac-admin-section-title"><span class="material-symbols-rounded">notifications</span><h3>{{ t('Administration.SystemConfiguration.Section.NotificationTemplates') }}</h3></div>
                <div class="ac-admin-form-grid">
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.TemplateCode') }}</span><input name="templateCode" [(ngModel)]="templateForm().templateCode" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.Channel') }}</span><ac-dropdown name="channelCode" [(ngModel)]="templateForm().channelCode" [options]="channelOptions()" /></label>
                  <label><span>{{ t('Administration.SystemConfiguration.Fields.Language') }}</span><ac-dropdown name="languageCode" [(ngModel)]="templateForm().languageCode" [options]="templateLanguageOptions()" /></label>
                  <label class="ac-admin-wide"><span>{{ t('Administration.SystemConfiguration.Fields.Subject') }}</span><input name="subjectTemplate" [(ngModel)]="templateForm().subjectTemplate" /></label>
                  <label class="ac-admin-wide"><span>{{ t('Administration.SystemConfiguration.Fields.Body') }}</span><textarea name="bodyTemplate" [(ngModel)]="templateForm().bodyTemplate"></textarea></label>
                </div>
              </section>
            }
          </div>
          <div class="ac-admin-drawer-actions">
            <button class="ac-btn ac-btn-secondary" type="button" (click)="closeEditor()">{{ t('Common.Actions.Cancel') }}</button>
            @if (mode === 'number-series') {
              <button class="ac-btn ac-btn-primary" type="button" (click)="saveNumberSeries()" [disabled]="saving()"><span class="material-symbols-rounded">save</span>{{ t('Administration.SystemConfiguration.Actions.SaveNumberSeries') }}</button>
            }
            @if (mode === 'fiscal-year') {
              <button class="ac-btn ac-btn-primary" type="button" (click)="saveFiscalYear()" [disabled]="saving()"><span class="material-symbols-rounded">save</span>{{ t('Administration.SystemConfiguration.Actions.SaveFiscalYear') }}</button>
            }
            @if (mode === 'template') {
              <button class="ac-btn ac-btn-primary" type="button" (click)="saveTemplate()" [disabled]="saving()"><span class="material-symbols-rounded">save</span>{{ t('Administration.SystemConfiguration.Actions.SaveTemplate') }}</button>
            }
          </div>
        </aside>
      }
    </section>
  `,
  styles: `
    .config-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .section-head, .workspace, .row-actions { display: flex; gap: 12px; }
    .page-head, .section-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .panel { border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; padding: 16px; }
    .panel h2 { margin: 0; font-size: 16px; }
    .settings-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .workspace > .panel { flex: 1 1 0; min-width: 0; }
    .table-wrap { margin-top: 14px; overflow: auto; border: 1px solid var(--ac-border); border-radius: 8px; }
    table { width: 100%; min-width: 620px; border-collapse: collapse; }
    th, td { padding: 11px 12px; border-bottom: 1px solid var(--ac-border); text-align: left; font-size: 13px; vertical-align: middle; }
    th { background: var(--ac-bg); color: var(--ac-muted); font-size: 11px; text-transform: uppercase; }
    tr.selected td { background: rgba(37,99,235,.06); }
    .link-btn { border: 0; background: transparent; padding: 0; display: flex; flex-direction: column; gap: 3px; color: var(--ac-text); text-align: left; cursor: pointer; }
    .link-btn span { color: var(--ac-muted); font-size: 12px; }
    .status { padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.1); color: #15803d; font-size: 11px; font-weight: 800; }
    .status.inactive { background: rgba(100,116,139,.12); color: #475569; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .template-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 420px); gap: 14px; align-items: start; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 700; }
    input, select, textarea { border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    input, select { height: 38px; }
    textarea { min-height: 140px; padding: 10px; resize: vertical; }
    input[type="checkbox"] { width: 16px; height: 16px; padding: 0; }
    .check-row { flex-direction: row; align-items: center; gap: 8px; }
    .align-end { align-self: end; justify-self: end; }
    .empty { color: var(--ac-muted); margin: 0; }
    @media (max-width: 1180px) { .workspace, .template-layout { flex-direction: column; display: flex; } .settings-grid, .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .page-head, .section-head { flex-direction: column; } .settings-grid, .form-grid { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SystemConfigurationPageComponent implements OnInit {
  protected readonly permissions = permissions;
  protected readonly resetFrequencies = resetFrequencies;
  protected readonly channels = channels;
  protected readonly languages = languages;
  protected readonly settings = signal<SystemConfigurationSetting[]>([]);
  protected readonly numberSeries = signal<NumberSeries[]>([]);
  protected readonly fiscalYears = signal<FiscalYear[]>([]);
  protected readonly templates = signal<NotificationTemplate[]>([]);
  protected readonly numberSeriesForm = signal<NumberSeries>(createEmptyNumberSeries());
  protected readonly fiscalYearForm = signal<FiscalYear>(createEmptyFiscalYear());
  protected readonly templateForm = signal<NotificationTemplate>(createEmptyTemplate());
  protected readonly editorMode = signal<ConfigEditorMode | null>(null);
  protected readonly saving = signal(false);

  private readonly service = inject(SystemConfigurationService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> { await this.load(); }
  protected t(key: string): string { return this.i18n.translate(key); }
  protected can(permission: string): boolean { return this.auth.hasPermission(permission); }

  protected resetFrequencyOptions() {
    return this.resetFrequencies.map(code => ({
      label: this.t('Administration.SystemConfiguration.ResetFrequency.' + code),
      value: code
    }));
  }

  protected channelOptions() {
    return this.channels.map(code => ({
      label: this.t('Administration.SystemConfiguration.Channel.' + code),
      value: code
    }));
  }

  protected templateLanguageOptions() {
    return this.languages.map(code => ({ label: code, value: code }));
  }

  protected canEditCategory(categoryCode: string): boolean {
    return this.can(permissions.edit) && (categoryPermission(categoryCode) === null || this.can(categoryPermission(categoryCode)!));
  }

  protected async load(): Promise<void> {
    const response = await this.service.getCatalog();
    if (!response.success || !response.data) { this.toast.error(this.t(response.message)); return; }
    this.settings.set(response.data.settings);
    this.numberSeries.set(response.data.numberSeries);
    this.fiscalYears.set(normalizeDates(response.data.fiscalYears));
    this.templates.set(response.data.notificationTemplates);
    this.numberSeriesForm.set(response.data.numberSeries[0] ? { ...response.data.numberSeries[0] } : createEmptyNumberSeries());
    this.fiscalYearForm.set(response.data.fiscalYears[0] ? { ...normalizeFiscalYear(response.data.fiscalYears[0]) } : createEmptyFiscalYear());
    this.templateForm.set(response.data.notificationTemplates[0] ? { ...response.data.notificationTemplates[0] } : createEmptyTemplate());
  }

  protected async saveSettings(): Promise<void> {
    await this.saveOperation(async () => {
      const response = await this.service.saveSettings(this.settings().filter(setting => this.canEditCategory(setting.settingCategoryCode)));
      if (response.success && response.data) { this.settings.set(response.data); }
      return response;
    }, 'Administration.SystemConfiguration.Messages.SettingsSaved');
  }

  protected newNumberSeries(): void { this.numberSeriesForm.set(createEmptyNumberSeries()); this.editorMode.set('number-series'); }
  protected editNumberSeries(item: NumberSeries): void { this.numberSeriesForm.set({ ...item }); this.editorMode.set('number-series'); }
  protected async saveNumberSeries(): Promise<void> { await this.saveOperation(() => this.service.saveNumberSeries(this.numberSeriesForm()), 'Administration.SystemConfiguration.Messages.NumberSeriesSaved'); }
  protected async setNumberSeriesStatus(item: NumberSeries, isActive: boolean): Promise<void> {
    const key = isActive ? 'Administration.SystemConfiguration.Messages.NumberSeriesActivated' : 'Administration.SystemConfiguration.Messages.NumberSeriesDeactivated';
    await this.saveOperation(() => this.service.setNumberSeriesStatus(item.numberSeriesGuid, isActive), key);
  }

  protected newFiscalYear(): void { this.fiscalYearForm.set(createEmptyFiscalYear()); this.editorMode.set('fiscal-year'); }
  protected editFiscalYear(item: FiscalYear): void { this.fiscalYearForm.set({ ...normalizeFiscalYear(item) }); this.editorMode.set('fiscal-year'); }
  protected async saveFiscalYear(): Promise<void> { await this.saveOperation(() => this.service.saveFiscalYear(this.fiscalYearForm()), 'Administration.SystemConfiguration.Messages.FiscalYearSaved'); }
  protected async setFiscalYearStatus(item: FiscalYear, isClosed: boolean): Promise<void> {
    const key = isClosed ? 'Administration.SystemConfiguration.Messages.FiscalYearClosed' : 'Administration.SystemConfiguration.Messages.FiscalYearOpened';
    await this.saveOperation(() => this.service.setFiscalYearStatus(item.fiscalYearGuid, isClosed), key);
  }

  protected newTemplate(): void { this.templateForm.set(createEmptyTemplate()); this.editorMode.set('template'); }
  protected editTemplate(item: NotificationTemplate): void { this.templateForm.set({ ...item }); this.editorMode.set('template'); }
  protected async saveTemplate(): Promise<void> { await this.saveOperation(() => this.service.saveTemplate(this.templateForm()), 'Administration.SystemConfiguration.Messages.TemplateSaved'); }
  protected async setTemplateStatus(item: NotificationTemplate, isActive: boolean): Promise<void> {
    const key = isActive ? 'Administration.SystemConfiguration.Messages.TemplateActivated' : 'Administration.SystemConfiguration.Messages.TemplateDeactivated';
    await this.saveOperation(() => this.service.setTemplateStatus(item.notificationTemplateGuid, isActive), key);
  }

  protected closeEditor(): void {
    this.editorMode.set(null);
  }

  protected editorTitle(mode: ConfigEditorMode): string {
    if (mode === 'number-series') {
      return this.t('Administration.SystemConfiguration.Section.NumberSeries');
    }

    if (mode === 'fiscal-year') {
      return this.t('Administration.SystemConfiguration.Section.FiscalYear');
    }

    return this.t('Administration.SystemConfiguration.Section.NotificationTemplates');
  }

  protected editorIcon(mode: ConfigEditorMode): string {
    if (mode === 'number-series') {
      return 'format_list_numbered';
    }

    if (mode === 'fiscal-year') {
      return 'event_available';
    }

    return 'notifications';
  }

  private async saveOperation(operation: () => Promise<{ success: boolean; message: string; data: unknown }>, successKey: string): Promise<void> {
    this.saving.set(true);
    try {
      const response = await operation();
      if (!response.success) { this.toast.error(this.t(response.message)); return; }
      await this.load();
      this.closeEditor();
      this.toast.success(this.t(successKey));
    } finally {
      this.saving.set(false);
    }
  }
}

function categoryPermission(categoryCode: string): string | null {
  switch (categoryCode) {
    case 'SECURITY': return permissions.security;
    case 'COMMUNICATION': return permissions.notifications;
    case 'THEME': return permissions.theme;
    case 'BRANDING': return permissions.branding;
    default: return null;
  }
}

function createEmptyNumberSeries(): NumberSeries {
  return { numberSeriesGuid: '', seriesCode: '', seriesNameKey: '', prefix: '', suffix: null, nextNumber: 1, paddingLength: 5, resetFrequencyCode: 'NONE', lastResetDate: null, isActive: true, createdDate: null, modifiedDate: null, rowVersion: '' };
}

function createEmptyFiscalYear(): FiscalYear {
  return { fiscalYearGuid: '', fiscalYearCode: '', startDate: '', endDate: '', isCurrent: false, isClosed: false, isActive: true, createdDate: null, modifiedDate: null, rowVersion: '' };
}

function createEmptyTemplate(): NotificationTemplate {
  return { notificationTemplateGuid: '', templateCode: '', channelCode: 'EMAIL', languageCode: 'en-US', languageName: '', subjectTemplate: null, bodyTemplate: '', isActive: true, createdDate: null, modifiedDate: null, rowVersion: '' };
}

function normalizeDates(items: FiscalYear[]): FiscalYear[] {
  return items.map(normalizeFiscalYear);
}

function normalizeFiscalYear(item: FiscalYear): FiscalYear {
  return { ...item, startDate: item.startDate?.substring(0, 10) ?? '', endDate: item.endDate?.substring(0, 10) ?? '' };
}
