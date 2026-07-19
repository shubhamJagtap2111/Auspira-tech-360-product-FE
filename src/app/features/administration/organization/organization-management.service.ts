import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import { Department, Designation, OrganizationApiResponse } from './organization-management.models';

@Injectable({ providedIn: 'root' })
export class OrganizationManagementService {
  private readonly api = inject(ApiClientService);

  searchDepartments(searchText = '', includeInactive = true): Promise<OrganizationApiResponse<Department[]>> {
    return firstValueFrom(this.api.get<OrganizationApiResponse<Department[]>>(`/administration/departments?${createQuery(searchText, includeInactive)}`));
  }

  createDepartment(item: Department): Promise<OrganizationApiResponse<Department>> {
    return firstValueFrom(this.api.post<OrganizationApiResponse<Department>>('/administration/departments', createDepartmentPayload(item)));
  }

  updateDepartment(item: Department): Promise<OrganizationApiResponse<Department>> {
    return firstValueFrom(this.api.put<OrganizationApiResponse<Department>>(`/administration/departments/${item.departmentGuid}`, createDepartmentPayload(item)));
  }

  setDepartmentStatus(departmentGuid: string, isActive: boolean): Promise<OrganizationApiResponse<Department>> {
    return firstValueFrom(this.api.patch<OrganizationApiResponse<Department>>(`/administration/departments/${departmentGuid}/status`, { isActive }));
  }

  searchDesignations(searchText = '', includeInactive = true): Promise<OrganizationApiResponse<Designation[]>> {
    return firstValueFrom(this.api.get<OrganizationApiResponse<Designation[]>>(`/administration/designations?${createQuery(searchText, includeInactive)}`));
  }

  createDesignation(item: Designation): Promise<OrganizationApiResponse<Designation>> {
    return firstValueFrom(this.api.post<OrganizationApiResponse<Designation>>('/administration/designations', createDesignationPayload(item)));
  }

  updateDesignation(item: Designation): Promise<OrganizationApiResponse<Designation>> {
    return firstValueFrom(this.api.put<OrganizationApiResponse<Designation>>(`/administration/designations/${item.designationGuid}`, createDesignationPayload(item)));
  }

  setDesignationStatus(designationGuid: string, isActive: boolean): Promise<OrganizationApiResponse<Designation>> {
    return firstValueFrom(this.api.patch<OrganizationApiResponse<Designation>>(`/administration/designations/${designationGuid}/status`, { isActive }));
  }
}

function createQuery(searchText: string, includeInactive: boolean): string {
  const query = new URLSearchParams({ includeInactive: String(includeInactive) });
  if (searchText.trim()) {
    query.set('searchText', searchText.trim());
  }

  return query.toString();
}

function createDepartmentPayload(item: Department) {
  return {
    departmentGuid: item.departmentGuid || null,
    branchGuid: item.branchGuid || null,
    departmentCode: item.departmentCode,
    departmentName: item.departmentName,
    descriptionKey: item.descriptionKey || null,
    departmentHeadUserGuid: item.departmentHeadUserGuid || null,
    sortOrder: item.sortOrder,
    rowVersion: item.rowVersion || null
  };
}

function createDesignationPayload(item: Designation) {
  return {
    designationGuid: item.designationGuid || null,
    designationCode: item.designationCode,
    designationName: item.designationName,
    descriptionKey: item.descriptionKey || null,
    parentDesignationGuid: item.parentDesignationGuid || null,
    levelNo: item.levelNo,
    sortOrder: item.sortOrder,
    rowVersion: item.rowVersion || null
  };
}
