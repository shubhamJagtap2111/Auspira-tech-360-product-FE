import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BranchContextService } from '../../core/context/branch-context.service';
import { ApiClientService } from '../../core/http/api-client.service';
import { PatientAllergy, PatientApiResponse, PatientDuplicateCheck, PatientForm, PatientNextMedicalRecordNo, PatientProfile, PatientRegistry, UpsertPatientPayload } from './patient-management.models';

@Injectable({ providedIn: 'root' })
export class PatientManagementService {
  private readonly api = inject(ApiClientService);
  private readonly branchContext = inject(BranchContextService);

  nextMedicalRecordNo(): Promise<PatientApiResponse<PatientNextMedicalRecordNo>> {
    return firstValueFrom(this.api.get<PatientApiResponse<PatientNextMedicalRecordNo>>('/patients/next-mrn'));
  }

  search(searchText = '', genderCode = '', statusCode = '', branchCode = '', registrationDate = '', pageNumber = 1, pageSize = 20): Promise<PatientApiResponse<PatientRegistry>> {
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

    if (registrationDate.trim()) {
      query.set('registrationDate', registrationDate.trim());
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
      email: patient.email.trim() || null,
      governmentId: patient.nationalId.trim() || null
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

  createAllergy(patientGuid: string, allergy: PatientAllergyForm): Promise<PatientApiResponse<PatientAllergyRecord>> {
    return firstValueFrom(this.api.post<PatientApiResponse<PatientAllergyRecord>>('/patient-allergies', {
      patientId: patientGuid,
      allergyName: allergy.allergen.trim(),
      allergyType: allergy.allergyType.trim() || 'General',
      reaction: allergy.reaction.trim() || null,
      severityCode: allergy.severityCode.trim().toUpperCase() || 'UNKNOWN',
      notes: allergy.notes.trim() || null,
      statusCode: allergy.statusCode || 'ACTIVE',
      isCritical: allergy.isCritical
    }));
  }

  updateAllergy(patientGuid: string, allergy: PatientAllergy, changes: Partial<PatientAllergyForm>): Promise<PatientApiResponse<PatientAllergyRecord>> {
    return firstValueFrom(this.api.put<PatientApiResponse<PatientAllergyRecord>>(`/patient-allergies/${allergy.allergyGuid}`, {
      id: allergy.allergyGuid,
      patientId: patientGuid,
      allergyName: changes.allergen ?? allergy.allergen,
      allergyType: changes.allergyType ?? allergy.allergyType,
      reaction: changes.reaction ?? allergy.reaction,
      severityCode: changes.severityCode ?? allergy.severityCode,
      notes: changes.notes ?? allergy.notes,
      statusCode: changes.statusCode ?? allergy.statusCode,
      isCritical: changes.isCritical ?? allergy.isCritical
    }));
  }
}

export interface PatientAllergyForm {
  allergen: string;
  allergyType: string;
  reaction: string;
  severityCode: string;
  notes: string;
  statusCode: string;
  isCritical: boolean;
}

export interface PatientAllergyRecord {
  id: string;
  patientId: string;
  allergyName: string;
  allergyType: string;
  reaction: string | null;
  severityCode: string;
  notes: string | null;
  statusCode: string;
  isCritical: boolean;
}

function createPayload(patient: PatientForm, includeMedicalRecordNo: boolean, branchCode: string | null): UpsertPatientPayload {
  return {
    patientGuid: patient.patientGuid || null,
    medicalRecordNo: includeMedicalRecordNo ? patient.medicalRecordNo.trim() || null : null,
    firstName: patient.firstName.trim(),
    middleName: patient.middleName.trim() || null,
    lastName: patient.lastName.trim(),
    mobileNo: `${patient.countryDialCode} ${patient.mobileNumber}`.trim(),
    email: patient.email.trim() || null,
    address: patient.address.trim() || null,
    city: patient.city.trim() || null,
    state: patient.state.trim() || null,
    country: patient.country.trim() || null,
    pincode: patient.pincode.trim() || null,
    emergencyContactName: patient.emergencyContactName.trim() || null,
    emergencyContactRelationship: patient.emergencyContactRelationship.trim() || null,
    emergencyContactMobile: patient.emergencyContactMobile.trim() || null,
    genderCode: patient.genderCode || null,
    dateOfBirth: patient.dateOfBirth || null,
    bloodGroupCode: patient.bloodGroupCode || null,
    knownAllergies: patient.knownAllergies.trim() || null,
    knownConditions: patient.knownConditions.trim() || null,
    chronicDiseases: patient.chronicDiseases.trim() || null,
    pastMedicalHistory: patient.pastMedicalHistory.trim() || null,
    familyHistory: patient.familyHistory.trim() || null,
    surgicalHistory: patient.surgicalHistory.trim() || null,
    medicalNotes: patient.medicalNotes.trim() || null,
    nationalId: patient.nationalId.trim() || null,
    insuranceProvider: patient.insuranceProvider.trim() || null,
    insuranceNumber: patient.insuranceNumber.trim() || null,
    branchCode: branchCode || null,
    statusCode: patient.statusCode || 'REGISTERED',
    rowVersion: patient.rowVersion || null
  };
}
