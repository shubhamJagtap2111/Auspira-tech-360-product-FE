import { ApiResponse } from '../../../core/auth/auth.models';

export type AdministrationApiResponse<T> = ApiResponse<T>;

export interface ManagedUser {
  userGuid: string;
  email: string;
  fullName: string;
  mobileNo: string | null;
  profileImagePath: string | null;
  profileImageFileName: string | null;
  profileImageContentType: string | null;
  hospitalGuid: string | null;
  hospitalName: string | null;
  branchCode: string | null;
  branchNameKey: string | null;
  departmentCode: string | null;
  departmentNameKey: string | null;
  languageCode: string | null;
  languageName: string | null;
  timeZoneCode: string | null;
  timeZoneNameKey: string | null;
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
  hospitalGuid: string;
  hospitalName: string;
  branchCode: string;
  branchNameKey: string;
  departmentCode: string;
  departmentNameKey: string;
  languageCode: string;
  timeZoneCode: string;
  isEmailVerified: boolean;
  roleCodes: string[];
  rowVersion: string;
}

export interface UserCommandResponse {
  succeeded: boolean;
}

export interface UserReferenceDataResponse {
  languages: UserLanguageOption[];
  timeZones: UserTimeZoneOption[];
}

export interface UserLanguageOption {
  languageCode: string;
  englishName: string;
  nativeName: string;
  isDefault: boolean;
}

export interface UserTimeZoneOption {
  timeZoneCode: string;
  displayNameKey: string;
  utcOffsetMinutes: number;
}

export interface UserExportResponse {
  fileName: string;
  contentType: string;
  base64Content: string;
}

export interface ImportUserRow {
  email: string;
  fullName: string;
  mobileNo: string | null;
  roleCodes: string[];
  hospitalGuid: string | null;
  hospitalName: string | null;
  branchCode: string | null;
  branchNameKey: string | null;
  departmentCode: string | null;
  departmentNameKey: string | null;
  languageCode: string | null;
  timeZoneCode: string | null;
}

export interface UserImportResult {
  createdCount: number;
  skippedCount: number;
}

export interface UserAuditHistoryItem {
  auditTrailId: number;
  entityName: string;
  entityId: string | null;
  action: string;
  changeJson: string | null;
  correlationId: string | null;
  createdDate: string;
  createdBy: number | null;
  ipAddress: string | null;
  machineName: string | null;
  browser: string | null;
  userAgent: string | null;
}
