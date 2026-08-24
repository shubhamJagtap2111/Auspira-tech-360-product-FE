import { ApiResponse } from '../../core/auth/auth.models';
import { DoctorSummary } from '../doctors/doctor-management.models';
import { PatientSummary } from '../patients/patient-management.models';

export type AppointmentApiResponse<T> = ApiResponse<T>;
export type AppointmentStatusCode = 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentTypeCode = 'NEW_CONSULTATION' | 'FOLLOW_UP' | 'WALK_IN' | 'REFERRAL';
export type AppointmentPriorityCode = 'NORMAL' | 'URGENT' | 'EMERGENCY' | 'VIP';
export type AppointmentViewMode = 'calendar' | 'list';

export interface AppointmentRecord {
  id: string;
  appointmentNo: string;
  patientId: string;
  doctorId: string;
  startsAt: string;
  appointmentType: AppointmentTypeCode | string;
  branchName: string;
  departmentName: string | null;
  statusCode: AppointmentStatusCode | string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AppointmentForm {
  appointmentId: string;
  appointmentNo: string;
  patientId: string;
  branchName: string;
  departmentName: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: AppointmentTypeCode;
  statusCode: AppointmentStatusCode;
  reason: string;
  notes: string;
}

export interface AppointmentQueueRecord {
  id: string;
  appointmentId: string;
  queueNo: number;
  tokenNumber: string;
  arrivedAt: string;
  priorityCode: AppointmentPriorityCode | string;
  statusCode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AppointmentCheckInForm {
  queueId: string;
  appointmentId: string;
  arrivalDate: string;
  arrivalTime: string;
  tokenNumber: string;
  queueNo: number;
  priorityCode: AppointmentPriorityCode;
  notes: string;
}

export interface AppointmentVm extends AppointmentRecord {
  patient: PatientSummary | null;
  doctor: DoctorSummary | null;
  queue: AppointmentQueueRecord | null;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  doctorDepartment: string;
  doctorSpecialization: string;
  displayAppointmentNo: string;
  displayAppointmentType: string;
  displayTokenNumber: string;
  displayPriority: string;
}

export interface AppointmentStats {
  total: number;
  booked: number;
  checkedIn: number;
  completed: number;
  cancelled: number;
  today: number;
}

export const appointmentStatusOptions: Array<{ label: string; value: AppointmentStatusCode | '' }> = [
  { label: 'All Statuses', value: '' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Checked In', value: 'CHECKED_IN' },
  { label: 'Waiting', value: 'WAITING' },
  { label: 'In Consultation', value: 'IN_CONSULTATION' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'No Show', value: 'NO_SHOW' }
];

export const editableAppointmentStatusOptions = appointmentStatusOptions.filter(
  option => option.value
) as Array<{ label: string; value: AppointmentStatusCode }>;

export const appointmentTypeOptions: Array<{ label: string; value: AppointmentTypeCode }> = [
  { label: 'New Consultation', value: 'NEW_CONSULTATION' },
  { label: 'Follow-up', value: 'FOLLOW_UP' },
  { label: 'Walk-in', value: 'WALK_IN' },
  { label: 'Referral', value: 'REFERRAL' }
];

export const appointmentPriorityOptions: Array<{ label: string; value: AppointmentPriorityCode }> = [
  { label: 'Normal', value: 'NORMAL' },
  { label: 'Urgent', value: 'URGENT' },
  { label: 'Emergency', value: 'EMERGENCY' },
  { label: 'VIP', value: 'VIP' }
];
