import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { BranchContextService } from '../../../core/context/branch-context.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AcAdminDrawerComponent } from '../../../shared/ui/admin-drawer/admin-drawer.component';
import { AcGridLoaderComponent } from '../../../shared/ui/grid-loader/grid-loader.component';
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
  imports: [CommonModule, FormsModule, AcAdminDrawerComponent, AcGridLoaderComponent],
  template: `
    <section class="hospital-page">
      <header class="page-head">
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
          <button class="icon-btn" type="button" (click)="loadProfile()" [attr.title]="t('Administration.Rbac.Actions.Refresh')">
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
            <section class="panel">
              <div class="section-title">
                <span class="material-symbols-rounded">badge</span>
                <div>
                  <h2>{{ t('Administration.Hospital.Section.Profile') }}</h2>
                  <p>Core identity and localization used across Care360.</p>
                </div>
              </div>
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

            <section class="panel">
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

            <section class="panel">
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

            <section class="panel">
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

          <aside class="profile-rail">
            @if (can(permissions.edit)) {
              <section class="panel save-card">
                <div>
                  <strong>Ready to update?</strong>
                  <p>Changes are saved to the hospital profile and reflected in the header.</p>
                </div>
                <button class="ac-btn ac-btn-primary" type="button" (click)="saveProfile()" [disabled]="saving()">
                  <span class="material-symbols-rounded">save</span>
                  {{ t('Administration.Hospital.Actions.SaveProfile') }}
                </button>
              </section>
            }

            <section class="panel rail-card">
              <div class="rail-head">
                <span class="material-symbols-rounded">task_alt</span>
                <div>
                  <h2>Profile readiness</h2>
                  <p>Quick check before saving changes.</p>
                </div>
              </div>
              <div class="readiness-list">
                <div>
                  <span class="material-symbols-rounded">domain</span>
                  <p><strong>Identity</strong>{{ form.hospitalName && form.hospitalCode ? 'Complete' : 'Needs hospital name and code' }}</p>
                </div>
                <div>
                  <span class="material-symbols-rounded">location_on</span>
                  <p><strong>Location</strong>{{ form.address.addressLine1 || form.address.cityName || form.address.stateName ? 'Address details added' : 'Address pending' }}</p>
                </div>
                <div>
                  <span class="material-symbols-rounded">alternate_email</span>
                  <p><strong>Contact</strong>{{ form.contact.email || form.contact.primaryPhone || 'Contact pending' }}</p>
                </div>
                <div>
                  <span class="material-symbols-rounded">workspace_premium</span>
                  <p><strong>Subscription</strong>{{ form.subscription.planCode }} · {{ form.subscription.statusCode }}</p>
                </div>
              </div>
            </section>

            <section class="panel rail-card">
              <div class="rail-head">
                <span class="material-symbols-rounded">fact_check</span>
                <div>
                  <h2>Compliance status</h2>
                  <p>Registration and tax details at a glance.</p>
                </div>
              </div>
              <div class="status-list">
                <div>
                  <span>License</span>
                  <strong>{{ form.license.licenseNumber ? 'Available' : 'Pending' }}</strong>
                </div>
                <div>
                  <span>GST</span>
                  <strong>{{ form.gst.gstin ? 'Registered' : 'Pending' }}</strong>
                </div>
                <div>
                  <span>Last updated</span>
                  <strong>{{ form.modifiedDate ? (form.modifiedDate | date: 'mediumDate') : 'Not yet saved' }}</strong>
                </div>
              </div>
            </section>
          </aside>

          @if (profileDrawer(); as drawer) {
            <ac-admin-drawer
              [open]="!!profileDrawer()"
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
      background: linear-gradient(135deg, color-mix(in srgb, #eff6ff 74%, var(--ac-surface)), var(--ac-surface));
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
    .layout { align-items: flex-start; }
    .main-form { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 12px; }
    .profile-rail { width: min(360px, 32vw); flex: 0 0 min(360px, 32vw); display: grid; gap: 12px; position: sticky; top: 84px; }
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
    .readiness-list, .status-list { display: grid; gap: 9px; }
    .readiness-list div {
      min-height: 52px;
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      align-items: center;
      gap: 9px;
      padding: 9px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface-2);
    }
    .readiness-list .material-symbols-rounded { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; color: #2563eb; background: rgba(37,99,235,.1); font-size: 19px; }
    .readiness-list p { margin: 0; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
    .readiness-list strong { display: block; margin-bottom: 2px; color: var(--ac-text); font-size: 13px; }
    .status-list div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--ac-border);
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 800;
    }
    .status-list div:last-child { border-bottom: 0; }
    .status-list strong { color: var(--ac-text); text-align: right; }
    .save-card { display: grid; gap: 12px; background: linear-gradient(135deg, rgba(37,99,235,.07), rgba(20,184,166,.05)); }
    .save-card strong { display: block; color: var(--ac-text); }
    .save-card p { margin: 4px 0 0; color: var(--ac-muted); font-size: 12px; line-height: 1.4; }
    .save-card .ac-btn { width: 100%; justify-content: center; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin: 0; font-size: 13px; }
    dt { color: var(--ac-muted); font-weight: 700; }
    dd { margin: 0; color: var(--ac-text); text-align: right; }
    .subscription-summary { border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px; background: var(--ac-surface-2); }
    .setting-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .setting-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    @media (max-width: 1180px) {
      .layout, .overview-panel { flex-direction: column; align-items: stretch; }
      .overview-actions { justify-content: flex-start; }
      .profile-rail { width: 100%; flex-basis: auto; position: static; grid-template-columns: repeat(3, minmax(0, 1fr)); }
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

  protected async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const response = await this.service.getProfile();
      if (response.success && response.data) {
        this.profile.set(response.data);
        this.branchContext.setHospitalName(response.data.hospitalName);
        return;
      }

      this.profile.set(null);
      const message = this.t(response.message);
      this.loadError.set(message);
      this.toast.error(message);
    } catch {
      this.profile.set(null);
      const message = 'The hospital profile did not load. Please check the API service and try again.';
      this.loadError.set(message);
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
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

    if (await this.save(() => this.service.updateBranding(current.branding), 'Administration.Hospital.Messages.BrandingUpdated')) {
      this.closeDrawer();
    }
  }

  protected async saveSettings(): Promise<void> {
    const current = this.profile();
    if (!current) {
      return;
    }

    if (await this.save(() => this.service.updateSettings(current.settings), 'Administration.Hospital.Messages.SettingsUpdated')) {
      this.closeDrawer();
    }
  }

  protected async saveSubscription(): Promise<void> {
    const current = this.profile();
    if (!current) {
      return;
    }

    if (await this.save(() => this.service.updateProfile(current), 'Administration.Hospital.Messages.Updated')) {
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

  private async save(operation: () => Promise<{ success: boolean; message: string; data: HospitalProfile | null }>, successKey: string): Promise<boolean> {
    if (this.saving()) {
      return false;
    }

    this.saving.set(true);
    try {
      const response = await operation();
      if (!response.success || !response.data) {
        this.toast.error(this.t(response.message));
        return false;
      }

      this.profile.set(response.data);
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
