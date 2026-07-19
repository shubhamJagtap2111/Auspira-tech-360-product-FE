import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { LocalizationCatalog, SeedDataItem } from './i18n.models';

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
      const catalog = await firstValueFrom(
        this.api.get<LocalizationCatalog>(`/localization/catalog?culture=${encodeURIComponent(cultureCode)}`)
      );
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
}

function createFallbackCatalog(cultureCode: string): LocalizationCatalog {
  return {
    requestedCulture: cultureCode,
    effectiveCulture: cultureCode,
    languages: [],
    resources: {},
    seedDataSets: []
  };
}
