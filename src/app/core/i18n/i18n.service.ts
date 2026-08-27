import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ApiResponse } from '../auth/auth.models';
import { ApiClientService } from '../http/api-client.service';
import { SKIP_GLOBAL_LOADER } from '../interceptors/loader.interceptor';
import { LocaleContextService } from './locale-context.service';
import { LocalizationCatalog, LocalizationVersion, SeedDataItem } from './i18n.models';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly api = inject(ApiClientService);
  private readonly authStore = inject(AuthStore);
  private readonly locale = inject(LocaleContextService);
  private readonly catalogSignal = signal<LocalizationCatalog | null>(null);

  readonly catalog = this.catalogSignal.asReadonly();
  readonly languages = computed(() => this.catalog()?.languages ?? []);
  readonly resources = computed(() => this.catalog()?.resources ?? {});

  async loadCatalog(cultureCode = this.locale.cultureCode()): Promise<void> {
    this.locale.setCulture(cultureCode);
    if (!this.authStore.isAuthenticated()) {
      this.catalogSignal.set(createFallbackCatalog(cultureCode));
      return;
    }

    const cached = this.getCachedCatalog(cultureCode);
    if (cached) {
      this.catalogSignal.set(cached);
    }

    try {
      const version = await this.loadVersion();
      const catalog = cached?.version === version ? cached : await this.loadRemoteCatalog(cultureCode);

      this.setCachedCatalog(catalog);
      this.catalogSignal.set(catalog);
    } catch {
      if (!this.catalogSignal()) {
        this.catalogSignal.set(createFallbackCatalog(cultureCode));
      }
    }
  }

  translate(resourceKey: string): string {
    const localizedValue = this.resources()[resourceKey];
    if (localizedValue && localizedValue !== resourceKey && !looksLikeLocalizationKey(localizedValue)) {
      return localizedValue;
    }

    return FALLBACK_RESOURCES[resourceKey] ?? humanizeResourceKey(resourceKey);
  }

  seedItems(module: string, name: string): SeedDataItem[] {
    return (
      this.catalog()
        ?.seedDataSets.find((dataSet) => dataSet.module === module && dataSet.name === name)
        ?.items ?? []
    );
  }

  seedLabel(item: SeedDataItem): string {
    const culture = this.catalog()?.effectiveCulture ?? 'en-US';
    return item.translations[culture] ?? item.translations['en-US'] ?? item.code;
  }

  private async loadVersion(): Promise<number> {
    const response = await firstValueFrom(
      this.api.get<ApiResponse<LocalizationVersion> | LocalizationVersion>(
        '/localization/version',
        { context: backgroundHttpContext() })
    );
    return unwrapApiResponse(response)?.version ?? 0;
  }

  private async loadRemoteCatalog(cultureCode: string): Promise<LocalizationCatalog> {
    const response = await firstValueFrom(
      this.api.get<ApiResponse<LocalizationCatalog> | LocalizationCatalog>(
        `/localization/catalog?culture=${encodeURIComponent(cultureCode)}`,
        { context: backgroundHttpContext() })
    );
    const catalog = unwrapApiResponse(response);

    if (!catalog) {
      throw new Error(getApiResponseMessage(response) ?? 'Localization catalog unavailable.');
    }

    return catalog;
  }

  private getCachedCatalog(cultureCode: string): LocalizationCatalog | null {
    const cached = window.localStorage.getItem(this.getCacheKey(cultureCode));
    if (!cached) {
      return null;
    }

    try {
      const catalog = JSON.parse(cached) as LocalizationCatalog;
      if (!isUsableCatalog(catalog)) {
        window.localStorage.removeItem(this.getCacheKey(cultureCode));
        return null;
      }

      return catalog;
    } catch {
      window.localStorage.removeItem(this.getCacheKey(cultureCode));
      return null;
    }
  }

  private setCachedCatalog(catalog: LocalizationCatalog): void {
    window.localStorage.setItem(this.getCacheKey(catalog.effectiveCulture), JSON.stringify(catalog));
  }

  private getCacheKey(cultureCode: string): string {
    return `care360.localization.${cultureCode}`;
  }
}

function backgroundHttpContext(): HttpContext {
  return new HttpContext().set(SKIP_GLOBAL_LOADER, true);
}

function unwrapApiResponse<T>(response: ApiResponse<T> | T): T | null {
  if (isApiResponse(response)) {
    return response.success ? response.data : null;
  }

  return response;
}

function getApiResponseMessage<T>(response: ApiResponse<T> | T): string | null {
  return isApiResponse(response) ? response.message : null;
}

function isApiResponse<T>(response: ApiResponse<T> | T): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    'data' in response
  );
}

function isUsableCatalog(catalog: LocalizationCatalog): boolean {
  return !!catalog.effectiveCulture && Object.keys(catalog.resources ?? {}).length > 0;
}

function looksLikeLocalizationKey(value: string): boolean {
  return /^[A-Z][A-Za-z0-9]*(\.[A-Z][A-Za-z0-9]*)+$/.test(value);
}

function humanizeResourceKey(resourceKey: string): string {
  if (!resourceKey.includes('.')) {
    return resourceKey;
  }

  const parts = resourceKey.split('.').filter(Boolean);
  const last = parts.at(-1) ?? resourceKey;
  const previous = parts.at(-2) ?? '';
  const second = parts.at(1) ?? '';

  if (last === 'Title' && second) {
    return splitPascalCase(second);
  }

  if (last === 'Subtitle' && second) {
    return splitPascalCase(second);
  }

  if (['Fields', 'Columns', 'Actions', 'Filter', 'Form', 'Section', 'Status'].includes(previous)) {
    return splitPascalCase(last);
  }

  return splitPascalCase(last);
}

function splitPascalCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

function createFallbackCatalog(cultureCode: string): LocalizationCatalog {
  return {
    requestedCulture: cultureCode,
    effectiveCulture: cultureCode,
    languages: [],
    resources: FALLBACK_RESOURCES,
    seedDataSets: [],
    version: 0
  };
}

const FALLBACK_RESOURCES: Record<string, string> = {
  'Auth.Login.Tenant.Label': 'Hospital',
  'Auth.Login.Tenant.Placeholder': 'Select hospital',
  'Auth.Login.Email.Label': 'Email',
  'Auth.Login.Email.Placeholder': 'Enter your email',
  'Auth.Login.Password.Label': 'Password',
  'Auth.Login.Password.Placeholder': 'Enter your password',
  'Auth.Login.RememberMe.Label': 'Remember me',
  'Auth.Login.ShowPassword': 'Show password',
  'Auth.Login.HidePassword': 'Hide password',
  'Auth.Login.Submit': 'Sign in',
  'Auth.Login.SigningIn': 'Signing in',
  'Auth.ForgotPassword.Link': 'Forgot password?',
  'Auth.ForgotPassword.Title': 'Forgot password',
  'Auth.ForgotPassword.Description': 'Enter your email and we will send reset instructions.',
  'Auth.ForgotPassword.Submit': 'Send reset link',
  'Auth.Messages.ForgotPasswordAccepted': 'If the email exists, password reset instructions have been sent.',
  'Auth.Messages.LoginSuccessful': 'Login successful.',
  'Auth.Errors.InvalidCredentials': 'Invalid email or password.',
  'Auth.Errors.EmailNotFound': 'Email not found.',
  'Auth.Errors.InvalidPassword': 'Invalid password.',
  'Auth.Errors.AccountLocked': 'Account locked. Please try again later.',
  'Auth.Errors.InactiveAccount': 'This account is inactive.',
  'Auth.Errors.EmailNotVerified': 'Email is not verified.',
  'Auth.Errors.MembershipNotFound': 'No active hospital membership was found for this email.',
  'Auth.Errors.TenantSelectionRequired': 'Choose the hospital for this email.',
  'Common.Errors.TenantRequired': 'Choose a hospital for this email.',
  'Common.Errors.TenantNotFound': 'Hospital tenant was not found.',
  'Common.Errors.TenantInactive': 'Hospital tenant is inactive.',
  'Common.Errors.LicenseExpired': 'Hospital license is expired.',
  'Common.Errors.RequestTimeout': 'The server is taking longer than usual to start. Please try again in a moment.',
  'Common.Errors.NetworkUnavailable': 'Unable to reach the server. Please check your connection and try again.',
  'Common.Errors.UnhandledException': 'Something went wrong. Please try again.',
  'Common.Actions.Sending': 'Sending',
  'Common.Actions.Cancel': 'Cancel',
  'Administration.Rbac.Actions.Refresh': 'Refresh',
  'Navigation.HospitalManagement': 'Hospital Management',
  'Administration.Hospital.Title': 'Hospital Management',
  'Administration.Hospital.Subtitle': 'Manage hospital profile, address, contacts, license, GST, branding, subscription, and settings.',
  'Administration.Hospital.Section.Profile': 'Profile',
  'Administration.Hospital.Section.Address': 'Address',
  'Administration.Hospital.Section.Contact': 'Contact',
  'Administration.Hospital.Section.License': 'License',
  'Administration.Hospital.Section.Gst': 'GST',
  'Administration.Hospital.Section.Branding': 'Branding',
  'Administration.Hospital.Section.Subscription': 'Subscription',
  'Administration.Hospital.Section.Settings': 'Settings',
  'Administration.Hospital.Fields.HospitalCode': 'Hospital code',
  'Administration.Hospital.Fields.HospitalName': 'Hospital name',
  'Administration.Hospital.Fields.LegalName': 'Legal name',
  'Administration.Hospital.Fields.ShortName': 'Short name',
  'Administration.Hospital.Fields.WebsiteUrl': 'Website',
  'Administration.Hospital.Fields.EstablishedDate': 'Established date',
  'Administration.Hospital.Fields.PrimaryLanguageCode': 'Primary language',
  'Administration.Hospital.Fields.TimeZoneCode': 'Time zone',
  'Administration.Hospital.Fields.CurrencyCode': 'Currency',
  'Administration.Hospital.Fields.AddressLine1': 'Address line 1',
  'Administration.Hospital.Fields.AddressLine2': 'Address line 2',
  'Administration.Hospital.Fields.CityName': 'City',
  'Administration.Hospital.Fields.StateName': 'State',
  'Administration.Hospital.Fields.CountryCode': 'Country',
  'Administration.Hospital.Fields.PostalCode': 'Postal code',
  'Administration.Hospital.Fields.PrimaryPhone': 'Primary phone',
  'Administration.Hospital.Fields.SecondaryPhone': 'Secondary phone',
  'Administration.Hospital.Fields.EmergencyPhone': 'Emergency phone',
  'Administration.Hospital.Fields.Email': 'Email',
  'Administration.Hospital.Fields.Fax': 'Fax',
  'Administration.Hospital.Fields.LicenseNumber': 'License number',
  'Administration.Hospital.Fields.LicenseType': 'License type',
  'Administration.Hospital.Fields.IssuingAuthority': 'Issuing authority',
  'Administration.Hospital.Fields.ValidFrom': 'Valid from',
  'Administration.Hospital.Fields.ValidTo': 'Valid to',
  'Administration.Hospital.Fields.Gstin': 'GSTIN',
  'Administration.Hospital.Fields.LegalBusinessName': 'Legal business name',
  'Administration.Hospital.Fields.RegistrationState': 'Registration state',
  'Administration.Hospital.Fields.RegistrationDate': 'Registration date',
  'Administration.Hospital.Fields.LogoUrl': 'Logo URL',
  'Administration.Hospital.Fields.FaviconUrl': 'Favicon URL',
  'Administration.Hospital.Fields.PrimaryColor': 'Primary color',
  'Administration.Hospital.Fields.SecondaryColor': 'Secondary color',
  'Administration.Hospital.Fields.AccentColor': 'Accent color',
  'Administration.Hospital.Fields.PlanCode': 'Plan code',
  'Administration.Hospital.Fields.PlanName': 'Plan',
  'Administration.Hospital.Fields.SubscriptionStatus': 'Subscription status',
  'Administration.Hospital.Fields.SubscriptionEndDate': 'Subscription end date',
  'Administration.Hospital.Fields.MaxUsers': 'Max users',
  'Administration.Hospital.Fields.MaxBranches': 'Max branches',
  'Administration.Hospital.Fields.SettingKey': 'Setting key',
  'Administration.Hospital.Fields.SettingValue': 'Setting value',
  'Administration.Hospital.Actions.SaveProfile': 'Save profile',
  'Administration.Hospital.Actions.SaveBranding': 'Save branding',
  'Administration.Hospital.Actions.SaveSettings': 'Save settings',
  'Administration.Hospital.Actions.AddSetting': 'Add setting',
  'Administration.Hospital.Messages.Loaded': 'Hospital profile loaded.',
  'Administration.Hospital.Messages.Updated': 'Hospital profile updated.',
  'Administration.Hospital.Messages.BrandingUpdated': 'Hospital branding updated.',
  'Administration.Hospital.Messages.SettingsUpdated': 'Hospital settings updated.',
  'Administration.Hospital.Messages.SaveFailed': 'Hospital management changes were not saved. Please check the API response and try again.',
  'Administration.Hospital.Errors.ProfileNotFound': 'Hospital profile was not found.',
  'Administration.Hospital.Errors.ConcurrencyConflict': 'Hospital profile was changed by another request. Reload and try again.',
  'Administration.Hospital.Validation.HospitalCodeRequired': 'Hospital code is required.',
  'Administration.Hospital.Validation.HospitalNameRequired': 'Hospital name is required.',
  'Administration.Hospital.Validation.AddressRequired': 'Address is required.',
  'Administration.Hospital.Validation.ContactRequired': 'Contact information is required.',
  'Administration.Hospital.Validation.EmailRequired': 'Email is required.',
  'Administration.Hospital.Validation.GstinInvalid': 'GSTIN must be 15 characters.',
  'Administration.Hospital.Validation.LicenseDatesInvalid': 'License expiry date cannot be before valid from date.',
  'Security.PermissionGroup.HospitalManagement.Name': 'Hospital Management',
  'Permission.Administration.Hospital.View': 'View hospital profile',
  'Permission.Administration.Hospital.Edit': 'Edit hospital profile',
  'Permission.Administration.Hospital.Branding': 'Configure hospital branding',
  'Permission.Administration.Hospital.Settings': 'Configure hospital settings',
  'Permission.Administration.Hospital.Subscription': 'View hospital subscription',
  'Hospital.Subscription.Plan.Standard': 'Standard',
  'Administration.Dashboard.Title': 'Administration Dashboard',
  'Administration.Dashboard.Subtitle': 'Operational overview for users, sessions, hospital setup, audit, notifications, license, subscription, storage, and health.',
  'Administration.Dashboard.Messages.Loaded': 'Dashboard loaded.',
  'Administration.Dashboard.Widgets.TotalHospitals': 'Total hospitals',
  'Administration.Dashboard.Widgets.TotalUsers': 'Total users',
  'Administration.Dashboard.Widgets.ActiveUsers': 'Active users',
  'Administration.Dashboard.Widgets.ActiveSessions': 'Active sessions',
  'Administration.Dashboard.Widgets.BranchCount': 'Branches',
  'Administration.Dashboard.Widgets.DepartmentCount': 'Departments',
  'Administration.Dashboard.Widgets.AuditSummary': 'Audit summary',
  'Administration.Dashboard.Widgets.RecentLogins': 'Recent logins',
  'Administration.Dashboard.Widgets.Notifications': 'Notifications',
  'Administration.Dashboard.Widgets.LicenseStatus': 'License status',
  'Administration.Dashboard.Widgets.SubscriptionStatus': 'Subscription status',
  'Administration.Dashboard.Widgets.StorageUsage': 'Storage usage',
  'Administration.Dashboard.Widgets.SystemHealth': 'System health',
  'Administration.Dashboard.Labels.Today': 'Today',
  'Administration.Dashboard.Labels.LastSevenDays': 'Last 7 days',
  'Administration.Dashboard.Labels.GeneratedAt': 'Generated at',
  'Administration.Dashboard.Labels.Events': 'Events',
  'Administration.Dashboard.Labels.Success': 'Success',
  'Administration.Dashboard.Labels.Failed': 'Failed',
  'Administration.Dashboard.Labels.NoData': 'No dashboard data available.',
  'Administration.Dashboard.Labels.TemplatesConfigured': 'Templates configured',
  'Administration.Dashboard.Labels.ProfileImages': 'Profile images tracked',
  'Administration.Dashboard.License.ACTIVE': 'Active',
  'Administration.Dashboard.License.VALID': 'Valid',
  'Administration.Dashboard.License.EXPIRED': 'Expired',
  'Administration.Dashboard.License.MISSING': 'Missing',
  'Administration.Dashboard.Health.HEALTHY': 'Healthy',
  'Administration.Dashboard.Health.WARNING': 'Warning',
  'Administration.Dashboard.Health.UNHEALTHY': 'Unhealthy',
  'Administration.Dashboard.SystemHealth.HospitalDatabase': 'Hospital database is reachable.',
  'Administration.Dashboard.SystemHealth.TenantDatabase': 'Hospital database is reachable.',
  'Administration.Dashboard.SystemHealth.Localization': 'Localization catalog is available.',
  'Administration.Dashboard.SystemHealth.NotificationTemplates': 'Notification templates are configured.',
  'Administration.UserManagement.Title': 'User Management',
  'Administration.UserManagement.Subtitle': 'Manage hospital users, roles, access, status, and account recovery.',
  'Administration.UserManagement.Search.Placeholder': 'Search users',
  'Administration.UserManagement.Filter.Role': 'Role',
  'Administration.UserManagement.Filter.Status': 'Status',
  'Administration.UserManagement.Filter.AllRoles': 'All roles',
  'Administration.UserManagement.Filter.AllStatuses': 'All statuses',
  'Administration.UserManagement.Columns.Name': 'Name',
  'Administration.UserManagement.Columns.Email': 'Email',
  'Administration.UserManagement.Columns.Roles': 'Roles',
  'Administration.UserManagement.Columns.Status': 'Status',
  'Administration.UserManagement.Columns.LastLogin': 'Last login',
  'Administration.UserManagement.Columns.Actions': 'Actions',
  'Administration.UserManagement.Columns.Branch': 'Branch',
  'Administration.UserManagement.Columns.Department': 'Department',
  'Administration.UserManagement.Actions.New': 'New user',
  'Administration.UserManagement.Actions.Export': 'Export',
  'Administration.UserManagement.Actions.Edit': 'Edit',
  'Administration.UserManagement.Actions.Delete': 'Delete',
  'Administration.UserManagement.Actions.Activate': 'Activate',
  'Administration.UserManagement.Actions.Deactivate': 'Deactivate',
  'Administration.UserManagement.Actions.Unlock': 'Unlock',
  'Administration.UserManagement.Actions.ResetPassword': 'Reset password',
  'Administration.UserManagement.Actions.ViewAudit': 'View audit',
  'Administration.UserManagement.Actions.Cancel': 'Cancel',
  'Administration.UserManagement.Actions.Save': 'Save user',
  'Administration.UserManagement.Empty': 'No users found.',
  'Administration.UserManagement.Status.Active': 'Active',
  'Administration.UserManagement.Status.Inactive': 'Inactive',
  'Administration.UserManagement.Status.Locked': 'Locked',
  'Administration.Branch.Title': 'Branch Management',
  'Administration.Branch.Subtitle': 'Manage hospital branches, locations, contacts, working hours, and settings.',
  'Administration.Branch.Filter.Search': 'Search branches',
  'Administration.Branch.Columns.Branch': 'Branch',
  'Administration.Branch.Columns.Location': 'Location',
  'Administration.Branch.Actions.NewBranch': 'New branch',
  'Administration.Branch.Actions.SaveBranch': 'Save branch',
  'Administration.Branch.Actions.SetDefault': 'Set default',
  'Administration.Branch.Actions.Activate': 'Activate',
  'Administration.Branch.Actions.Deactivate': 'Deactivate',
  'Administration.Branch.Actions.AddSetting': 'Add setting',
  'Administration.Branch.Empty': 'No branches found.',
  'Administration.Branch.Section.Profile': 'Profile',
  'Administration.Branch.Section.Address': 'Address',
  'Administration.Branch.Section.Contact': 'Contact',
  'Administration.Branch.Section.WorkingHours': 'Working hours',
  'Administration.Branch.Section.Configuration': 'Configuration',
  'Administration.Branch.Fields.DefaultBranch': 'Default branch',
  'Administration.Branch.Fields.BranchCode': 'Branch code',
  'Administration.Branch.Fields.BranchName': 'Branch name',
  'Administration.Branch.Fields.BranchTypeCode': 'Branch type',
  'Administration.Branch.Fields.AddressLine1': 'Address line 1',
  'Administration.Branch.Fields.AddressLine2': 'Address line 2',
  'Administration.Branch.Fields.CityName': 'City',
  'Administration.Branch.Fields.StateName': 'State',
  'Administration.Branch.Fields.CountryCode': 'Country',
  'Administration.Branch.Fields.PostalCode': 'Postal code',
  'Administration.Branch.Fields.PrimaryPhone': 'Primary phone',
  'Administration.Branch.Fields.SecondaryPhone': 'Secondary phone',
  'Administration.Branch.Fields.EmergencyPhone': 'Emergency phone',
  'Administration.Branch.Fields.Email': 'Email',
  'Administration.Branch.Fields.Fax': 'Fax',
  'Administration.Branch.Fields.Closed': 'Closed',
  'Administration.Branch.Fields.SettingKey': 'Setting key',
  'Administration.Branch.Fields.SettingValue': 'Setting value',
  'Navigation.SessionManagement': 'Session Management',
  'Navigation.BranchManagement': 'Branch Management',
  'Navigation.DepartmentManagement': 'Department Management',
  'Hospital.Subscription.Status.ACTIVE': 'Active',
  'Hospital.Subscription.Status.TRIAL': 'Trial',
  'Hospital.Subscription.Status.SUSPENDED': 'Suspended',
  'Hospital.Subscription.Status.EXPIRED': 'Expired',
  'Hospital.Subscription.Status.CANCELLED': 'Cancelled',
  'Hospital.Subscription.Status.UNKNOWN': 'Unknown',
  'Administration.SystemConfiguration.Channel.EMAIL': 'Email',
  'Administration.SystemConfiguration.Channel.SMS': 'SMS',
  'Administration.SystemConfiguration.Channel.WHATSAPP': 'WhatsApp',
  'Administration.SystemConfiguration.Channel.IN_APP': 'In-app'
};
