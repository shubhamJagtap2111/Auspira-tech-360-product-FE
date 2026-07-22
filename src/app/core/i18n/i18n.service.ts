import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiResponse } from '../auth/auth.models';
import { ApiClientService } from '../http/api-client.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { LocalizationCatalog, LocalizationVersion, SeedDataItem } from './i18n.models';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly api = inject(ApiClientService);
  private readonly tenant = inject(TenantContextService);
  private readonly catalogSignal = signal<LocalizationCatalog | null>(null);

  readonly catalog = this.catalogSignal.asReadonly();
  readonly languages = computed(() => this.catalog()?.languages ?? []);
  readonly resources = computed(() => this.catalog()?.resources ?? {});

  async loadCatalog(cultureCode = this.tenant.cultureCode()): Promise<void> {
    this.tenant.setCulture(cultureCode);
    try {
      const version = await this.loadVersion();
      const cached = this.getCachedCatalog(cultureCode, version);
      const catalog = cached ?? await this.loadRemoteCatalog(cultureCode);

      this.setCachedCatalog(catalog);
      this.catalogSignal.set(catalog);
    } catch {
      this.catalogSignal.set(createFallbackCatalog(cultureCode));
    }
  }

  translate(resourceKey: string): string {
    return this.resources()[resourceKey] ?? resourceKey;
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

  private getCachedCatalog(cultureCode: string, version: number): LocalizationCatalog | null {
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

      return catalog.version === version ? catalog : null;
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
    resources: {},
    seedDataSets: [],
    version: 0
  };
}
