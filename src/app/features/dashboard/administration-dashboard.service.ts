import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { AdministrationDashboard, AdministrationDashboardApiResponse } from './administration-dashboard.models';

@Injectable({ providedIn: 'root' })
export class AdministrationDashboardService {
  private readonly api = inject(ApiClientService);

  getDashboard(): Promise<AdministrationDashboardApiResponse<AdministrationDashboard>> {
    return firstValueFrom(this.api.get<AdministrationDashboardApiResponse<AdministrationDashboard>>('/administration/dashboard'));
  }
}
