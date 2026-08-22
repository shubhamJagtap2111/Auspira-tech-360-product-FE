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
