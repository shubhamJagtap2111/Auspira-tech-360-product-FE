import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { MonitoringApiResponse, MonitoringSnapshot } from './monitoring.models';

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<MonitoringApiResponse<MonitoringSnapshot>> {
    return firstValueFrom(this.api.get<MonitoringApiResponse<MonitoringSnapshot>>('/super-admin/monitoring'));
  }
}
