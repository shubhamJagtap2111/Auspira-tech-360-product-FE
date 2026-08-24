import { ApiResponse } from '../../core/auth/auth.models';

export type DoctorApiResponse<T> = ApiResponse<T>;

export interface DoctorRegistry {
  doctors: DoctorSummary[];
  stats: DoctorRegistryStats;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface DoctorRegistryStats {
  totalDoctors: number;
  activeDoctors: number;
  onLeaveDoctors: number;
  expiringRegistrations: number;
}

export interface DoctorSummary {
  doctorGuid: string;
  doctorCode: string;
  fullName: string;
  registrationNo: string;
  mobileNo: string | null;
  email: string | null;
  departmentName: string;
  primarySpecialization: string;
  qualification: string;
  employmentType: string;
  branchName: string;
  consultationFee: number;
  statusCode: string;
  statusName: string;
  createdDate: string;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface DoctorProfile extends DoctorSummary {
  firstName: string;
  middleName: string | null;
  lastName: string;
  profilePhotoUrl: string | null;
  registrationCouncil: string | null;
  registrationIssueDate: string | null;
  registrationExpiryDate: string | null;
  genderCode: string | null;
  dateOfBirth: string | null;
  alternateMobileNo: string | null;
  address: string | null;
  emergencyContactNo: string | null;
  designation: string | null;
  experienceYears: number;
  joiningDate: string | null;
  bio: string | null;
  overview: DoctorProfileOverview;
  departments: DoctorDepartment[];
  specializations: DoctorSpecialization[];
  availability: DoctorAvailability[];
  schedules: DoctorSchedule[];
  appointmentSlots: DoctorSlot[];
  leaves: DoctorLeave[];
  fees: DoctorFee[];
  registrations: DoctorRegistration[];
  documents: DoctorDocument[];
  appointments: DoctorWorkflowPatient[];
  opdPatients: DoctorWorkflowPatient[];
  ipdPatients: DoctorWorkflowPatient[];
  performance: DoctorPerformance;
  activity: DoctorActivity[];
}

export interface DoctorProfileOverview {
  totalAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
  activePatients: number;
  activeSchedules: number;
  availableSlots: number;
  bookedSlots: number;
  revenue: number;
}

export interface DoctorDepartment {
  mappingGuid: string;
  departmentName: string;
  branchName: string;
  isPrimary: boolean;
  statusCode: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface DoctorSpecialization {
  specializationGuid: string;
  specializationName: string;
  isPrimary: boolean;
  experienceYears: number;
  statusCode: string;
}

export interface DoctorAvailability {
  availabilityGuid: string;
  dayOfWeek: number;
  dayName: string;
  startsAt: string;
  endsAt: string;
  branchName: string;
  consultationType: string;
  slotDurationMinutes: number;
  maxPatients: number;
  statusCode: string;
}

export interface DoctorSchedule {
  scheduleGuid: string;
  scheduleDate: string;
  startsAt: string | null;
  endsAt: string | null;
  scheduleType: string;
  consultationType: string;
  roomName: string;
  statusCode: string;
}

export interface DoctorSlot {
  slotGuid: string;
  startsAt: string;
  endsAt: string;
  statusCode: string;
  isBooked: boolean;
  maxPatients: number;
}

export interface DoctorLeave {
  leaveGuid: string;
  leaveType: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  statusCode: string;
}

export interface DoctorFee {
  feeGuid: string;
  consultationType: string;
  branchName: string;
  departmentName: string;
  patientCategory: string;
  amount: number;
  currencyCode: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  statusCode: string;
}

export interface DoctorRegistration {
  registrationGuid: string;
  registrationNo: string;
  registrationCouncil: string;
  registrationType: string;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
  statusCode: string;
}

export interface DoctorDocument {
  documentGuid: string;
  documentType: string;
  documentName: string;
  fileUrl: string;
  documentNo: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
  uploadedDate: string;
}

export interface DoctorWorkflowPatient {
  recordGuid: string;
  patientGuid: string;
  medicalRecordNo: string;
  patientName: string;
  mobileNo: string | null;
  statusCode: string;
  eventDate: string;
  sourceModule: string;
  notes: string | null;
}

export interface DoctorPerformance {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalConsultations: number;
  admissions: number;
  revenue: number;
  slotUtilization: number;
}

export interface DoctorActivity {
  activityGuid: string;
  eventType: string;
  description: string;
  sourceModule: string;
  eventDate: string;
  actor: string | null;
}

export interface DoctorForm {
  doctorGuid: string;
  doctorCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  displayName: string | null;
  profilePhotoUrl: string | null;
  registrationNo: string;
  registrationCouncil: string | null;
  registrationIssueDate: string | null;
  registrationExpiryDate: string | null;
  genderCode: string | null;
  dateOfBirth: string | null;
  mobileNo: string | null;
  alternateMobileNo: string | null;
  email: string | null;
  address: string | null;
  emergencyContactNo: string | null;
  departmentName: string;
  primarySpecialization: string;
  qualification: string;
  designation: string | null;
  experienceYears: number;
  employmentType: string;
  branchName: string;
  joiningDate: string | null;
  consultationFee: number;
  statusCode: string | null;
  bio: string | null;
  certificateDocumentUrl: string | null;
  registrationDocumentUrl: string | null;
  qualificationDocumentUrl: string | null;
  rowVersion: string | null;
}

export interface DoctorNextCode {
  doctorCode: string;
}

export type UpsertDoctorPayload = Omit<DoctorForm, 'doctorGuid' | 'doctorCode' | 'certificateDocumentUrl' | 'registrationDocumentUrl' | 'qualificationDocumentUrl'> & {
  doctorGuid: string | null;
  doctorCode: string | null;
};
