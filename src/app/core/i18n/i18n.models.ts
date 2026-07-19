export interface Language {
  cultureCode: string;
  englishName: string;
  nativeName: string;
  isDefault: boolean;
  direction: 'LeftToRight' | 'RightToLeft';
}

export interface SeedDataItem {
  code: string;
  sortOrder: number;
  translations: Record<string, string>;
}

export interface SeedDataSet {
  module: string;
  name: string;
  items: SeedDataItem[];
}

export interface LocalizationCatalog {
  requestedCulture: string;
  effectiveCulture: string;
  languages: Language[];
  resources: Record<string, string>;
  seedDataSets: SeedDataSet[];
}
