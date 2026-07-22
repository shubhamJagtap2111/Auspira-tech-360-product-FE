import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  PlanCatalog,
  PlanManagementApiResponse,
  UpsertFeatureRequest,
  UpsertLimitDefinitionRequest,
  UpsertPlanRequest
} from './plan-management.models';

@Injectable({ providedIn: 'root' })
export class PlanManagementService {
  private readonly api = inject(ApiClientService);

  getCatalog(): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.get<PlanManagementApiResponse<PlanCatalog>>('/super-admin/plans'));
  }

  savePlan(request: UpsertPlanRequest): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.post<PlanManagementApiResponse<PlanCatalog>>('/super-admin/plans', request));
  }

  activatePlan(planCode: string): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.post<PlanManagementApiResponse<PlanCatalog>>(`/super-admin/plans/${encodeURIComponent(planCode)}/activate`, {}));
  }

  deactivatePlan(planCode: string): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.delete<PlanManagementApiResponse<PlanCatalog>>(`/super-admin/plans/${encodeURIComponent(planCode)}`));
  }

  saveFeature(request: UpsertFeatureRequest): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.post<PlanManagementApiResponse<PlanCatalog>>('/super-admin/plans/features', request));
  }

  saveLimitDefinition(request: UpsertLimitDefinitionRequest): Promise<PlanManagementApiResponse<PlanCatalog>> {
    return firstValueFrom(this.api.post<PlanManagementApiResponse<PlanCatalog>>('/super-admin/plans/limits', request));
  }
}
