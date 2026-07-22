import { ApiResponse } from '../../core/auth/auth.models';

export type SuperAdminDashboardApiResponse<T> = ApiResponse<T>;

export interface SuperAdminDashboard {
  summary: SuperAdminDashboardSummary;
  tenantStatusBreakdown: TenantStatusBreakdownItem[];
  health: PlatformHealthItem[];
  recentActivity: RecentPlatformActivityItem[];
  alerts: PlatformAlertItem[];
}

export interface SuperAdminDashboardSummary {
  totalHospitals: number;
  activeHospitals: number;
  trialHospitals: number;
  expiredHospitals: number;
  monthlyRecurringRevenue: number;
  newRegistrationsThisMonth: number;
  databaseHealthStatusCode: string;
  serverHealthStatusCode: string;
  activePlatformSessions: number;
  openAlerts: number;
  generatedAt: string;
}

export interface TenantStatusBreakdownItem {
  statusCode: string;
  count: number;
}

export interface PlatformHealthItem {
  componentCode: string;
  statusCode: string;
  message: string;
  checkedAt: string | null;
}

export interface RecentPlatformActivityItem {
  activityType: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface PlatformAlertItem {
  severityCode: string;
  title: string;
  description: string;
  createdAt: string;
}
