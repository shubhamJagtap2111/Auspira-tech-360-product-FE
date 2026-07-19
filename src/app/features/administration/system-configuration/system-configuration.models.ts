import { ApiResponse } from '../../../core/auth/auth.models';

export type SystemConfigurationApiResponse<T> = ApiResponse<T>;

export interface SystemConfigurationCatalog {
  settings: SystemConfigurationSetting[];
  numberSeries: NumberSeries[];
  fiscalYears: FiscalYear[];
  notificationTemplates: NotificationTemplate[];
}

export interface SystemConfigurationSetting {
  settingKey: string;
  settingCategoryCode: string;
  settingValue: string | null;
  dataType: string;
  displayNameKey: string;
  descriptionKey: string | null;
  isEncrypted: boolean;
  sortOrder: number;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface NumberSeries {
  numberSeriesGuid: string;
  seriesCode: string;
  seriesNameKey: string;
  prefix: string;
  suffix: string | null;
  nextNumber: number;
  paddingLength: number;
  resetFrequencyCode: string;
  lastResetDate: string | null;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface FiscalYear {
  fiscalYearGuid: string;
  fiscalYearCode: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isClosed: boolean;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface NotificationTemplate {
  notificationTemplateGuid: string;
  templateCode: string;
  channelCode: string;
  languageCode: string;
  languageName: string;
  subjectTemplate: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}
