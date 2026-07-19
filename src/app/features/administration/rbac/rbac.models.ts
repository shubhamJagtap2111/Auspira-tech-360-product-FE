import { ApiResponse } from '../../../core/auth/auth.models';

export type RbacApiResponse<T> = ApiResponse<T>;

export interface RoleDto {
  roleCode: string;
  roleNameKey: string;
  roleDescriptionKey: string | null;
  isSystemRole: boolean;
  sortOrder: number;
  isActive: boolean;
  parentRoleCode: string | null;
  permissionCount: number;
  userCount: number;
  rowVersion: string;
  permissionCodes: string[];
}

export interface PermissionCatalogItem {
  categoryCode: string;
  categoryNameKey: string;
  groupCode: string;
  groupNameKey: string;
  menuCode: string;
  menuNameKey: string;
  permissionCode: string;
  permissionNameKey: string;
  actionCode: string;
  permissionTypeCode: string;
  dataScopeCode: string;
}

export interface PermissionMatrixRow extends PermissionCatalogItem {
  roleCode: string;
  roleNameKey: string;
  isAssigned: boolean;
}

export interface RoleFormModel {
  roleCode: string;
  roleNameKey: string;
  roleDescriptionKey: string;
  sortOrder: number;
  isActive: boolean;
  rowVersion: string;
  permissionCodes: string[];
}

export interface CopyRoleModel {
  targetRoleCode: string;
  targetRoleNameKey: string;
  targetRoleDescriptionKey: string;
}
