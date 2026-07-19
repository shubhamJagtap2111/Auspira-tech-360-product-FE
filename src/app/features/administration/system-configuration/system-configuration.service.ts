import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import {
  FiscalYear,
  NotificationTemplate,
  NumberSeries,
  SystemConfigurationApiResponse,
  SystemConfigurationCatalog,
  SystemConfigurationSetting
} from './system-configuration.models';

@Injectable({ providedIn: 'root' })
export class SystemConfigurationService {
  private readonly api = inject(ApiClientService);

  getCatalog(): Promise<SystemConfigurationApiResponse<SystemConfigurationCatalog>> {
    return firstValueFrom(this.api.get<SystemConfigurationApiResponse<SystemConfigurationCatalog>>('/administration/system-configuration'));
  }

  saveSettings(settings: SystemConfigurationSetting[]): Promise<SystemConfigurationApiResponse<SystemConfigurationSetting[]>> {
    return firstValueFrom(this.api.put<SystemConfigurationApiResponse<SystemConfigurationSetting[]>>('/administration/system-configuration/settings', { settings }));
  }

  saveNumberSeries(item: NumberSeries): Promise<SystemConfigurationApiResponse<NumberSeries>> {
    return firstValueFrom(this.api.post<SystemConfigurationApiResponse<NumberSeries>>('/administration/system-configuration/number-series', createNumberSeriesPayload(item)));
  }

  setNumberSeriesStatus(numberSeriesGuid: string, isActive: boolean): Promise<SystemConfigurationApiResponse<NumberSeries>> {
    return firstValueFrom(this.api.patch<SystemConfigurationApiResponse<NumberSeries>>(`/administration/system-configuration/number-series/${numberSeriesGuid}/status`, { isActive }));
  }

  saveFiscalYear(item: FiscalYear): Promise<SystemConfigurationApiResponse<FiscalYear>> {
    return firstValueFrom(this.api.post<SystemConfigurationApiResponse<FiscalYear>>('/administration/system-configuration/fiscal-years', createFiscalYearPayload(item)));
  }

  setFiscalYearStatus(fiscalYearGuid: string, isClosed: boolean): Promise<SystemConfigurationApiResponse<FiscalYear>> {
    return firstValueFrom(this.api.patch<SystemConfigurationApiResponse<FiscalYear>>(`/administration/system-configuration/fiscal-years/${fiscalYearGuid}/status`, { isClosed }));
  }

  saveTemplate(item: NotificationTemplate): Promise<SystemConfigurationApiResponse<NotificationTemplate>> {
    return firstValueFrom(this.api.post<SystemConfigurationApiResponse<NotificationTemplate>>('/administration/system-configuration/notification-templates', createTemplatePayload(item)));
  }

  setTemplateStatus(notificationTemplateGuid: string, isActive: boolean): Promise<SystemConfigurationApiResponse<NotificationTemplate>> {
    return firstValueFrom(this.api.patch<SystemConfigurationApiResponse<NotificationTemplate>>(`/administration/system-configuration/notification-templates/${notificationTemplateGuid}/status`, { isActive }));
  }
}

function createNumberSeriesPayload(item: NumberSeries) {
  return {
    numberSeriesGuid: item.numberSeriesGuid || null,
    seriesCode: item.seriesCode,
    seriesNameKey: item.seriesNameKey,
    prefix: item.prefix,
    suffix: item.suffix || null,
    nextNumber: item.nextNumber,
    paddingLength: item.paddingLength,
    resetFrequencyCode: item.resetFrequencyCode,
    lastResetDate: item.lastResetDate || null,
    rowVersion: item.rowVersion || null
  };
}

function createFiscalYearPayload(item: FiscalYear) {
  return {
    fiscalYearGuid: item.fiscalYearGuid || null,
    fiscalYearCode: item.fiscalYearCode,
    startDate: item.startDate,
    endDate: item.endDate,
    isCurrent: item.isCurrent,
    isClosed: item.isClosed,
    rowVersion: item.rowVersion || null
  };
}

function createTemplatePayload(item: NotificationTemplate) {
  return {
    notificationTemplateGuid: item.notificationTemplateGuid || null,
    templateCode: item.templateCode,
    channelCode: item.channelCode,
    languageCode: item.languageCode,
    subjectTemplate: item.subjectTemplate || null,
    bodyTemplate: item.bodyTemplate,
    rowVersion: item.rowVersion || null
  };
}
