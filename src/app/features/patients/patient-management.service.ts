import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BranchContextService } from '../../core/context/branch-context.service';
import { ApiClientService } from '../../core/http/api-client.service';
import { PatientApiResponse, PatientDuplicateCheck, PatientForm, PatientNextMedicalRecordNo, PatientProfile, PatientRegistry, UpsertPatientPayload } from './patient-management.models';

@Injectable({ providedIn: 'root' })
export class PatientManagementService {
  private readonly api = inject(ApiClientService);
  private readonly branchContext = inject(BranchContextService);

  nextMedicalRecordNo(): Promise<PatientApiResponse<PatientNextMedicalRecordNo>> {
    return firstValueFrom(this.api.get<PatientApiResponse<PatientNextMedicalRecordNo>>('/patients/next-mrn'));
  }

  search(searchText = '', genderCode = '', statusCode = '', branchCode = '', pageNumber = 1, pageSize = 20): Promise<PatientApiResponse<PatientRegistry>> {
    const query = new URLSearchParams({
      pageNumber: String(pageNumber),
      pageSize: String(pageSize)
    });

    if (searchText.trim()) {
      query.set('searchText', searchText.trim());
    }

    if (genderCode) {
      query.set('genderCode', genderCode);
    }

    if (statusCode) {
      query.set('statusCode', statusCode);
    }

    if (branchCode.trim()) {
      query.set('branchCode', branchCode.trim());
    }

    return firstValueFrom(this.api.get<PatientApiResponse<PatientRegistry>>(`/patients?${query.toString()}`));
  }

  get(patientGuid: string): Promise<PatientApiResponse<PatientProfile>> {
    return firstValueFrom(this.api.get<PatientApiResponse<PatientProfile>>(`/patients/${patientGuid}`));
  }

  checkDuplicates(patient: PatientForm): Promise<PatientApiResponse<PatientDuplicateCheck>> {
    return firstValueFrom(this.api.post<PatientApiResponse<PatientDuplicateCheck>>('/patients/duplicates/check', {
      firstName: patient.firstName.trim(),
      lastName: patient.lastName.trim(),
      mobileNo: `${patient.countryDialCode} ${patient.mobileNumber}`.trim(),
      dateOfBirth: patient.dateOfBirth || null,
      email: null,
      governmentId: null
    }));
  }

  create(patient: PatientForm): Promise<PatientApiResponse<PatientProfile>> {
    return firstValueFrom(this.api.post<PatientApiResponse<PatientProfile>>('/patients', createPayload(patient, false, this.branchContext.selectedBranchCode())));
  }

  update(patient: PatientForm): Promise<PatientApiResponse<PatientProfile>> {
    return firstValueFrom(this.api.put<PatientApiResponse<PatientProfile>>(`/patients/${patient.patientGuid}`, createPayload(patient, true, this.branchContext.selectedBranchCode())));
  }

  delete(patientGuid: string): Promise<PatientApiResponse<boolean>> {
    return firstValueFrom(this.api.delete<PatientApiResponse<boolean>>(`/patients/${patientGuid}`));
  }
}

function createPayload(patient: PatientForm, includeMedicalRecordNo: boolean, branchCode: string | null): UpsertPatientPayload {
  return {
    patientGuid: patient.patientGuid || null,
    medicalRecordNo: includeMedicalRecordNo ? patient.medicalRecordNo.trim() || null : null,
    firstName: patient.firstName.trim(),
    lastName: patient.lastName.trim(),
    mobileNo: `${patient.countryDialCode} ${patient.mobileNumber}`.trim(),
    genderCode: patient.genderCode || null,
    dateOfBirth: patient.dateOfBirth || null,
    bloodGroupCode: patient.bloodGroupCode || null,
    branchCode: branchCode || null,
    rowVersion: patient.rowVersion || null
  };
}
