import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { SuperAdminDashboard, SuperAdminDashboardApiResponse } from './super-admin-dashboard.models';

@Injectable({ providedIn: 'root' })
export class SuperAdminDashboardService {
  private readonly api = inject(ApiClientService);

  getDashboard(): Promise<SuperAdminDashboardApiResponse<SuperAdminDashboard>> {
    return firstValueFrom(this.api.get<SuperAdminDashboardApiResponse<SuperAdminDashboard>>('/super-admin/dashboard'));
  }
}
