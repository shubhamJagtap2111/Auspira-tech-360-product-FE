import { ApiResponse } from '../../core/auth/auth.models';

export type GlobalSettingsApiResponse<T> = ApiResponse<T>;

export interface GlobalSettingsSnapshot {
  summary: GlobalSettingsSummary;
  settings: GlobalSettingItem[];
  countries: PlatformCountryItem[];
  currencies: PlatformCurrencyItem[];
  languages: PlatformLanguageItem[];
}

export interface GlobalSettingsSummary {
  totalSettings: number;
  encryptedSettings: number;
  countries: number;
  currencies: number;
  languages: number;
}

export interface GlobalSettingItem {
  settingId: string;
  settingKey: string;
  settingValue: string | null;
  categoryCode: string;
  displayName: string;
  dataType: string;
  isEncrypted: boolean;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface PlatformCountryItem {
  countryId: string;
  iso2Code: string;
  iso3Code: string;
  countryName: string;
  phoneCode: string;
  currencyCode: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PlatformCurrencyItem {
  currencyId: string;
  currencyCode: string;
  currencyName: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
  sortOrder: number;
}

export interface PlatformLanguageItem {
  languageId: string;
  cultureCode: string;
  languageName: string;
  nativeName: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface UpsertGlobalSettingsRequest {
  settings: GlobalSettingInput[];
}

export interface GlobalSettingInput {
  settingKey: string;
  settingValue: string | null;
  isActive: boolean;
}
