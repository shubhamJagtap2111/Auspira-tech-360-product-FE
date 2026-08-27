import { ApiResponse } from '../../core/auth/auth.models';

export type IpdApiResponse<T> = ApiResponse<T>;

export interface IpdDashboard {
  summary: IpdDashboardSummary;
  wards: IpdWardOccupancy[];
  recentAdmissions: IpdAdmissionListItem[];
  activePatients: IpdAdmissionListItem[];
  beds: IpdBedStatus[];
  attentionItems: IpdAttentionItem[];
  patients: IpdOption[];
  doctors: IpdOption[];
  generatedAt: string;
}

export interface IpdDashboardSummary {
  currentAdmissions: number;
  availableBeds: number;
  occupiedBeds: number;
  totalBeds: number;
  occupancyPercent: number;
  admissionsToday: number;
  dischargesToday: number;
}

export interface IpdWardOccupancy {
  wardId: string;
  wardName: string;
  wardCode: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  occupancyPercent: number;
}

export interface IpdAdmissionListItem {
  admissionId: string;
  patientId: string;
  patientName: string;
  medicalRecordNo: string;
  doctorId: string;
  doctorName: string;
  wardName: string;
  bedNo: string;
  admittedAt: string;
  statusCode: string;
  stayDays: number;
}

export interface IpdBedStatus {
  bedId: string;
  wardId: string;
  wardName: string;
  bedNo: string;
  statusCode: string;
  currentPatientName: string;
  admissionId: string | null;
}

export interface IpdAttentionItem {
  key: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info' | 'success' | string;
  icon: string;
}

export interface IpdOption {
  value: string;
  label: string;
  meta: string;
}

export interface CreateIpdAdmissionRequest {
  patientId: string;
  doctorId: string;
  bedId: string | null;
  source: string;
  priority: string;
  reason: string;
  admittedAt: string | null;
}

export interface IpdAdmissionWorkflow {
  admissionId: string;
  statusCode: string;
  allocation: IpdBedAllocation | null;
  createdAt: string;
}

export interface IpdBedAllocation {
  allocationId: string;
  admissionId: string;
  bedId: string;
  wardName: string;
  bedNo: string;
  statusCode: string;
  allocatedAt: string;
}

export interface IpdCareNote {
  id: string;
  admissionId: string;
  note: string;
  createdAt: string;
}

export interface IpdDischarge {
  dischargeId: string;
  admissionId: string;
  statusCode: string;
  summary: string;
  dischargedAt: string;
}
