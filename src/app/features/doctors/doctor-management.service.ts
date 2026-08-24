import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { DoctorApiResponse, DoctorForm, DoctorNextCode, DoctorProfile, DoctorRegistry, UpsertDoctorPayload } from './doctor-management.models';

@Injectable({ providedIn: 'root' })
export class DoctorManagementService {
  private readonly api = inject(ApiClientService);

  nextDoctorCode(): Promise<DoctorApiResponse<DoctorNextCode>> {
    return firstValueFrom(this.api.get<DoctorApiResponse<DoctorNextCode>>('/doctors/next-code'));
  }

  search(filters: DoctorSearchFilters): Promise<DoctorApiResponse<DoctorRegistry>> {
    const query = new URLSearchParams({
      pageNumber: String(filters.pageNumber),
      pageSize: String(filters.pageSize)
    });

    setQuery(query, 'searchText', filters.searchText);
    setQuery(query, 'departmentName', filters.departmentName);
    setQuery(query, 'specializationName', filters.specializationName);
    setQuery(query, 'branchName', filters.branchName);
    setQuery(query, 'employmentType', filters.employmentType);
    setQuery(query, 'statusCode', filters.statusCode);

    return firstValueFrom(this.api.get<DoctorApiResponse<DoctorRegistry>>(`/doctors?${query.toString()}`));
  }

  get(doctorGuid: string): Promise<DoctorApiResponse<DoctorProfile>> {
    return firstValueFrom(this.api.get<DoctorApiResponse<DoctorProfile>>(`/doctors/${doctorGuid}`));
  }

  create(doctor: DoctorForm): Promise<DoctorApiResponse<DoctorProfile>> {
    return firstValueFrom(this.api.post<DoctorApiResponse<DoctorProfile>>('/doctors', createPayload(doctor, false)));
  }

  update(doctor: DoctorForm): Promise<DoctorApiResponse<DoctorProfile>> {
    return firstValueFrom(this.api.put<DoctorApiResponse<DoctorProfile>>(`/doctors/${doctor.doctorGuid}`, createPayload(doctor, true)));
  }

  delete(doctorGuid: string): Promise<DoctorApiResponse<boolean>> {
    return firstValueFrom(this.api.delete<DoctorApiResponse<boolean>>(`/doctors/${doctorGuid}`));
  }

  createAvailability(request: DoctorAvailabilityRequest): Promise<DoctorAvailabilityRecord> {
    return firstValueFrom(this.api.post<DoctorAvailabilityRecord>('/doctor-availability', request));
  }

  createSchedule(request: DoctorScheduleRequest): Promise<DoctorScheduleRecord> {
    return firstValueFrom(this.api.post<DoctorScheduleRecord>('/doctor-schedules', request));
  }

  createLeave(request: DoctorLeaveRequest): Promise<DoctorLeaveRecord> {
    return firstValueFrom(this.api.post<DoctorLeaveRecord>('/doctor-leaves', request));
  }

  createDocument(request: DoctorDocumentRequest): Promise<DoctorDocumentRecord> {
    return firstValueFrom(this.api.post<DoctorDocumentRecord>('/doctor-documents', request));
  }
}

export interface DoctorSearchFilters {
  searchText: string;
  departmentName: string;
  specializationName: string;
  branchName: string;
  employmentType: string;
  statusCode: string;
  pageNumber: number;
  pageSize: number;
}

export interface DoctorAvailabilityRequest {
  doctorId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  branchName: string;
  consultationType: string;
  slotDurationMinutes: number;
  maxPatients: number;
  statusCode: string;
}

export interface DoctorAvailabilityRecord extends DoctorAvailabilityRequest { id: string; }

export interface DoctorScheduleRequest {
  doctorId: string;
  scheduleDate: string;
  startsAt: string | null;
  endsAt: string | null;
  scheduleType: string;
  consultationType: string;
  roomName: string | null;
  branchName: string;
  departmentName: string | null;
  statusCode: string;
}

export interface DoctorScheduleRecord extends DoctorScheduleRequest { id: string; }

export interface DoctorLeaveRequest {
  doctorId: string;
  leaveType: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  statusCode: string;
}

export interface DoctorLeaveRecord extends DoctorLeaveRequest { id: string; }

export interface DoctorDocumentRequest {
  doctorId: string;
  documentType: string;
  documentName: string;
  fileUrl: string;
  documentNo: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
}

export interface DoctorDocumentRecord extends DoctorDocumentRequest { id: string; }

function createPayload(doctor: DoctorForm, includeDoctorCode: boolean): UpsertDoctorPayload {
  return {
    doctorGuid: doctor.doctorGuid || null,
    doctorCode: includeDoctorCode ? normalize(doctor.doctorCode) : null,
    firstName: doctor.firstName.trim(),
    middleName: normalize(doctor.middleName),
    lastName: doctor.lastName.trim(),
    displayName: normalize(doctor.displayName),
    profilePhotoUrl: normalize(doctor.profilePhotoUrl),
    registrationNo: doctor.registrationNo.trim(),
    registrationCouncil: normalize(doctor.registrationCouncil),
    registrationIssueDate: doctor.registrationIssueDate || null,
    registrationExpiryDate: doctor.registrationExpiryDate || null,
    genderCode: doctor.genderCode || null,
    dateOfBirth: doctor.dateOfBirth || null,
    mobileNo: normalize(doctor.mobileNo),
    alternateMobileNo: normalize(doctor.alternateMobileNo),
    email: normalize(doctor.email),
    address: normalize(doctor.address),
    emergencyContactNo: normalize(doctor.emergencyContactNo),
    departmentName: doctor.departmentName.trim(),
    primarySpecialization: doctor.primarySpecialization.trim(),
    qualification: doctor.qualification.trim(),
    designation: normalize(doctor.designation),
    experienceYears: Number(doctor.experienceYears) || 0,
    employmentType: doctor.employmentType || 'FULL_TIME',
    branchName: doctor.branchName.trim() || 'Main Branch',
    joiningDate: doctor.joiningDate || null,
    consultationFee: Number(doctor.consultationFee) || 0,
    statusCode: doctor.statusCode || 'ACTIVE',
    bio: normalize(doctor.bio),
    rowVersion: doctor.rowVersion || null
  };
}

function setQuery(query: URLSearchParams, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) {
    query.set(key, trimmed);
  }
}

function normalize(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}
