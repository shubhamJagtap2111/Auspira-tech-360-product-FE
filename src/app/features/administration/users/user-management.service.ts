import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import {
  AdministrationApiResponse,
  AssignableRole,
  ManagedUser,
  UserCommandResponse,
  UserFormModel,
  UserSearchResponse
} from './user-management.models';

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly api = inject(ApiClientService);

  searchUsers(query: {
    searchText?: string;
    roleCode?: string;
    isActive?: boolean | null;
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

    return firstValueFrom(this.api.get<AdministrationApiResponse<UserSearchResponse>>(`/administration/users?${params}`));
  }

  getAssignableRoles(): Promise<AdministrationApiResponse<AssignableRole[]>> {
    return firstValueFrom(this.api.get<AdministrationApiResponse<AssignableRole[]>>('/administration/users/assignable-roles'));
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
}

function createPayload(form: UserFormModel) {
  return {
    email: form.email,
    password: form.password,
    fullName: form.fullName,
    mobileNo: form.mobileNo || null,
    isEmailVerified: form.isEmailVerified,
    roleCodes: form.roleCodes
  };
}

function updatePayload(form: UserFormModel) {
  return {
    email: form.email,
    fullName: form.fullName,
    mobileNo: form.mobileNo || null,
    isEmailVerified: form.isEmailVerified,
    rowVersion: form.rowVersion
  };
}
