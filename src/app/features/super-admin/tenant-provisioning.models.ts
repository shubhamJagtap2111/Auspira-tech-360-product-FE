import { ApiResponse } from '../../core/auth/auth.models';

export type TenantProvisioningApiResponse<T> = ApiResponse<T>;

export interface TenantProvisioningSnapshot {
  plans: ProvisioningPlanOption[];
  features: ProvisioningFeatureOption[];
  databaseServers: ProvisioningDatabaseServerOption[];
  recentJobs: TenantProvisioningJob[];
}

export interface ProvisioningPlanOption {
  code: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  currencyCode: string;
  isCustom: boolean;
  enabledFeatureCodes: string[];
}

export interface ProvisioningFeatureOption {
  featureId: string;
  code: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ProvisioningDatabaseServerOption {
  serverKey: string;
  provider: string;
  region: string;
  status: string;
  capacityGb: number;
  usedStorageGb: number;
}

export interface TenantProvisioningJob {
  jobId: string;
  tenantId: string | null;
  hospitalName: string;
  tenantCode: string;
  jobType: string;
  status: string;
  progressPercent: number;
  currentStep: string;
  requestedBy: string;
  message: string;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface ProvisionTenantRequest {
  hospitalName: string;
  tenantCode: string;
  mobileNo: string | null;
  timeZone: string | null;
  planCode: string;
  databaseServerKey: string;
  databaseName: string | null;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  adminMobileNo: string | null;
  enabledFeatureCodes: string[];
}

export interface ProvisionTenantResponse {
  job: TenantProvisioningJob;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  databaseName: string;
  adminEmail: string;
  licenseKey: string;
}
