import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ApiResponse } from '../auth/auth.models';
import { ApiClientService } from '../http/api-client.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { LocalizationCatalog, LocalizationVersion, SeedDataItem } from './i18n.models';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly api = inject(ApiClientService);
  private readonly authStore = inject(AuthStore);
  private readonly tenant = inject(TenantContextService);
  private readonly catalogSignal = signal<LocalizationCatalog | null>(null);

  readonly catalog = this.catalogSignal.asReadonly();
  readonly languages = computed(() => this.catalog()?.languages ?? []);
  readonly resources = computed(() => this.catalog()?.resources ?? {});

  async loadCatalog(cultureCode = this.tenant.cultureCode()): Promise<void> {
    this.tenant.setCulture(cultureCode);
    const tenantCode = this.tenant.tenantCode().trim();
    if (!tenantCode || !this.authStore.isAuthenticated()) {
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
    return this.resources()[resourceKey] ?? FALLBACK_RESOURCES[resourceKey] ?? resourceKey;
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
      this.api.get<ApiResponse<LocalizationVersion> | LocalizationVersion>('/localization/version')
    );
    return unwrapApiResponse(response)?.version ?? 0;
  }

  private async loadRemoteCatalog(cultureCode: string): Promise<LocalizationCatalog> {
    const response = await firstValueFrom(
      this.api.get<ApiResponse<LocalizationCatalog> | LocalizationCatalog>(`/localization/catalog?culture=${encodeURIComponent(cultureCode)}`)
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
    return `care360.localization.${this.tenant.tenantCode()}.${cultureCode}`;
  }
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
  'Auth.Login.Tenant.Label': 'Hospital code',
  'Auth.Login.Tenant.Placeholder': 'Enter hospital code',
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
  'Common.Errors.TenantRequired': 'Tenant is required.',
  'Common.Errors.TenantNotFound': 'Hospital tenant was not found.',
  'Common.Errors.TenantInactive': 'Hospital tenant is inactive.',
  'Common.Errors.LicenseExpired': 'Hospital license is expired.',
  'Common.Errors.UnhandledException': 'Something went wrong. Please try again.',
  'Common.Actions.Sending': 'Sending'
};
