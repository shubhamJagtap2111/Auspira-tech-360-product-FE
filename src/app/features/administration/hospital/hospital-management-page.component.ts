import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { HospitalProfile, HospitalSetting } from './hospital-management.models';
import { HospitalManagementService } from './hospital-management.service';

const permissions = {
  edit: 'Administration.Hospital.Edit',
  branding: 'Administration.Hospital.Branding',
  settings: 'Administration.Hospital.Settings',
  subscription: 'Administration.Hospital.Subscription'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="hospital-page">
      <header class="page-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Hospital.Title') }}</h1>
          <p>{{ t('Administration.Hospital.Subtitle') }}</p>
        </div>
        <button class="icon-btn" type="button" (click)="loadProfile()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </header>

      @if (profile(); as form) {
        <section class="layout">
          <div class="main-form">
            <section class="panel">
              <h2>{{ t('Administration.Hospital.Section.Profile') }}</h2>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.HospitalCode') }}</span><input name="hospitalCode" [(ngModel)]="form.hospitalCode" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.HospitalName') }}</span><input name="hospitalName" [(ngModel)]="form.hospitalName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.LegalName') }}</span><input name="legalName" [(ngModel)]="form.legalName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.ShortName') }}</span><input name="shortName" [(ngModel)]="form.shortName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.WebsiteUrl') }}</span><input name="websiteUrl" [(ngModel)]="form.websiteUrl" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.EstablishedDate') }}</span><input type="date" name="establishedDate" [(ngModel)]="form.establishedDate" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.PrimaryLanguageCode') }}</span><input name="primaryLanguageCode" [(ngModel)]="form.primaryLanguageCode" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.TimeZoneCode') }}</span><input name="timeZoneCode" [(ngModel)]="form.timeZoneCode" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.CurrencyCode') }}</span><input name="currencyCode" [(ngModel)]="form.currencyCode" /></label>
              </div>
            </section>

            <section class="panel">
              <h2>{{ t('Administration.Hospital.Section.Address') }}</h2>
              <div class="form-grid">
                <label class="wide"><span>{{ t('Administration.Hospital.Fields.AddressLine1') }}</span><input name="addressLine1" [(ngModel)]="form.address.addressLine1" /></label>
                <label class="wide"><span>{{ t('Administration.Hospital.Fields.AddressLine2') }}</span><input name="addressLine2" [(ngModel)]="form.address.addressLine2" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.CityName') }}</span><input name="cityName" [(ngModel)]="form.address.cityName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.StateName') }}</span><input name="stateName" [(ngModel)]="form.address.stateName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.CountryCode') }}</span><input name="countryCode" [(ngModel)]="form.address.countryCode" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.PostalCode') }}</span><input name="postalCode" [(ngModel)]="form.address.postalCode" /></label>
              </div>
            </section>

            <section class="panel">
              <h2>{{ t('Administration.Hospital.Section.Contact') }}</h2>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.PrimaryPhone') }}</span><input name="primaryPhone" [(ngModel)]="form.contact.primaryPhone" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.SecondaryPhone') }}</span><input name="secondaryPhone" [(ngModel)]="form.contact.secondaryPhone" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.EmergencyPhone') }}</span><input name="emergencyPhone" [(ngModel)]="form.contact.emergencyPhone" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.Email') }}</span><input type="email" name="email" [(ngModel)]="form.contact.email" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.Fax') }}</span><input name="fax" [(ngModel)]="form.contact.fax" /></label>
              </div>
            </section>

            <section class="panel">
              <h2>{{ t('Administration.Hospital.Section.License') }}</h2>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.LicenseNumber') }}</span><input name="licenseNumber" [(ngModel)]="form.license.licenseNumber" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.LicenseType') }}</span><input name="licenseType" [(ngModel)]="form.license.licenseType" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.IssuingAuthority') }}</span><input name="issuingAuthority" [(ngModel)]="form.license.issuingAuthority" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.ValidFrom') }}</span><input type="date" name="validFrom" [(ngModel)]="form.license.validFrom" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.ValidTo') }}</span><input type="date" name="validTo" [(ngModel)]="form.license.validTo" /></label>
              </div>
            </section>

            <section class="panel">
              <h2>{{ t('Administration.Hospital.Section.Gst') }}</h2>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.Gstin') }}</span><input name="gstin" [(ngModel)]="form.gst.gstin" maxlength="15" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.LegalBusinessName') }}</span><input name="legalBusinessName" [(ngModel)]="form.gst.legalBusinessName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.RegistrationState') }}</span><input name="registrationState" [(ngModel)]="form.gst.registrationState" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.RegistrationDate') }}</span><input type="date" name="registrationDate" [(ngModel)]="form.gst.registrationDate" /></label>
              </div>
            </section>

            @if (can(permissions.edit)) {
              <div class="save-row">
                <button class="ac-btn ac-btn-primary" type="button" (click)="saveProfile()" [disabled]="saving()">
                  <span class="material-symbols-rounded">save</span>
                  {{ t('Administration.Hospital.Actions.SaveProfile') }}
                </button>
              </div>
            }
          </div>

          <aside class="side-form">
            <section class="panel">
              <h2>{{ t('Administration.Hospital.Section.Branding') }}</h2>
              <label><span>{{ t('Administration.Hospital.Fields.LogoUrl') }}</span><input name="logoUrl" [(ngModel)]="form.branding.logoUrl" /></label>
              <label><span>{{ t('Administration.Hospital.Fields.FaviconUrl') }}</span><input name="faviconUrl" [(ngModel)]="form.branding.faviconUrl" /></label>
              <div class="color-grid">
                <label><span>{{ t('Administration.Hospital.Fields.PrimaryColor') }}</span><input type="color" name="primaryColor" [(ngModel)]="form.branding.primaryColor" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.SecondaryColor') }}</span><input type="color" name="secondaryColor" [(ngModel)]="form.branding.secondaryColor" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.AccentColor') }}</span><input type="color" name="accentColor" [(ngModel)]="form.branding.accentColor" /></label>
              </div>
              @if (can(permissions.branding)) {
                <button class="ac-btn ac-btn-secondary" type="button" (click)="saveBranding()" [disabled]="saving()">
                  {{ t('Administration.Hospital.Actions.SaveBranding') }}
                </button>
              }
            </section>

            @if (can(permissions.subscription)) {
              <section class="panel">
                <h2>{{ t('Administration.Hospital.Section.Subscription') }}</h2>
                <dl>
                  <dt>{{ t('Administration.Hospital.Fields.PlanName') }}</dt><dd>{{ t(form.subscription.planNameKey) }}</dd>
                  <dt>{{ t('Administration.Hospital.Fields.SubscriptionStatus') }}</dt><dd>{{ t(subscriptionStatusKey(form.subscription.statusCode)) }}</dd>
                  <dt>{{ t('Administration.Hospital.Fields.SubscriptionEndDate') }}</dt><dd>{{ form.subscription.endDate || '-' }}</dd>
                  <dt>{{ t('Administration.Hospital.Fields.MaxUsers') }}</dt><dd>{{ form.subscription.maxUsers ?? '-' }}</dd>
                  <dt>{{ t('Administration.Hospital.Fields.MaxBranches') }}</dt><dd>{{ form.subscription.maxBranches ?? '-' }}</dd>
                </dl>
              </section>
            }

            <section class="panel">
              <h2>{{ t('Administration.Hospital.Section.Settings') }}</h2>
              @for (setting of form.settings; track setting.settingKey; let index = $index) {
                <div class="setting-row">
                  <input [name]="'settingKey_' + index" [(ngModel)]="setting.settingKey" [attr.aria-label]="t('Administration.Hospital.Fields.SettingKey')" />
                  <input [name]="'settingValue_' + index" [(ngModel)]="setting.settingValue" [attr.aria-label]="t('Administration.Hospital.Fields.SettingValue')" />
                </div>
              }
              @if (can(permissions.settings)) {
                <div class="side-actions">
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="addSetting()">{{ t('Administration.Hospital.Actions.AddSetting') }}</button>
                  <button class="ac-btn ac-btn-primary" type="button" (click)="saveSettings()" [disabled]="saving()">{{ t('Administration.Hospital.Actions.SaveSettings') }}</button>
                </div>
              }
            </section>
          </aside>
        </section>
      }
    </section>
  `,
  styles: `
    .hospital-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .layout, .save-row, .side-actions { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .layout { align-items: flex-start; }
    .main-form { flex: 1 1 auto; display: flex; flex-direction: column; gap: 12px; }
    .side-form { width: min(380px, 100%); flex: 0 0 380px; display: flex; flex-direction: column; gap: 12px; }
    .panel { border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 8px; padding: 16px; }
    .panel h2 { margin: 0 0 14px; font-size: 16px; }
    .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .wide { grid-column: span 2; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 700; }
    input { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    input[type="color"] { padding: 4px; }
    .color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
    .save-row { justify-content: flex-end; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin: 0; font-size: 13px; }
    dt { color: var(--ac-muted); font-weight: 700; }
    dd { margin: 0; color: var(--ac-text); text-align: right; }
    .setting-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .side-actions { justify-content: flex-end; margin-top: 8px; }
    @media (max-width: 1120px) { .layout { flex-direction: column; } .side-form { width: 100%; flex-basis: auto; } }
    @media (max-width: 760px) { .page-head { flex-direction: column; } .form-grid, .color-grid { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HospitalManagementPageComponent implements OnInit {
  protected readonly permissions = permissions;
  private readonly service = inject(HospitalManagementService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  protected readonly profile = signal<HospitalProfile | null>(null);
  protected readonly saving = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected can(permissionCode: string): boolean {
    return this.authStore.hasPermission(permissionCode);
  }

  protected subscriptionStatusKey(statusCode: string): string {
    return `Hospital.Subscription.Status.${statusCode || 'UNKNOWN'}`;
  }

  protected async loadProfile(): Promise<void> {
    const response = await this.service.getProfile();
    if (response.success && response.data) {
      this.profile.set(response.data);
      return;
    }

    this.toast.error(this.t(response.message));
  }

  protected async saveProfile(): Promise<void> {
    const current = this.profile();
    if (!current) {
      return;
    }

    await this.save(() => this.service.updateProfile(current), 'Administration.Hospital.Messages.Updated');
  }

  protected async saveBranding(): Promise<void> {
    const current = this.profile();
    if (!current) {
      return;
    }

    await this.save(() => this.service.updateBranding(current.branding), 'Administration.Hospital.Messages.BrandingUpdated');
  }

  protected async saveSettings(): Promise<void> {
    const current = this.profile();
    if (!current) {
      return;
    }

    await this.save(() => this.service.updateSettings(current.settings), 'Administration.Hospital.Messages.SettingsUpdated');
  }

  protected addSetting(): void {
    const current = this.profile();
    if (!current) {
      return;
    }

    this.profile.set({ ...current, settings: [...current.settings, createSetting()] });
  }

  private async save(operation: () => Promise<{ success: boolean; message: string; data: HospitalProfile | null }>, successKey: string): Promise<void> {
    this.saving.set(true);
    try {
      const response = await operation();
      if (!response.success || !response.data) {
        this.toast.error(this.t(response.message));
        return;
      }

      this.profile.set(response.data);
      this.toast.success(this.t(successKey));
    } finally {
      this.saving.set(false);
    }
  }
}

function createSetting(): HospitalSetting {
  return {
    settingKey: '',
    settingValue: '',
    dataType: 'String',
    descriptionKey: null,
    isActive: true
  };
}
