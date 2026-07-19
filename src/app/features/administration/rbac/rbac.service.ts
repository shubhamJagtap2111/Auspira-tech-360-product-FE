import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import { CopyRoleModel, PermissionCatalogItem, PermissionMatrixRow, RbacApiResponse, RoleDto, RoleFormModel } from './rbac.models';

@Injectable({ providedIn: 'root' })
export class RbacService {
  private readonly api = inject(ApiClientService);

  getRoles(query?: { searchText?: string; isActive?: boolean | null }): Promise<RbacApiResponse<RoleDto[]>> {
    const params = new URLSearchParams();
    if (query?.searchText) {
      params.set('searchText', query.searchText);
    }

    if (query?.isActive !== null && query?.isActive !== undefined) {
      params.set('isActive', String(query.isActive));
    }

    const suffix = params.toString() ? `?${params}` : '';
    return firstValueFrom(this.api.get<RbacApiResponse<RoleDto[]>>(`/administration/rbac/roles${suffix}`));
  }

  getRole(roleCode: string): Promise<RbacApiResponse<RoleDto>> {
    return firstValueFrom(this.api.get<RbacApiResponse<RoleDto>>(`/administration/rbac/roles/${encodeURIComponent(roleCode)}`));
  }

  getPermissionCatalog(): Promise<RbacApiResponse<PermissionCatalogItem[]>> {
    return firstValueFrom(this.api.get<RbacApiResponse<PermissionCatalogItem[]>>('/administration/rbac/permission-catalog'));
  }

  getPermissionMatrix(roleCode?: string): Promise<RbacApiResponse<PermissionMatrixRow[]>> {
    const suffix = roleCode ? `?roleCode=${encodeURIComponent(roleCode)}` : '';
    return firstValueFrom(this.api.get<RbacApiResponse<PermissionMatrixRow[]>>(`/administration/rbac/permission-matrix${suffix}`));
  }

  createRole(form: RoleFormModel): Promise<RbacApiResponse<RoleDto>> {
    return firstValueFrom(this.api.post<RbacApiResponse<RoleDto>>('/administration/rbac/roles', createPayload(form)));
  }

  updateRole(form: RoleFormModel): Promise<RbacApiResponse<RoleDto>> {
    return firstValueFrom(this.api.put<RbacApiResponse<RoleDto>>(`/administration/rbac/roles/${encodeURIComponent(form.roleCode)}`, updatePayload(form)));
  }

  assignPermissions(roleCode: string, permissionCodes: string[]): Promise<RbacApiResponse<RoleDto>> {
    return firstValueFrom(this.api.put<RbacApiResponse<RoleDto>>(`/administration/rbac/roles/${encodeURIComponent(roleCode)}/permissions`, { permissionCodes }));
  }

  setRoleParent(roleCode: string, parentRoleCode: string | null): Promise<RbacApiResponse<RoleDto[]>> {
    return firstValueFrom(this.api.put<RbacApiResponse<RoleDto[]>>(`/administration/rbac/roles/${encodeURIComponent(roleCode)}/parent`, { parentRoleCode }));
  }

  copyRole(sourceRoleCode: string, model: CopyRoleModel): Promise<RbacApiResponse<RoleDto>> {
    return firstValueFrom(this.api.post<RbacApiResponse<RoleDto>>(`/administration/rbac/roles/${encodeURIComponent(sourceRoleCode)}/copy`, {
      targetRoleCode: model.targetRoleCode,
      targetRoleNameKey: model.targetRoleNameKey,
      targetRoleDescriptionKey: model.targetRoleDescriptionKey || null
    }));
  }
}

function createPayload(form: RoleFormModel) {
  return {
    roleCode: form.roleCode,
    roleNameKey: form.roleNameKey,
    roleDescriptionKey: form.roleDescriptionKey || null,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    permissionCodes: form.permissionCodes
  };
}

function updatePayload(form: RoleFormModel) {
  return {
    roleNameKey: form.roleNameKey,
    roleDescriptionKey: form.roleDescriptionKey || null,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    rowVersion: form.rowVersion
  };
}
