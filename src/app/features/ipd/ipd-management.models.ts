import { ApiResponse } from '../../core/auth/auth.models';

export type IpdApiResponse<T> = ApiResponse<T>;

export interface IpdDashboard {
  summary: IpdDashboardSummary;
  wards: IpdWardOccupancy[];
  rooms: IpdRoom[];
  admissions: IpdAdmissionListItem[];
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
  wardType: string;
  department: string;
  floor: string;
  capacity: number;
  statusCode: string;
  description: string;
  branchName: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  occupancyPercent: number;
}

export interface IpdRoom {
  roomId: string;
  wardId: string;
  wardName: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  capacity: number;
  statusCode: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
}

export interface IpdAdmissionListItem {
  admissionId: string;
  admissionNo: string;
  patientId: string;
  patientName: string;
  medicalRecordNo: string;
  doctorId: string | null;
  doctorName: string;
  departmentName: string;
  wardName: string;
  roomNumber: string;
  bedNo: string;
  admittedAt: string;
  statusCode: string;
  admissionSource: string;
  admissionType: string;
  admissionReason: string;
  primaryDiagnosis: string;
  knownAllergies: string;
  bloodGroup: string;
  priorityCode: string;
  stayDays: number;
  outstanding: number;
  activeOrders: number;
}

export interface IpdBedStatus {
  bedId: string;
  wardId: string;
  roomId: string | null;
  wardName: string;
  roomNumber: string;
  bedNo: string;
  bedType: string;
  statusCode: string;
  dailyCharge: number;
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
  age?: number | null;
  gender?: string;
  mobileNo?: string;
  bloodGroup?: string;
}

export interface CreateIpdAdmissionRequest {
  admissionId?: string | null;
  patientId: string;
  doctorId: string | null;
  bedId: string | null;
  admissionNo?: string;
  source: string;
  admissionSource?: string;
  admissionType?: string;
  priority: string;
  priorityCode?: string;
  reason: string;
  admissionReason?: string;
  admittedAt: string | null;
  admissionDate?: string | null;
  referredFrom?: string;
  previousEncounter?: string;
  departmentName?: string;
  consultantDoctorIds?: string[];
  primaryDiagnosis?: string;
  secondaryDiagnosis?: string;
  admissionNotes?: string;
  presentingComplaint?: string;
  knownAllergies?: string;
  bloodGroup?: string;
  medicalHistory?: string;
  currentMedication?: string;
  infectionRisk?: string;
  progressStep?: number;
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

export interface IpdVitalRecord {
  vitalId: string;
  admissionId: string;
  recordedAt: string;
  temperature: number | null;
  pulseRate: number | null;
  respiratoryRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  spo2: number | null;
  height: number | null;
  weight: number | null;
  painScore: number | null;
  bloodGlucose: number | null;
  notes: string;
  recordedBy: string;
  createdAt: string;
}

export interface SaveIpdVitalRequest {
  vitalId?: string | null;
  recordedAt: string | null;
  temperature: number | null;
  pulseRate: number | null;
  respiratoryRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  spo2: number | null;
  height: number | null;
  weight: number | null;
  painScore: number | null;
  bloodGlucose: number | null;
  notes: string;
  recordedBy: string;
}

export interface IpdDischarge {
  dischargeId: string;
  admissionId: string;
  statusCode: string;
  summary: string;
  dischargedAt: string;
}

export interface SaveIpdWardRequest {
  wardId?: string | null;
  wardName: string;
  wardCode: string;
  wardType: string;
  department: string;
  floor: string;
  capacity: number;
  statusCode: string;
  description: string;
  branchName: string;
}

export interface SaveIpdRoomRequest {
  roomId?: string | null;
  wardId: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  capacity: number;
  statusCode: string;
}

export interface SaveIpdBedRequest {
  bedId?: string | null;
  wardId: string;
  roomId: string;
  bedNumber: string;
  bedType: string;
  statusCode: string;
  dailyCharge: number;
}
