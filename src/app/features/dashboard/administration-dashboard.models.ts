import { ApiResponse } from '../../core/auth/auth.models';

export type AdministrationDashboardApiResponse<T> = ApiResponse<T>;

export interface AdministrationDashboard {
  summary: AdministrationDashboardSummary;
  auditSummary: AuditSummaryItem[];
  recentLogins: RecentLoginItem[];
  notifications: NotificationStatusItem[];
  systemHealth: SystemHealthItem[];
}

export interface AdministrationDashboardSummary {
  totalHospitals: number;
  totalUsers: number;
  activeUsers: number;
  activeSessions: number;
  branchCount: number;
  departmentCount: number;
  auditEventsToday: number;
  loginsToday: number;
  notificationTemplateCount: number;
  storedProfileImageCount: number;
  subscriptionStatusCode: string;
  licenseStatusCode: string;
  systemHealthStatusCode: string;
  generatedAt: string;
}

export interface AuditSummaryItem {
  actionCode: string;
  eventCount: number;
  lastEventAt: string | null;
}

export interface RecentLoginItem {
  email: string;
  displayName: string;
  wasSuccessful: boolean;
  failureReasonKey: string | null;
  ipAddress: string | null;
  machineName: string | null;
  loginDate: string;
}

export interface NotificationStatusItem {
  templateCode: string;
  channelCode: string;
  languageCode: string;
  isActive: boolean;
  modifiedDate: string | null;
  createdDate: string;
}

export interface SystemHealthItem {
  componentCode: string;
  statusCode: string;
  messageKey: string;
}
