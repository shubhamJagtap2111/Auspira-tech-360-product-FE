import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { GlobalSettingsApiResponse, GlobalSettingsSnapshot, UpsertGlobalSettingsRequest } from './global-settings.models';

@Injectable({ providedIn: 'root' })
export class GlobalSettingsService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<GlobalSettingsApiResponse<GlobalSettingsSnapshot>> {
    return firstValueFrom(this.api.get<GlobalSettingsApiResponse<GlobalSettingsSnapshot>>('/super-admin/global-settings'));
  }

  saveSettings(request: UpsertGlobalSettingsRequest): Promise<GlobalSettingsApiResponse<GlobalSettingsSnapshot>> {
    return firstValueFrom(this.api.put<GlobalSettingsApiResponse<GlobalSettingsSnapshot>>('/super-admin/global-settings/settings', request));
  }
}
