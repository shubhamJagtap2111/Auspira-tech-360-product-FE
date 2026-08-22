import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { PatientApiResponse, PatientForm, PatientNextMedicalRecordNo, PatientProfile, PatientRegistry, UpsertPatientPayload } from './patient-management.models';

@Injectable({ providedIn: 'root' })
export class PatientManagementService {
  private readonly api = inject(ApiClientService);

  nextMedicalRecordNo(): Promise<PatientApiResponse<PatientNextMedicalRecordNo>> {
    return firstValueFrom(this.api.get<PatientApiResponse<PatientNextMedicalRecordNo>>('/patients/next-mrn'));
  }

  search(searchText = '', genderCode = '', statusCode = '', pageNumber = 1, pageSize = 20): Promise<PatientApiResponse<PatientRegistry>> {
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

    return firstValueFrom(this.api.get<PatientApiResponse<PatientRegistry>>(`/patients?${query.toString()}`));
  }

  get(patientGuid: string): Promise<PatientApiResponse<PatientProfile>> {
    return firstValueFrom(this.api.get<PatientApiResponse<PatientProfile>>(`/patients/${patientGuid}`));
  }

  create(patient: PatientForm): Promise<PatientApiResponse<PatientProfile>> {
    return firstValueFrom(this.api.post<PatientApiResponse<PatientProfile>>('/patients', createPayload(patient, false)));
  }

  update(patient: PatientForm): Promise<PatientApiResponse<PatientProfile>> {
    return firstValueFrom(this.api.put<PatientApiResponse<PatientProfile>>(`/patients/${patient.patientGuid}`, createPayload(patient, true)));
  }

  delete(patientGuid: string): Promise<PatientApiResponse<boolean>> {
    return firstValueFrom(this.api.delete<PatientApiResponse<boolean>>(`/patients/${patientGuid}`));
  }
}

function createPayload(patient: PatientForm, includeMedicalRecordNo: boolean): UpsertPatientPayload {
  return {
    patientGuid: patient.patientGuid || null,
    medicalRecordNo: includeMedicalRecordNo ? patient.medicalRecordNo.trim() || null : null,
    firstName: patient.firstName.trim(),
    lastName: patient.lastName.trim(),
    mobileNo: `${patient.countryDialCode} ${patient.mobileNumber}`.trim(),
    genderCode: patient.genderCode || null,
    dateOfBirth: patient.dateOfBirth || null,
    bloodGroupCode: patient.bloodGroupCode || null,
    rowVersion: patient.rowVersion || null
  };
}
