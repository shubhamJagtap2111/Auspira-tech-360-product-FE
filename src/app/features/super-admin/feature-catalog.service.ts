import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  PlanCatalog,
  PlanManagementApiResponse,
  SetPlanFeatureRequest,
  UpsertFeatureRequest
} from './plan-management.models';

@Injectable({ providedIn: 'root' })
export class FeatureCatalogService {
  private readonly api = inject(ApiClientService);

  getCatalog(): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.get<PlanManagementApiResponse<PlanCatalog>>('/super-admin/features'));
  }

  saveFeature(request: UpsertFeatureRequest): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.post<PlanManagementApiResponse<PlanCatalog>>('/super-admin/features', request));
  }

  setPlanFeature(request: SetPlanFeatureRequest): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.post<PlanManagementApiResponse<PlanCatalog>>('/super-admin/features/plan-toggle', request));
  }
}
