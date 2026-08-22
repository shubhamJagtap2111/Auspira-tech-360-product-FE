import { ApiResponse } from '../../core/auth/auth.models';

export type PatientApiResponse<T> = ApiResponse<T>;

export interface PatientRegistry {
  patients: PatientSummary[];
  stats: PatientRegistryStats;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface PatientRegistryStats {
  totalPatients: number;
  checkedInToday: number;
  newThisMonth: number;
  pendingReview: number;
}

export interface PatientSummary {
  patientGuid: string;
  medicalRecordNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobileNo: string;
  genderCode: string | null;
  genderName: string;
  dateOfBirth: string | null;
  age: number | null;
  bloodGroupCode: string | null;
  bloodGroupName: string;
  lastVisitDate: string | null;
  statusCode: string;
  statusName: string;
  createdDate: string;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface PatientProfile extends PatientSummary {
  overview: PatientProfileOverview;
  contacts: PatientContact[];
  allergies: PatientAllergy[];
  insurance: PatientInsurance[];
  documents: PatientDocument[];
  appointments: PatientConnectedRecord[];
  visits: PatientConnectedRecord[];
  labOrders: PatientConnectedRecord[];
  pharmacySales: PatientConnectedRecord[];
  billingSummary: PatientBillingSummary;
  timeline: PatientTimelineEvent[];
}

export interface PatientProfileOverview {
  totalAppointments: number;
  upcomingAppointments: number;
  totalVisits: number;
  activeAdmissions: number;
  activeAllergies: number;
  insurancePolicies: number;
  documents: number;
  outstandingBalance: number;
}

export interface PatientContact {
  contactGuid: string;
  fullName: string;
  relationship: string;
  mobileNo: string;
  email: string | null;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  isGuardian: boolean;
}

export interface PatientAllergy {
  allergyGuid: string;
  allergyType: string;
  allergen: string;
  reaction: string | null;
  severityCode: string;
  severityName: string;
  statusCode: string;
  recordedOn: string | null;
  notes: string | null;
}

export interface PatientInsurance {
  insuranceGuid: string;
  providerName: string;
  policyNo: string;
  memberId: string | null;
  statusCode: string;
  coverageEndDate: string | null;
  isPrimary: boolean;
}

export interface PatientDocument {
  documentGuid: string;
  documentType: string;
  documentName: string;
  fileUrl: string;
  uploadedDate: string;
  verificationStatus: string;
}

export interface PatientConnectedRecord {
  recordGuid: string;
  recordType: string;
  title: string;
  subtitle: string | null;
  statusCode: string;
  eventDate: string;
  sourceModule: string;
}

export interface PatientBillingSummary {
  outstandingBalance: number;
  paidAmount: number;
  lastPaymentAmount: number;
  lastPaymentDate: string | null;
  insurancePendingAmount: number;
}

export interface PatientTimelineEvent {
  eventGuid: string;
  eventType: string;
  description: string;
  sourceModule: string;
  eventDate: string;
  actor: string | null;
}

export interface PatientForm {
  patientGuid: string;
  medicalRecordNo: string;
  firstName: string;
  lastName: string;
  countryIsoCode: string;
  countryDialCode: string;
  mobileNumber: string;
  genderCode: string | null;
  dateOfBirth: string | null;
  bloodGroupCode: string | null;
  rowVersion: string | null;
}

export interface PatientNextMedicalRecordNo {
  medicalRecordNo: string;
}

export interface UpsertPatientPayload {
  patientGuid: string | null;
  medicalRecordNo: string | null;
  firstName: string;
  lastName: string;
  mobileNo: string;
  genderCode: string | null;
  dateOfBirth: string | null;
  bloodGroupCode: string | null;
  branchCode: string | null;
  rowVersion: string | null;
}

export interface PatientDuplicateCheckRequest {
  firstName: string;
  lastName: string;
  mobileNo: string;
  dateOfBirth: string | null;
  email: string | null;
  governmentId: string | null;
}

export interface PatientDuplicateCheck {
  matches: PatientDuplicate[];
}

export interface PatientDuplicate {
  patientGuid: string;
  medicalRecordNo: string;
  fullName: string;
  dateOfBirth: string | null;
  maskedMobileNo: string;
  matchReason: string;
}
