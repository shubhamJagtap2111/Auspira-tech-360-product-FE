import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  ProvisionTenantRequest,
  ProvisionTenantResponse,
  TenantProvisioningApiResponse,
  TenantProvisioningSnapshot
} from './tenant-provisioning.models';

@Injectable({ providedIn: 'root' })
export class TenantProvisioningService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<TenantProvisioningApiResponse<TenantProvisioningSnapshot>> {
    return firstValueFrom(this.api.get<TenantProvisioningApiResponse<TenantProvisioningSnapshot>>('/super-admin/provisioning'));
  }

  provisionTenant(request: ProvisionTenantRequest): Promise<TenantProvisioningApiResponse<ProvisionTenantResponse>> {
    return firstValueFrom(this.api.post<TenantProvisioningApiResponse<ProvisionTenantResponse>>('/super-admin/provisioning', request));
  }
}
