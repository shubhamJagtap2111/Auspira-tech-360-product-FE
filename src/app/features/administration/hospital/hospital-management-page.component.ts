import { HospitalSaveSection, mergeHospitalSave, hasHospitalDraft } from './hospital-profile-save';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { BranchContextService } from '../../../core/context/branch-context.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AcAdminDrawerComponent } from '../../../shared/ui/admin-drawer/admin-drawer.component';
import { AcGridLoaderComponent } from '../../../shared/ui/grid-loader/grid-loader.component';
import { AcDropdownComponent } from '../../../shared/ui/dropdown/dropdown.component';
import { HospitalProfile, HospitalSetting } from './hospital-management.models';
import { HospitalManagementService } from './hospital-management.service';

const permissions = {
  edit: 'Administration.Hospital.Edit',
  branding: 'Administration.Hospital.Branding',
  settings: 'Administration.Hospital.Settings',
  subscription: 'Administration.Hospital.Subscription'
};
type HospitalProfileDrawer = 'branding' | 'settings' | 'subscription';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcAdminDrawerComponent, AcGridLoaderComponent, AcDropdownComponent],
  template: `
    <section class="hospital-page ac-workspace">
      <header class="page-head ac-workspace-head">
        <div>
          <h1 class="ac-page-title">{{ t('Administration.Hospital.Title') }}</h1>
          <p>{{ t('Administration.Hospital.Subtitle') }}</p>
        </div>
        <div class="head-actions">
          @if (profile() && can(permissions.edit)) {
            <button class="ac-btn ac-btn-primary" type="button" (click)="saveProfile()" [disabled]="saving()">
              <span class="material-symbols-rounded">save</span>
              {{ t('Administration.Hospital.Actions.SaveProfile') }}
            </button>
          }
          <button class="icon-btn" type="button" (click)="loadProfile()" [disabled]="saving() || loading()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (loading()) {
        <ac-grid-loader title="Loading hospital profile..." message="Preparing hospital administration details." />
      }

      @if (loadError()) {
        <section class="panel error-state">
          <span class="material-symbols-rounded">cloud_off</span>
          <div>
            <h2>{{ t('Common.Errors.UnhandledException') }}</h2>
            <p>{{ loadError() }}</p>
          </div>
          <button class="ac-btn ac-btn-primary" type="button" (click)="loadProfile()">
            <span class="material-symbols-rounded">refresh</span>
            {{ t('Administration.Rbac.Actions.Refresh') }}
          </button>
        </section>
      } @else if (profile(); as form) {
        <section class="overview-panel">
          <div class="hospital-mark">
            <span class="material-symbols-rounded">local_hospital</span>
          </div>
          <div class="overview-copy">
            <span>Hospital workspace</span>
            <h2>{{ form.hospitalName || 'Hospital name not set' }}</h2>
            <p>{{ form.hospitalCode || 'Code pending' }} · {{ form.address.cityName || 'City not set' }}{{ form.address.stateName ? ', ' + form.address.stateName : '' }}</p>
            <div class="overview-chips">
              <span><i></i>{{ form.isActive ? 'Active' : 'Inactive' }}</span>
              <span>{{ form.primaryLanguageCode || 'Language pending' }}</span>
              <span>{{ form.timeZoneCode || 'Time zone pending' }}</span>
              <span>{{ form.currencyCode || 'Currency pending' }}</span>
            </div>
          </div>
          <div class="overview-actions">
            @if (can(permissions.branding)) {
              <button class="ac-btn ac-btn-secondary" type="button" (click)="openDrawer('branding')">
                <span class="material-symbols-rounded">palette</span>
                {{ t('Administration.Hospital.Section.Branding') }}
              </button>
            }
            @if (can(permissions.settings)) {
              <button class="ac-btn ac-btn-secondary" type="button" (click)="openDrawer('settings')">
                <span class="material-symbols-rounded">tune</span>
                {{ t('Administration.Hospital.Section.Settings') }}
              </button>
            }
            @if (can(permissions.subscription)) {
              <button class="ac-btn ac-btn-secondary" type="button" (click)="openDrawer('subscription')">
                <span class="material-symbols-rounded">workspace_premium</span>
                {{ t('Administration.Hospital.Section.Subscription') }}
              </button>
            }
          </div>
        </section>

        <section class="layout">
          <div class="main-form">
            <section class="panel" id="hospital-profile" tabindex="-1" aria-label="Hospital profile">
              <div class="section-title">
                <span class="material-symbols-rounded">badge</span>
                <div>
                  <h2>{{ t('Administration.Hospital.Section.Profile') }}</h2>
                  <p>Core identity and localization used across Care360.</p>
                </div>
              </div>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.HospitalCode') }}</span><input name="hospitalCode" [(ngModel)]="form.hospitalCode" /></label>
                <label><span>Hospital name *</span><input name="hospitalName" [(ngModel)]="form.hospitalName" required placeholder="Hospital name shown on prescriptions" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.LegalName') }}</span><input name="legalName" [(ngModel)]="form.legalName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.ShortName') }}</span><input name="shortName" [(ngModel)]="form.shortName" /></label>
                <label><span>Website</span><input type="url" name="websiteUrl" [(ngModel)]="form.websiteUrl" placeholder="https://hospital.com" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.EstablishedDate') }}</span><input type="date" name="establishedDate" [(ngModel)]="form.establishedDate" /></label>
                <label><span>Default language</span><ac-dropdown name="primaryLanguageCode" [(ngModel)]="form.primaryLanguageCode" [options]="[{label:'English',value:'en-US'},{label:'Hindi',value:'hi-IN'},{label:'Marathi',value:'mr-IN'}]" /></label>
                <label><span>Time zone</span><ac-dropdown name="timeZoneCode" [(ngModel)]="form.timeZoneCode" [options]="[{label:'India (IST)',value:'Asia/Kolkata'},{label:'UTC',value:'UTC'}]" /></label>
                <label><span>Currency</span><ac-dropdown name="currencyCode" [(ngModel)]="form.currencyCode" [options]="[{label:'Indian Rupee (INR)',value:'INR'},{label:'US Dollar (USD)',value:'USD'},{label:'UAE Dirham (AED)',value:'AED'}]" /></label>
              </div>
            </section>

            <section class="panel" id="hospital-address" tabindex="-1" aria-label="Hospital address">
              <div class="section-title">
                <span class="material-symbols-rounded">location_on</span>
                <div>
                  <h2>{{ t('Administration.Hospital.Section.Address') }}</h2>
                  <p>Primary address shown on operational and billing records.</p>
                </div>
              </div>
              <div class="form-grid">
                <label class="wide"><span>{{ t('Administration.Hospital.Fields.AddressLine1') }}</span><input name="addressLine1" [(ngModel)]="form.address.addressLine1" /></label>
                <label class="wide"><span>{{ t('Administration.Hospital.Fields.AddressLine2') }}</span><input name="addressLine2" [(ngModel)]="form.address.addressLine2" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.CityName') }}</span><input name="cityName" [(ngModel)]="form.address.cityName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.StateName') }}</span><input name="stateName" [(ngModel)]="form.address.stateName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.CountryCode') }}</span><input name="countryCode" [(ngModel)]="form.address.countryCode" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.PostalCode') }}</span><input name="postalCode" [(ngModel)]="form.address.postalCode" /></label>
              </div>
            </section>

            <section class="panel" id="hospital-contact" tabindex="-1" aria-label="Hospital contact">
              <div class="section-title">
                <span class="material-symbols-rounded">call</span>
                <div>
                  <h2>{{ t('Administration.Hospital.Section.Contact') }}</h2>
                  <p>Contact channels used for support, alerts, and patient communication.</p>
                </div>
              </div>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.PrimaryPhone') }}</span><input name="primaryPhone" [(ngModel)]="form.contact.primaryPhone" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.SecondaryPhone') }}</span><input name="secondaryPhone" [(ngModel)]="form.contact.secondaryPhone" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.EmergencyPhone') }}</span><input name="emergencyPhone" [(ngModel)]="form.contact.emergencyPhone" /></label>
                <label class="wide"><span>{{ t('Administration.Hospital.Fields.Email') }}</span><input type="email" name="email" [(ngModel)]="form.contact.email" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.Fax') }}</span><input name="fax" [(ngModel)]="form.contact.fax" /></label>
              </div>
            </section>

            <section class="panel" id="hospital-license" tabindex="-1" aria-label="Hospital license">
              <div class="section-title">
                <span class="material-symbols-rounded">verified_user</span>
                <div>
                  <h2>{{ t('Administration.Hospital.Section.License') }}</h2>
                  <p>Regulatory details for hospital registration and compliance checks.</p>
                </div>
              </div>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.LicenseNumber') }}</span><input name="licenseNumber" [(ngModel)]="form.license.licenseNumber" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.LicenseType') }}</span><input name="licenseType" [(ngModel)]="form.license.licenseType" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.IssuingAuthority') }}</span><input name="issuingAuthority" [(ngModel)]="form.license.issuingAuthority" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.ValidFrom') }}</span><input type="date" name="validFrom" [(ngModel)]="form.license.validFrom" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.ValidTo') }}</span><input type="date" name="validTo" [(ngModel)]="form.license.validTo" /></label>
              </div>
            </section>

            <section class="panel" id="hospital-gst" tabindex="-1" aria-label="Hospital gst">
              <div class="section-title">
                <span class="material-symbols-rounded">receipt_long</span>
                <div>
                  <h2>{{ t('Administration.Hospital.Section.Gst') }}</h2>
                  <p>Tax identity used for billing, invoices, and account documents.</p>
                </div>
              </div>
              <div class="form-grid">
                <label><span>{{ t('Administration.Hospital.Fields.Gstin') }}</span><input name="gstin" [(ngModel)]="form.gst.gstin" maxlength="15" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.LegalBusinessName') }}</span><input name="legalBusinessName" [(ngModel)]="form.gst.legalBusinessName" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.RegistrationState') }}</span><input name="registrationState" [(ngModel)]="form.gst.registrationState" /></label>
                <label><span>{{ t('Administration.Hospital.Fields.RegistrationDate') }}</span><input type="date" name="registrationDate" [(ngModel)]="form.gst.registrationDate" /></label>
              </div>
            </section>
          </div>

          <aside class="profile-rail" aria-label="Hospital profile overview">
            <section class="profile-summary">
              <header class="summary-heading">
                <span class="summary-symbol material-symbols-rounded" aria-hidden="true">domain</span>
                <div><h2>Profile overview</h2><p>Hospital details at a glance</p></div>
              </header>
              <div class="summary-group">
                <h3>Hospital details</h3>
                <nav class="profile-sections" aria-label="Jump to hospital form section">
                  <button type="button" (click)="goToSection('profile')">
                    <span class="material-symbols-rounded" aria-hidden="true">badge</span>
                    <span class="section-copy"><strong>Identity</strong><small>{{ form.hospitalName && form.hospitalCode ? form.hospitalCode : 'Add hospital name and code' }}</small></span>
                    <span class="section-state" [class.is-added]="form.hospitalName && form.hospitalCode">{{ form.hospitalName && form.hospitalCode ? 'Added' : 'Missing' }}</span>
                    <span class="section-arrow material-symbols-rounded" aria-hidden="true">chevron_right</span>
                  </button>
                  <button type="button" (click)="goToSection('address')">
                    <span class="material-symbols-rounded" aria-hidden="true">location_on</span>
                    <span class="section-copy"><strong>Address</strong><small>{{ form.address.cityName || form.address.addressLine1 || 'Add hospital location' }}</small></span>
                    <span class="section-state" [class.is-added]="form.address.addressLine1 && form.address.cityName">{{ form.address.addressLine1 && form.address.cityName ? 'Added' : 'Missing' }}</span>
                    <span class="section-arrow material-symbols-rounded" aria-hidden="true">chevron_right</span>
                  </button>
                  <button type="button" (click)="goToSection('contact')">
                    <span class="material-symbols-rounded" aria-hidden="true">call</span>
                    <span class="section-copy"><strong>Contact</strong><small>{{ form.contact.primaryPhone || form.contact.email || 'Add phone or email' }}</small></span>
                    <span class="section-state" [class.is-added]="form.contact.primaryPhone || form.contact.email">{{ form.contact.primaryPhone || form.contact.email ? 'Added' : 'Missing' }}</span>
                    <span class="section-arrow material-symbols-rounded" aria-hidden="true">chevron_right</span>
                  </button>
                </nav>
              </div>
              <div class="summary-group">
                <h3>Registration & tax</h3>
                <nav class="registration-list" aria-label="Jump to registration details">
                  <button type="button" (click)="goToSection('license')"><span>Hospital licence</span><strong [class.not-recorded]="!form.license.licenseNumber" [attr.title]="form.license.licenseNumber">{{ form.license.licenseNumber || 'Not added' }}</strong><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
                  <button type="button" (click)="goToSection('gst')"><span>GSTIN</span><strong [class.not-recorded]="!form.gst.gstin" [attr.title]="form.gst.gstin">{{ form.gst.gstin || 'Not added' }}</strong><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
                </nav>
              </div>
              <div class="subscription-row"><span class="material-symbols-rounded" aria-hidden="true">workspace_premium</span><div><small>Subscription</small><strong>{{ form.subscription.planNameKey ? t(form.subscription.planNameKey) : form.subscription.planCode || 'Not configured' }}</strong></div><span class="subscription-state" [class.is-active]="form.subscription.statusCode === 'ACTIVE'">{{ form.subscription.statusCode || 'Not set' }}</span></div>
              <div class="summary-updated"><span>Last saved</span><span>{{ form.modifiedDate ? (form.modifiedDate | date: 'd MMM yyyy, h:mm a') : 'Not recorded' }}</span></div>
              @if (can(permissions.edit)) {
                <footer class="summary-save" aria-live="polite">
                  <div class="save-status" [class.has-changes]="hasUnsavedChanges()"><span class="material-symbols-rounded" aria-hidden="true">{{ saving() ? 'sync' : hasUnsavedChanges() ? 'edit_note' : 'check_circle' }}</span><strong>{{ saving() ? 'Saving profile…' : hasUnsavedChanges() ? 'Unsaved changes' : 'Profile saved' }}</strong></div>
                  <p>{{ hasUnsavedChanges() ? 'Save to update hospital details across Care360.' : 'Your hospital details are up to date.' }}</p>
                  <button class="ac-btn ac-btn-primary" type="button" (click)="saveProfile()" [disabled]="saving() || !hasUnsavedChanges()"><span class="material-symbols-rounded" aria-hidden="true">save</span>{{ saving() ? 'Saving…' : t('Administration.Hospital.Actions.SaveProfile') }}</button>
                </footer>
              }
            </section>
          </aside>


          @if (profileDrawer(); as drawer) {
            <ac-admin-drawer
              [open]="!!profileDrawer()"
              [busy]="saving()"
              [icon]="drawerIcon(drawer)"
              [eyebrow]="t('Administration.Hospital.Title')"
              [title]="t(drawerTitle(drawer))"
              (closed)="closeDrawer()">
                <span drawer-summary class="ac-admin-pill"><span class="material-symbols-rounded">local_hospital</span>{{ form.hospitalName }}</span>
                <span drawer-summary class="ac-admin-pill featured"><span class="material-symbols-rounded">{{ drawerIcon(drawer) }}</span>{{ t(drawerTitle(drawer)) }}</span>
                <div drawer-body class="ac-admin-drawer-content">
                  @if (drawer === 'branding') {
                    <section class="ac-admin-form-section">
                      <div class="ac-admin-section-title"><span class="material-symbols-rounded">imagesmode</span><h3>{{ t('Administration.Hospital.Section.Branding') }}</h3></div>
                      <div class="ac-admin-form-grid">
                        <label class="ac-admin-wide"><span>{{ t('Administration.Hospital.Fields.LogoUrl') }}</span><input name="logoUrl" [(ngModel)]="form.branding.logoUrl" /></label>
                        <label class="ac-admin-wide"><span>{{ t('Administration.Hospital.Fields.FaviconUrl') }}</span><input name="faviconUrl" [(ngModel)]="form.branding.faviconUrl" /></label>
                        <label><span>{{ t('Administration.Hospital.Fields.PrimaryColor') }}</span><input type="color" name="primaryColor" [(ngModel)]="form.branding.primaryColor" /></label>
                        <label><span>{{ t('Administration.Hospital.Fields.SecondaryColor') }}</span><input type="color" name="secondaryColor" [(ngModel)]="form.branding.secondaryColor" /></label>
                        <label><span>{{ t('Administration.Hospital.Fields.AccentColor') }}</span><input type="color" name="accentColor" [(ngModel)]="form.branding.accentColor" /></label>
                      </div>
                    </section>
                  }
                  @if (drawer === 'settings') {
                    <section class="ac-admin-form-section">
                      <div class="ac-admin-section-title"><span class="material-symbols-rounded">tune</span><h3>{{ t('Administration.Hospital.Section.Settings') }}</h3></div>
                      <div class="setting-list">
                        @for (setting of form.settings; track setting.settingKey; let index = $index) {
                          <div class="setting-row">
                            <input [name]="'settingKey_' + index" [(ngModel)]="setting.settingKey" [attr.aria-label]="t('Administration.Hospital.Fields.SettingKey')" />
                            <input [name]="'settingValue_' + index" [(ngModel)]="setting.settingValue" [attr.aria-label]="t('Administration.Hospital.Fields.SettingValue')" />
                          </div>
                        }
                      </div>
                      <button class="ac-btn ac-btn-secondary" type="button" (click)="addSetting()">{{ t('Administration.Hospital.Actions.AddSetting') }}</button>
                    </section>
                  }
                  @if (drawer === 'subscription') {
                    <section class="ac-admin-form-section">
                      <div class="ac-admin-section-title"><span class="material-symbols-rounded">workspace_premium</span><h3>{{ t('Administration.Hospital.Section.Subscription') }}</h3></div>
                      <dl class="subscription-summary">
                        <dt>{{ t('Administration.Hospital.Fields.PlanName') }}</dt><dd>{{ t(form.subscription.planNameKey) }}</dd>
                        <dt>{{ t('Administration.Hospital.Fields.SubscriptionStatus') }}</dt><dd>{{ t(subscriptionStatusKey(form.subscription.statusCode)) }}</dd>
                      </dl>
                      <div class="ac-admin-form-grid">
                        <label><span>{{ t('Administration.Hospital.Fields.PlanName') }}</span><input name="planCode" [(ngModel)]="form.subscription.planCode" /></label>
                        <label><span>{{ t('Administration.Hospital.Fields.SubscriptionStatus') }}</span><input name="statusCode" [(ngModel)]="form.subscription.statusCode" /></label>
                        <label><span>{{ t('Administration.Hospital.Fields.SubscriptionEndDate') }}</span><input type="date" name="subscriptionEndDate" [(ngModel)]="form.subscription.endDate" /></label>
                        <label><span>{{ t('Administration.Hospital.Fields.MaxUsers') }}</span><input type="number" min="0" name="maxUsers" [(ngModel)]="form.subscription.maxUsers" /></label>
                        <label><span>{{ t('Administration.Hospital.Fields.MaxBranches') }}</span><input type="number" min="0" name="maxBranches" [(ngModel)]="form.subscription.maxBranches" /></label>
                      </div>
                    </section>
                  }
                </div>
                <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeDrawer()">{{ t('Common.Actions.Cancel') }}</button>
                @if (drawer === 'branding') {
                  <button drawer-actions class="ac-btn ac-btn-primary" type="button" (click)="saveBranding()" [disabled]="saving()"><span class="material-symbols-rounded">save</span>{{ t('Administration.Hospital.Actions.SaveBranding') }}</button>
                }
                @if (drawer === 'settings') {
                  <button drawer-actions class="ac-btn ac-btn-primary" type="button" (click)="saveSettings()" [disabled]="saving()"><span class="material-symbols-rounded">save</span>{{ t('Administration.Hospital.Actions.SaveSettings') }}</button>
                }
                @if (drawer === 'subscription') {
                  <button drawer-actions class="ac-btn ac-btn-primary" type="button" (click)="saveSubscription()" [disabled]="saving()"><span class="material-symbols-rounded">save</span>{{ t('Administration.Hospital.Actions.SaveProfile') }}</button>
                }
            </ac-admin-drawer>
          }
        </section>
      }
    </section>
  `,
  styles: `
    .hospital-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .head-actions, .overview-panel, .overview-actions, .layout { display: flex; gap: 12px; }
    .page-head { align-items: flex-start; justify-content: space-between; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; }
    .head-actions { align-items: center; justify-content: flex-end; flex-wrap: wrap; }
    .head-actions .ac-btn { white-space: nowrap; }
    .overview-panel {
      align-items: center;
      padding: 16px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary-light) 74%, var(--ac-surface)), var(--ac-surface));
      box-shadow: 0 14px 34px rgba(15,23,42,.05);
    }
    .hospital-mark {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: color-mix(in srgb, var(--ac-primary) 12%, var(--ac-surface));
      color: var(--ac-primary);
      flex: 0 0 auto;
    }
    .hospital-mark .material-symbols-rounded { font-size: 32px; }
    .overview-copy { min-width: 0; flex: 1; }
    .overview-copy > span { color: var(--ac-primary); font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .overview-copy h2 { margin: 3px 0 2px; font-size: 22px; line-height: 1.15; }
    .overview-copy p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .overview-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .overview-chips span {
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 9px;
      border: 1px solid var(--ac-border);
      border-radius: 999px;
      background: rgba(255,255,255,.62);
      color: var(--ac-text-2);
      font-size: 12px;
      font-weight: 800;
    }
    .overview-chips i { width: 8px; height: 8px; border-radius: 999px; background: #16a34a; box-shadow: 0 0 0 4px rgba(22,163,74,.12); }
    .overview-actions { flex-wrap: wrap; justify-content: flex-end; align-items: center; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
    .main-form { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 12px; }
    .profile-rail { min-width: 0; width: 100%; position: static; }
    .main-form > .panel { scroll-margin-top: 20px; }
    .profile-summary { border: 1px solid var(--ac-border); border-radius: 14px; background: var(--ac-surface); overflow: hidden; }
    .summary-heading { display: flex; align-items: center; gap: 10px; padding: 20px; border-bottom: 1px solid var(--ac-border); background: linear-gradient(120deg,var(--ac-secondary-light),var(--ac-surface)); }
    .summary-symbol { display: grid; place-items: center; flex: 0 0 36px; width: 36px; height: 36px; border-radius: 10px; background: var(--ac-surface); color: var(--ac-secondary); font-size: 21px; }
    .summary-heading h2 { font-size: 15px; font-weight: 650; margin: 0; }
    .summary-heading p { font-size: 11px; color: var(--ac-muted); margin: 4px 0 0; line-height: 1.5; }
    .summary-group { padding: 18px 20px 0; }
    .summary-group h3 { margin: 0 0 8px; color: var(--ac-muted); font-size: 10px; letter-spacing: .8px; text-transform: uppercase; font-weight: 600; }
    .profile-sections { display: grid; }
    .profile-sections button { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 66px; padding: 10px 0; border: 0; border-bottom: 1px solid var(--ac-border); background: transparent; color: var(--ac-text); text-align: left; }
    .profile-sections button > .material-symbols-rounded:first-child { flex: 0 0 19px; font-size: 19px; color: var(--ac-primary); }
    .section-copy { flex: 1; min-width: 0; }
    .section-copy strong { display: block; font-size: 12px; font-weight: 600; }
    .section-copy small { display: block; margin-top: 4px; font-size: 11px; color: var(--ac-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .section-state { font-size: 10px; color: var(--ac-warning-text); background: var(--ac-warning-light); padding: 4px 6px; border-radius: 5px; flex: 0 0 auto; }
    .section-state.is-added { color: var(--ac-success-text); background: var(--ac-success-light); }
    .section-arrow { color: var(--ac-muted-2); font-size: 16px; flex: 0 0 16px; }
    .profile-sections button:hover .section-copy strong,.registration-list button:hover > span:first-child { color: var(--ac-primary); }
    .profile-summary button:focus-visible { outline: 2px solid var(--ac-primary); outline-offset: -2px; border-radius: 5px; }
    .registration-list { display: grid; }
    .registration-list button { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; background: transparent; border: 0; text-align: left; font-size: 11px; color: var(--ac-text-3); }
    .registration-list button > span:first-child { flex: 0 0 auto; }
    .registration-list strong { flex: 1; min-width: 0; text-align: right; font-size: 11px; font-weight: 500; color: var(--ac-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .registration-list strong.not-recorded { color: var(--ac-muted-2); }
    .registration-list .material-symbols-rounded { color: var(--ac-muted-2); flex: 0 0 16px; font-size: 16px; }
    .subscription-row { display: flex; align-items: center; gap: 10px; margin: 16px 20px 0; padding: 14px 0; border-block: 1px solid var(--ac-border); }
    .subscription-row > .material-symbols-rounded { flex: 0 0 21px; font-size: 21px; color: var(--ac-secondary); }
    .subscription-row > div { flex: 1; min-width: 0; }
    .subscription-row small { display: block; font-size: 10px; color: var(--ac-muted); }
    .subscription-row strong { display: block; font-size: 12px; font-weight: 600; margin-top: 4px; overflow-wrap: anywhere; }
    .subscription-state { border: 1px solid var(--ac-border); color: var(--ac-muted); border-radius: 5px; padding: 4px 6px; font-size: 9px; text-transform: capitalize; }
    .subscription-state.is-active { color: var(--ac-success-text); background: var(--ac-success-light); border-color: transparent; }
    .summary-updated { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 16px 20px; color: var(--ac-muted); font-size: 10px; line-height: 1.5; }
    .summary-updated > span:last-child { text-align: right; }
    .summary-save { padding: 18px 20px 20px; border-top: 1px solid var(--ac-border); background: var(--ac-surface-2); }
    .save-status { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ac-text-2); }
    .save-status .material-symbols-rounded { font-size: 17px; color: var(--ac-success-text); }
    .save-status.has-changes .material-symbols-rounded { color: var(--ac-primary); }
    .save-status strong { font-weight: 600; }
    .summary-save p { font-size: 11px; line-height: 1.6; color: var(--ac-muted); margin: 7px 0 14px; }
    .summary-save .ac-btn { width: 100%; justify-content: center; min-height: 44px; }
    .panel {
      min-width: 0;
      border: 1px solid var(--ac-border);
      background: var(--ac-surface);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 10px 24px rgba(15,23,42,.035);
    }
    .error-state { display: flex; align-items: center; gap: 14px; }
    .error-state > .material-symbols-rounded { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 8px; color: #b45309; background: rgba(217,119,6,.12); }
    .error-state h2 { margin: 0 0 4px; font-size: 16px; }
    .error-state p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .error-state .ac-btn { margin-left: auto; }
    .section-title, .rail-head { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 10px; margin-bottom: 14px; }
    .section-title > .material-symbols-rounded, .rail-head > .material-symbols-rounded {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: color-mix(in srgb, var(--ac-primary) 10%, var(--ac-surface-2));
      color: var(--ac-primary);
      font-size: 21px;
    }
    .panel h2 { margin: 0; font-size: 16px; }
    .section-title p, .rail-head p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; }
    .form-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    .form-grid label { grid-column: span 2; }
    .wide { grid-column: span 4; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    input {
      width: 100%;
      height: 40px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      padding: 0 11px;
      background: var(--ac-surface);
      color: var(--ac-text);
      font: inherit;
      font-weight: 700;
      transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
    }
    input:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--ac-primary) 68%, var(--ac-border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 13%, transparent);
    }
    input[type="color"] { padding: 4px; }
    .color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); cursor: pointer; display: inline-grid; place-items: center; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin: 0; font-size: 13px; }
    dt { color: var(--ac-muted); font-weight: 700; }
    dd { margin: 0; color: var(--ac-text); text-align: right; }
    .subscription-summary { border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px; background: var(--ac-surface-2); }
    .setting-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .setting-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    @media (min-width: 1181px) and (min-height: 900px) { .profile-rail { position: sticky; top: 16px; } }
    @media (max-width: 1180px) {
      .layout { grid-template-columns: minmax(0,1fr); }
      .overview-panel { flex-direction: column; align-items: stretch; }
      .overview-actions { justify-content: flex-start; }
      .profile-rail { width: 100%; position: static; }
    }
    @media (max-width: 900px) {
      .profile-rail, .form-grid { grid-template-columns: 1fr; }
      .form-grid label, .wide { grid-column: auto; }
    }
    @media (max-width: 760px) {
      .page-head { flex-direction: column; }
      .head-actions, .head-actions .ac-btn { width: 100%; }
      .head-actions .ac-btn { justify-content: center; }
      .overview-panel { padding: 14px; }
      .overview-actions .ac-btn { width: 100%; justify-content: center; }
      .color-grid { grid-template-columns: 1fr; }
      .error-state { align-items: flex-start; flex-direction: column; }
      .error-state .ac-btn { margin-left: 0; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HospitalManagementPageComponent implements OnInit {
  protected readonly permissions = permissions;
  private readonly service = inject(HospitalManagementService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly branchContext = inject(BranchContextService);

  protected readonly profile = signal<HospitalProfile | null>(null);
  private readonly savedProfile = signal<HospitalProfile | null>(null);
  protected hasUnsavedChanges(): boolean { return hasHospitalDraft(this.profile(), this.savedProfile()); }

  protected goToSection(section: 'profile' | 'address' | 'contact' | 'license' | 'gst'): void {
    const target = document.getElementById(`hospital-${section}`);
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    target?.focus({ preventScroll: true });
  }
  protected readonly profileDrawer = signal<HospitalProfileDrawer | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);

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

  protected openDrawer(drawer: HospitalProfileDrawer): void {
    this.profileDrawer.set(drawer);
  }

  protected closeDrawer(): void {
    this.profileDrawer.set(null);
  }

  protected drawerTitle(drawer: HospitalProfileDrawer): string {
    return {
      branding: 'Administration.Hospital.Section.Branding',
      settings: 'Administration.Hospital.Section.Settings',
      subscription: 'Administration.Hospital.Section.Subscription'
    }[drawer];
  }

  protected drawerIcon(drawer: HospitalProfileDrawer): string {
    return {
      branding: 'palette',
      settings: 'tune',
      subscription: 'workspace_premium'
    }[drawer];
  }

  private profileRequestRevision = 0;

  protected async loadProfile(): Promise<void> {
    if (this.saving()) return;
    const revision = ++this.profileRequestRevision;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const response = await this.service.getProfile();
      if (revision !== this.profileRequestRevision) return;
      if (response.success && response.data) {
        this.savedProfile.set(structuredClone(response.data));
        this.profile.set(response.data);
        this.branchContext.setHospitalName(response.data.hospitalName);
        return;
      }

      this.profile.set(null);
      const message = this.t(response.message);
      this.loadError.set(message);
      this.toast.error(message);
    } catch {
      if (revision !== this.profileRequestRevision) return;
      this.profile.set(null);
      const message = 'The hospital profile did not load. Please check the API service and try again.';
      this.loadError.set(message);
      this.toast.error(message);
    } finally {
      if (revision === this.profileRequestRevision) this.loading.set(false);
    }
  }

  protected async saveProfile(): Promise<void> {
    const draft = this.profile();
    const current = draft ? structuredClone(draft) : null;
    if (!current) {
      return;
    }

    await this.save(current, 'profile', () => this.service.updateProfile(current), 'Administration.Hospital.Messages.Updated');
  }

  protected async saveBranding(): Promise<void> {
    const draft = this.profile();
    const current = draft ? structuredClone(draft) : null;
    if (!current) {
      return;
    }

    if (await this.save(current, 'branding', () => this.service.updateBranding(current.branding), 'Administration.Hospital.Messages.BrandingUpdated')) {
      this.closeDrawer();
    }
  }

  protected async saveSettings(): Promise<void> {
    const draft = this.profile();
    const current = draft ? structuredClone(draft) : null;
    if (!current) {
      return;
    }

    if (await this.save(current, 'settings', () => this.service.updateSettings(current.settings), 'Administration.Hospital.Messages.SettingsUpdated')) {
      this.closeDrawer();
    }
  }

  protected async saveSubscription(): Promise<void> {
    const draft = this.profile();
    const current = draft ? structuredClone(draft) : null;
    if (!current) {
      return;
    }

    if (await this.save(current, 'profile', () => this.service.updateProfile(current), 'Administration.Hospital.Messages.Updated')) {
      this.closeDrawer();
    }
  }

  protected addSetting(): void {
    const current = this.profile();
    if (!current) {
      return;
    }

    this.profile.set({ ...current, settings: [...current.settings, createSetting()] });
  }

  private async save(submitted: HospitalProfile, section: HospitalSaveSection, operation: () => Promise<{ success: boolean; message: string; data: HospitalProfile | null }>, successKey: string): Promise<boolean> {
    if (this.saving()) {
      return false;
    }

    ++this.profileRequestRevision;
    this.loading.set(false);
    this.saving.set(true);
    try {
      const response = await operation();
      if (!response.success || !response.data) {
        this.toast.error(this.t(response.message));
        return false;
      }

      this.savedProfile.set(structuredClone(response.data));
      this.profile.set(mergeHospitalSave(this.profile() ?? submitted, submitted, response.data, section));
      this.branchContext.setHospitalName(response.data.hospitalName);
      this.toast.success(this.t(successKey));
      return true;
    } catch {
      this.toast.error(this.t('Administration.Hospital.Messages.SaveFailed'));
      return false;
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
