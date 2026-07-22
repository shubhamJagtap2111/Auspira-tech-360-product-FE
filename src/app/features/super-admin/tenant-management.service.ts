import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  QueueTenantJobRequest,
  RegisterTenantRequest,
  TenantActivityLogItem,
  TenantDetails,
  TenantListResponse,
  TenantManagementApiResponse,
  TenantRegistrationResponse,
  TenantSearchParams,
  UpgradeTenantPlanRequest,
  UpdateTenantStatusRequest
} from './tenant-management.models';

@Injectable({ providedIn: 'root' })
export class TenantManagementService {
  private readonly api = inject(ApiClientService);

  searchTenants(params: TenantSearchParams): Promise<TenantManagementApiResponse<TenantListResponse>> {
    return firstValueFrom(this.api.get<TenantManagementApiResponse<TenantListResponse>>(`/super-admin/tenants${toQuery(params)}`));
  }

  getTenant(tenantCode: string): Promise<TenantManagementApiResponse<TenantDetails>> {
    return firstValueFrom(this.api.get<TenantManagementApiResponse<TenantDetails>>(`/super-admin/tenants/${encodeURIComponent(tenantCode)}`));
  }

  registerHospital(request: RegisterTenantRequest): Promise<TenantManagementApiResponse<TenantRegistrationResponse>> {
    return firstValueFrom(this.api.post<TenantManagementApiResponse<TenantRegistrationResponse>>('/super-admin/tenants', request));
  }

  updateStatus(tenantCode: string, request: UpdateTenantStatusRequest): Promise<TenantManagementApiResponse<TenantDetails>> {
    return firstValueFrom(this.api.post<TenantManagementApiResponse<TenantDetails>>(`/super-admin/tenants/${encodeURIComponent(tenantCode)}/status`, request));
  }

  upgradePlan(tenantCode: string, request: UpgradeTenantPlanRequest): Promise<TenantManagementApiResponse<TenantDetails>> {
    return firstValueFrom(this.api.post<TenantManagementApiResponse<TenantDetails>>(`/super-admin/tenants/${encodeURIComponent(tenantCode)}/upgrade`, request));
  }

  queueJob(tenantCode: string, request: QueueTenantJobRequest): Promise<TenantManagementApiResponse<TenantDetails>> {
    return firstValueFrom(this.api.post<TenantManagementApiResponse<TenantDetails>>(`/super-admin/tenants/${encodeURIComponent(tenantCode)}/jobs`, request));
  }

  getLogs(tenantCode: string): Promise<TenantManagementApiResponse<TenantActivityLogItem[]>> {
    return firstValueFrom(this.api.get<TenantManagementApiResponse<TenantActivityLogItem[]>>(`/super-admin/tenants/${encodeURIComponent(tenantCode)}/logs`));
  }
}

function toQuery(params: TenantSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  }

  const value = query.toString();
  return value ? `?${value}` : '';
}
