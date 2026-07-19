import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import {
  AdministrationApiResponse,
  AssignableRole,
  ImportUserRow,
  ManagedUser,
  UserAuditHistoryItem,
  UserCommandResponse,
  UserExportResponse,
  UserFormModel,
  UserImportResult,
  UserReferenceDataResponse,
  UserSearchResponse
} from './user-management.models';

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly api = inject(ApiClientService);

  searchUsers(query: {
    searchText?: string;
    roleCode?: string;
    isActive?: boolean | null;
    branchCode?: string;
    departmentCode?: string;
    languageCode?: string;
    timeZoneCode?: string;
    sortColumn?: string;
    sortDirection?: string;
    pageNumber: number;
    pageSize: number;
  }): Promise<AdministrationApiResponse<UserSearchResponse>> {
    const params = new URLSearchParams();
    params.set('pageNumber', String(query.pageNumber));
    params.set('pageSize', String(query.pageSize));

    if (query.searchText) {
      params.set('searchText', query.searchText);
    }

    if (query.roleCode) {
      params.set('roleCode', query.roleCode);
    }

    if (query.isActive !== null && query.isActive !== undefined) {
      params.set('isActive', String(query.isActive));
    }

    setOptional(params, 'branchCode', query.branchCode);
    setOptional(params, 'departmentCode', query.departmentCode);
    setOptional(params, 'languageCode', query.languageCode);
    setOptional(params, 'timeZoneCode', query.timeZoneCode);
    setOptional(params, 'sortColumn', query.sortColumn);
    setOptional(params, 'sortDirection', query.sortDirection);

    return firstValueFrom(this.api.get<AdministrationApiResponse<UserSearchResponse>>(`/administration/users?${params}`));
  }

  getAssignableRoles(): Promise<AdministrationApiResponse<AssignableRole[]>> {
    return firstValueFrom(this.api.get<AdministrationApiResponse<AssignableRole[]>>('/administration/users/assignable-roles'));
  }

  getReferenceData(): Promise<AdministrationApiResponse<UserReferenceDataResponse>> {
    return firstValueFrom(this.api.get<AdministrationApiResponse<UserReferenceDataResponse>>('/administration/users/reference-data'));
  }

  createUser(form: UserFormModel): Promise<AdministrationApiResponse<ManagedUser>> {
    return firstValueFrom(this.api.post<AdministrationApiResponse<ManagedUser>>('/administration/users', createPayload(form)));
  }

  updateUser(userGuid: string, form: UserFormModel): Promise<AdministrationApiResponse<ManagedUser>> {
    return firstValueFrom(this.api.put<AdministrationApiResponse<ManagedUser>>(`/administration/users/${userGuid}`, updatePayload(form)));
  }

  setStatus(userGuid: string, isActive: boolean): Promise<AdministrationApiResponse<ManagedUser>> {
    return firstValueFrom(this.api.patch<AdministrationApiResponse<ManagedUser>>(`/administration/users/${userGuid}/status`, { isActive }));
  }

  unlockUser(userGuid: string): Promise<AdministrationApiResponse<ManagedUser>> {
    return firstValueFrom(this.api.post<AdministrationApiResponse<ManagedUser>>(`/administration/users/${userGuid}/unlock`, {}));
  }

  assignRoles(userGuid: string, roleCodes: string[]): Promise<AdministrationApiResponse<ManagedUser>> {
    return firstValueFrom(this.api.put<AdministrationApiResponse<ManagedUser>>(`/administration/users/${userGuid}/roles`, { roleCodes }));
  }

  initiatePasswordReset(userGuid: string): Promise<AdministrationApiResponse<UserCommandResponse>> {
    return firstValueFrom(this.api.post<AdministrationApiResponse<UserCommandResponse>>(`/administration/users/${userGuid}/password-reset`, {}));
  }

  deleteUser(userGuid: string): Promise<AdministrationApiResponse<UserCommandResponse>> {
    return firstValueFrom(this.api.delete<AdministrationApiResponse<UserCommandResponse>>(`/administration/users/${userGuid}`));
  }

  uploadProfileImage(userGuid: string, fileName: string, contentType: string, base64Content: string): Promise<AdministrationApiResponse<ManagedUser>> {
    return firstValueFrom(this.api.put<AdministrationApiResponse<ManagedUser>>(`/administration/users/${userGuid}/profile-image`, { fileName, contentType, base64Content }));
  }

  exportUsers(query: {
    searchText?: string;
    roleCode?: string;
    isActive?: boolean | null;
    branchCode?: string;
    departmentCode?: string;
    languageCode?: string;
    timeZoneCode?: string;
  }): Promise<AdministrationApiResponse<UserExportResponse>> {
    const params = new URLSearchParams();
    setOptional(params, 'searchText', query.searchText);
    setOptional(params, 'roleCode', query.roleCode);
    setOptional(params, 'branchCode', query.branchCode);
    setOptional(params, 'departmentCode', query.departmentCode);
    setOptional(params, 'languageCode', query.languageCode);
    setOptional(params, 'timeZoneCode', query.timeZoneCode);

    if (query.isActive !== null && query.isActive !== undefined) {
      params.set('isActive', String(query.isActive));
    }

    return firstValueFrom(this.api.get<AdministrationApiResponse<UserExportResponse>>(`/administration/users/export?${params}`));
  }

  importUsers(defaultPassword: string, rows: ImportUserRow[]): Promise<AdministrationApiResponse<UserImportResult>> {
    return firstValueFrom(this.api.post<AdministrationApiResponse<UserImportResult>>('/administration/users/import', { defaultPassword, rows }));
  }

  getAuditHistory(userGuid: string): Promise<AdministrationApiResponse<UserAuditHistoryItem[]>> {
    return firstValueFrom(this.api.get<AdministrationApiResponse<UserAuditHistoryItem[]>>(`/administration/users/${userGuid}/audit-history`));
  }
}

function createPayload(form: UserFormModel) {
  return {
    email: form.email,
    password: form.password,
    fullName: form.fullName,
    mobileNo: form.mobileNo || null,
    hospitalGuid: form.hospitalGuid || null,
    hospitalName: form.hospitalName || null,
    branchCode: form.branchCode || null,
    branchNameKey: form.branchNameKey || null,
    departmentCode: form.departmentCode || null,
    departmentNameKey: form.departmentNameKey || null,
    languageCode: form.languageCode || null,
    timeZoneCode: form.timeZoneCode || null,
    isEmailVerified: form.isEmailVerified,
    roleCodes: form.roleCodes
  };
}

function updatePayload(form: UserFormModel) {
  return {
    email: form.email,
    fullName: form.fullName,
    mobileNo: form.mobileNo || null,
    hospitalGuid: form.hospitalGuid || null,
    hospitalName: form.hospitalName || null,
    branchCode: form.branchCode || null,
    branchNameKey: form.branchNameKey || null,
    departmentCode: form.departmentCode || null,
    departmentNameKey: form.departmentNameKey || null,
    languageCode: form.languageCode || null,
    timeZoneCode: form.timeZoneCode || null,
    isEmailVerified: form.isEmailVerified,
    rowVersion: form.rowVersion
  };
}

function setOptional(params: URLSearchParams, name: string, value: string | undefined): void {
  if (value) {
    params.set(name, value);
  }
}
