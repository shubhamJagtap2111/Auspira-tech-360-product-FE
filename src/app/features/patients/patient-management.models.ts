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

export type PatientProfile = PatientSummary;

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
  rowVersion: string | null;
}
