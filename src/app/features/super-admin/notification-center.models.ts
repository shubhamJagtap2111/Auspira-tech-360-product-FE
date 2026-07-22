import { ApiResponse } from '../../core/auth/auth.models';

export type NotificationCenterApiResponse<T> = ApiResponse<T>;

export interface NotificationCenterSnapshot {
  summary: NotificationCenterSummary;
  tenants: NotificationTenantOption[];
  templates: NotificationTemplateItem[];
  campaigns: NotificationCampaignItem[];
  deliveries: NotificationDeliveryItem[];
}

export interface NotificationCenterSummary {
  totalCampaigns: number;
  sentCampaigns: number;
  scheduledCampaigns: number;
  pendingDeliveries: number;
  failedDeliveries: number;
}

export interface NotificationTenantOption {
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  planCode: string;
  tenantStatus: string;
}

export interface NotificationTemplateItem {
  templateId: string;
  templateCode: string;
  notificationType: string;
  channel: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface NotificationCampaignItem {
  campaignId: string;
  campaignNo: string;
  notificationType: string;
  title: string;
  message: string;
  channels: string[];
  audience: string;
  targetTenantCodes: string[];
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  deliveryCount: number;
  failedCount: number;
}

export interface NotificationDeliveryItem {
  deliveryId: string;
  campaignId: string;
  campaignNo: string;
  tenantId: string | null;
  tenantCode: string;
  hospitalName: string;
  channel: string;
  recipient: string;
  status: string;
  providerReference: string;
  errorMessage: string;
  sentAt: string | null;
  createdAt: string;
}

export interface SendNotificationRequest {
  notificationType: string;
  title: string;
  message: string;
  channels: string[];
  audience: string;
  tenantCodes: string[];
  scheduledAt: string | null;
}

export interface UpsertNotificationTemplateRequest {
  templateCode: string;
  notificationType: string;
  channel: string;
  subject: string;
  body: string;
  isActive: boolean;
}
