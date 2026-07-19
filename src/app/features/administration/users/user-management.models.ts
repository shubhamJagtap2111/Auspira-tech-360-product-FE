import { ApiResponse } from '../../../core/auth/auth.models';

export type AdministrationApiResponse<T> = ApiResponse<T>;

export interface ManagedUser {
  userGuid: string;
  email: string;
  fullName: string;
  mobileNo: string | null;
  isEmailVerified: boolean;
  emailVerifiedDate: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginDate: string | null;
  passwordChangedDate: string | null;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  roleCodes: string[];
  rowVersion: string;
}

export interface AssignableRole {
  roleCode: string;
  roleNameKey: string;
  isSystemRole: boolean;
  isActive: boolean;
}

export interface UserSearchResponse {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  items: ManagedUser[];
}

export interface UserFormModel {
  email: string;
  password: string;
  fullName: string;
  mobileNo: string;
  isEmailVerified: boolean;
  roleCodes: string[];
  rowVersion: string;
}

export interface UserCommandResponse {
  succeeded: boolean;
}
