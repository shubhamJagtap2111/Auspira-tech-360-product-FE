import { ApiResponse } from '../../core/auth/auth.models';

export type SupportCenterApiResponse<T> = ApiResponse<T>;

export interface SupportCenterSnapshot {
  summary: SupportCenterSummary;
  hospitals: SupportHospitalOption[];
  tickets: SupportTicketItem[];
}

export interface SupportCenterSummary {
  totalTickets: number;
  openTickets: number;
  breachedSlaTickets: number;
  criticalTickets: number;
  resolvedTickets: number;
}

export interface SupportHospitalOption {
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  planCode: string;
  tenantStatus: string;
}

export interface SupportTicketItem {
  ticketId: string;
  ticketNo: string;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  issueType: string;
  title: string;
  description: string;
  priority: string;
  slaHours: number;
  status: string;
  assignedTo: string;
  openedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  resolution: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateSupportTicketRequest {
  tenantCode: string;
  issueType: string;
  title: string;
  description: string | null;
  priority: string;
  slaHours: number;
  assignedTo: string | null;
}

export interface UpdateSupportTicketStatusRequest {
  status: string;
  assignedTo?: string | null;
  resolution?: string | null;
}
