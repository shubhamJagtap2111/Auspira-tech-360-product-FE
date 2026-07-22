import { ApiResponse, RegisterTenantRequest, TenantRegistrationResponse } from '../../core/auth/auth.models';

export type TenantManagementApiResponse<T> = ApiResponse<T>;

export interface TenantListResponse {
  items: TenantListItem[];
  totalCount: number;
}

export interface TenantListItem {
  tenantId: string;
  hospitalName: string;
  tenantCode: string;
  databaseName: string;
  databaseServerKey: string;
  planCode: string;
  tenantStatus: string;
  licenseStatus: string;
  schemaVersion: string;
  databaseStatus: string;
  storageGb: number;
  userCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface TenantDetails {
  summary: TenantListItem;
  domains: TenantDomainItem[];
  provisionJobs: TenantProvisionJobItem[];
  activityLogs: TenantActivityLogItem[];
  databaseVersions: TenantDatabaseVersionItem[];
}

export interface TenantDomainItem {
  domainId: string;
  domainName: string;
  domainType: string;
  isPrimary: boolean;
  verificationStatus: string;
  createdAt: string;
}

export interface TenantProvisionJobItem {
  jobId: string;
  jobType: string;
  status: string;
  requestedBy: string;
  message: string;
  createdAt: string;
  completedAt: string | null;
}

export interface TenantActivityLogItem {
  activityLogId: string;
  activityType: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface TenantDatabaseVersionItem {
  databaseVersionId: string;
  databaseName: string;
  schemaVersion: string;
  migrationStatus: string;
  storageGb: number;
  lastBackupAt: string | null;
  updatedAt: string;
}

export interface TenantSearchParams {
  searchText?: string | null;
  tenantStatus?: string | null;
  licenseStatus?: string | null;
  databaseStatus?: string | null;
  pageNumber?: number;
  pageSize?: number;
}

export interface UpdateTenantStatusRequest {
  status: string;
  reason?: string | null;
}

export interface UpgradeTenantPlanRequest {
  planCode: string;
  reason?: string | null;
}

export interface QueueTenantJobRequest {
  jobType: string;
  message?: string | null;
}

export type { RegisterTenantRequest, TenantRegistrationResponse };
