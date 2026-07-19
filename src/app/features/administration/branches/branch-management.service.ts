import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import { BranchApiResponse, BranchConfiguration, BranchProfile, BranchSummary } from './branch-management.models';

@Injectable({ providedIn: 'root' })
export class BranchManagementService {
  private readonly api = inject(ApiClientService);

  search(searchText = '', includeInactive = true): Promise<BranchApiResponse<BranchSummary[]>> {
    const query = new URLSearchParams({ includeInactive: String(includeInactive) });
    if (searchText.trim()) {
      query.set('searchText', searchText.trim());
    }

    return firstValueFrom(this.api.get<BranchApiResponse<BranchSummary[]>>(`/administration/branches?${query.toString()}`));
  }

  get(branchGuid: string): Promise<BranchApiResponse<BranchProfile>> {
    return firstValueFrom(this.api.get<BranchApiResponse<BranchProfile>>(`/administration/branches/${branchGuid}`));
  }

  create(profile: BranchProfile): Promise<BranchApiResponse<BranchProfile>> {
    return firstValueFrom(this.api.post<BranchApiResponse<BranchProfile>>('/administration/branches', createPayload(profile)));
  }

  update(profile: BranchProfile): Promise<BranchApiResponse<BranchProfile>> {
    return firstValueFrom(this.api.put<BranchApiResponse<BranchProfile>>(`/administration/branches/${profile.branchGuid}`, createPayload(profile)));
  }

  setStatus(branchGuid: string, isActive: boolean): Promise<BranchApiResponse<BranchProfile>> {
    return firstValueFrom(this.api.patch<BranchApiResponse<BranchProfile>>(`/administration/branches/${branchGuid}/status`, { isActive }));
  }

  setDefault(branchGuid: string): Promise<BranchApiResponse<BranchProfile>> {
    return firstValueFrom(this.api.patch<BranchApiResponse<BranchProfile>>(`/administration/branches/${branchGuid}/default`, {}));
  }
}

function createPayload(profile: BranchProfile) {
  return {
    branchGuid: profile.branchGuid || null,
    branchCode: profile.branchCode,
    branchName: profile.branchName,
    branchTypeCode: profile.branchTypeCode || 'GENERAL',
    isDefault: profile.isDefault,
    address: profile.address,
    contact: profile.contact,
    workingHours: profile.workingHours,
    configuration: cleanConfiguration(profile.configuration),
    rowVersion: profile.rowVersion || null
  };
}

function cleanConfiguration(configuration: BranchConfiguration[]): BranchConfiguration[] {
  return configuration.filter(setting => setting.settingKey.trim().length > 0);
}
