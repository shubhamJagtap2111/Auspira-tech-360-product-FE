import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { isAsNeededPrescription, parsePrescriptionDuration, parsePrescriptionQuantity } from './prescription-validation';
import { AppointmentQueueRecord } from '../appointments/appointment-management.models';
import {
  OpdAdmissionRecord,
  OpdLabResultSummary,
  OpdApiResponse,
  OpdConsultationRecord,
  OpdDiagnosisForm,
  OpdDiagnosisRecord,
  OpdDrugAllergyAlert,
  OpdDrugInteractionAlert,
  OpdEncounterForm,
  OpdFollowUpRecord,
  OpdBillableChargeRecord,
  OpdInvoiceRecord,
  OpdLabOrderForm,
  OpdLabOrderItemRecord,
  OpdLabOrderRecord,
  OpdLabTestRecord,
  OpdMedicineRecord,
  OpdPrescriptionItemForm,
  OpdPrescriptionItemRecord,
  OpdPrescriptionRecord,
  OpdSymptomRecord
} from './opd-management.models';

@Injectable({ providedIn: 'root' })
export class OpdManagementService {
  private readonly api = inject(ApiClientService);

  getConfiguration(): Promise<OpdApiResponse<{ pharmacyIntegrationEnabled: boolean }>> {
    return firstValueFrom(this.api.get<OpdApiResponse<{ pharmacyIntegrationEnabled: boolean }>>('/opd/configuration'));
  }

  patientLabResults(patientId: string): Promise<OpdApiResponse<OpdLabResultSummary[]>> {
    return firstValueFrom(this.api.get<OpdApiResponse<OpdLabResultSummary[]>>(`/opd/consultations/patient/${patientId}/lab-results`));
  }

  patientHistory(patientId: string): Promise<OpdApiResponse<OpdConsultationRecord[]>> {
    return firstValueFrom(this.api.get<OpdApiResponse<OpdConsultationRecord[]>>(`/opd/consultations/patient/${patientId}/history`));
  }

  listConsultations(pageNumber = 1, pageSize = 100): Promise<OpdApiResponse<OpdConsultationRecord[]>> {
    return firstValueFrom(this.api.get<OpdApiResponse<OpdConsultationRecord[]>>(`/opd/consultations?pageNumber=${pageNumber}&pageSize=${pageSize}`));
  }

  listFollowUps(pageNumber = 1, pageSize = 100): Promise<OpdApiResponse<OpdFollowUpRecord[]>> {
    return firstValueFrom(this.api.get<OpdApiResponse<OpdFollowUpRecord[]>>(`/follow-ups?pageNumber=${pageNumber}&pageSize=${pageSize}`));
  }

  listLabTests(pageNumber = 1, pageSize = 100): Promise<OpdApiResponse<OpdLabTestRecord[]>> {
    return firstValueFrom(this.api.get<OpdApiResponse<OpdLabTestRecord[]>>(`/laboratory/tests?pageNumber=${pageNumber}&pageSize=${pageSize}`));
  }

  listMedicines(pageNumber = 1, pageSize = 100): Promise<OpdApiResponse<OpdMedicineRecord[]>> {
    return firstValueFrom(this.api.get<OpdApiResponse<OpdMedicineRecord[]>>(`/pharmacy/prescribing-catalog?pageNumber=${pageNumber}&pageSize=${pageSize}`));
  }

  checkDrugInteractions(medicineIds: string[]): Promise<OpdApiResponse<OpdDrugInteractionAlert[]>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdDrugInteractionAlert[]>>('/pharmacy/interactions/check', { medicineIds }));
  }

  recordDrugInteractionOverride(body: { interactionId: string; medicineAId: string; medicineBId: string; patientId: string; consultationId: string | null; prescriptionId: string | null; overrideReason: string }): Promise<OpdApiResponse<{ id: string }>> {
    return firstValueFrom(this.api.post<OpdApiResponse<{ id: string }>>('/pharmacy/interactions/overrides', body));
  }

  checkDrugAllergies(patientId: string, medicineIds: string[]): Promise<OpdApiResponse<OpdDrugAllergyAlert[]>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdDrugAllergyAlert[]>>('/pharmacy/allergies/check', { patientId, medicineIds }));
  }

  recordDrugAllergyOverride(body: { mappingId: string; patientAllergyId: string; patientId: string; medicineId: string; consultationId: string | null; prescriptionId: string | null; overrideReason: string }): Promise<OpdApiResponse<{ id: string }>> {
    return firstValueFrom(this.api.post<OpdApiResponse<{ id: string }>>('/pharmacy/allergies/overrides', body));
  }

  createConsultation(form: OpdEncounterForm): Promise<OpdApiResponse<OpdConsultationRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdConsultationRecord>>('/opd/consultations', createConsultationPayload(form)));
  }

  updateConsultation(form: OpdEncounterForm): Promise<OpdApiResponse<OpdConsultationRecord>> {
    return firstValueFrom(this.api.put<OpdApiResponse<OpdConsultationRecord>>(`/opd/consultations/${form.consultationId}/workflow`, {
      consultation: createConsultationPayload(form), expectedUpdatedAt: form.expectedUpdatedAt ?? null
    }));
  }

  saveConsultationDraft(id: string, clinicalData: string, notes: string, expectedUpdatedAt: string | null): Promise<OpdApiResponse<OpdConsultationRecord>> {
    return firstValueFrom(this.api.put<OpdApiResponse<OpdConsultationRecord>>(`/opd/consultations/${id}/draft`, {
      clinicalData, notes, expectedUpdatedAt
    }));
  }

  getConsultation(id: string): Promise<OpdApiResponse<OpdConsultationRecord>> {
    return firstValueFrom(this.api.get<OpdApiResponse<OpdConsultationRecord>>(`/opd/consultations/${id}`));
  }

  saveConsultationFollowUp(id: string, followUpDate: string, notes: string): Promise<OpdApiResponse<OpdFollowUpRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdFollowUpRecord>>(`/opd/consultations/${id}/follow-up`, { followUpDate, notes }));
  }

  createSymptom(consultationId: string, symptom: string): Promise<OpdApiResponse<OpdSymptomRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdSymptomRecord>>('/opd/symptoms', { consultationId, symptom }));
  }

  createDiagnosis(consultationId: string, diagnosis: OpdDiagnosisForm): Promise<OpdApiResponse<OpdDiagnosisRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdDiagnosisRecord>>('/opd/diagnoses', {
      consultationId,
      diagnosisText: formatDiagnosisText(diagnosis)
    }));
  }

  createPrescription(consultationId: string, patientId: string, doctorId: string, prescriptionNo: string, diagnosisSummary: string, instructions: string): Promise<OpdApiResponse<OpdPrescriptionRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdPrescriptionRecord>>('/opd/prescriptions', {
      consultationId,
      patientId,
      doctorId,
      encounterId: consultationId,
      encounterType: 'OPD',
      sourceModule: 'OPD',
      diagnosisSummary: diagnosisSummary.trim() || null,
      prescriptionNo,
      statusCode: 'DRAFT',
      instructions: instructions.trim()
    }));
  }

  createPrescriptionItem(prescriptionId: string, item: OpdPrescriptionItemForm): Promise<OpdApiResponse<OpdPrescriptionItemRecord>> {
    const payload = {
      prescriptionId,
      medicineId: item.medicineId || null,
      medicineName: item.medicine.trim(),
      dosage: item.dosage.trim(),
      frequency: item.frequency.trim(),
      days: parsePrescriptionDuration(item.duration) ?? 0,
      strength: item.strength.trim() || null,
      dosageForm: item.dosageForm.trim() || null,
      dose: item.dosage.trim(),
      route: item.route.trim(),
      durationValue: parsePrescriptionDuration(item.duration),
      durationUnit: 'DAY',
      quantity: parsePrescriptionQuantity(item.quantity),
      quantityUnit: item.dosageForm.trim() || 'Unit',
      instructions: item.instructions.trim() || null,
      isPrn: isAsNeededPrescription(item),
      prnReason: item.prnReason?.trim() || null
    };
    return firstValueFrom(item.id
      ? this.api.put<OpdApiResponse<OpdPrescriptionItemRecord>>(`/opd/prescription-items/${item.id}`, payload)
      : this.api.post<OpdApiResponse<OpdPrescriptionItemRecord>>('/opd/prescription-items', payload));
  }

  deletePrescriptionItem(id: string): Promise<OpdApiResponse<unknown>> {
    return firstValueFrom(this.api.delete<OpdApiResponse<unknown>>(`/opd/prescription-items/${id}`));
  }

  sendPrescriptionToPharmacy(prescriptionId: string): Promise<OpdApiResponse<{ id: string; prescriptionNumber: string; statusCode: string; sentToPharmacyAt: string }>> {
    return firstValueFrom(this.api.post<OpdApiResponse<{ id: string; prescriptionNumber: string; statusCode: string; sentToPharmacyAt: string }>>(`/prescriptions/${prescriptionId}/send-to-pharmacy`, {}));
  }

  createLabOrder(patientId: string, consultationId: string, tests: OpdLabTestRecord[], priority: string, clinicalNotes: string, doctorId: string, idempotencyKey: string = crypto.randomUUID()): Promise<OpdApiResponse<OpdLabOrderRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdLabOrderRecord>>('/laboratory/orders', {
      patientId,
      consultationId,
      encounterId: consultationId,
      encounterType: 'OPD',
      doctorId,
      sourceModule: 'OPD',
      priority,
      clinicalNotes,
      testIds: tests.map(test => test.id),
      packageIds: [],
      idempotencyKey
    }));
  }

  createLabOrderItem(labOrderId: string, test: OpdLabTestRecord): Promise<OpdApiResponse<OpdLabOrderItemRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdLabOrderItemRecord>>('/laboratory/order-items', {
      labOrderId,
      labTestId: test.id,
      price: test.price
    }));
  }

  createFollowUp(patientId: string, appointmentId: string | null, followUpDate: string, notes: string): Promise<OpdApiResponse<OpdFollowUpRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdFollowUpRecord>>('/follow-ups', {
      patientId,
      appointmentId,
      followUpDate,
      notes: notes.trim()
    }));
  }

  createAdmission(patientId: string, doctorId: string): Promise<OpdApiResponse<OpdAdmissionRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdAdmissionRecord>>('/ipd/admissions', {
      patientId,
      doctorId,
      admittedAt: new Date().toISOString(),
      statusCode: 'ADMITTED'
    }));
  }

  createBillableCharge(patientId: string, encounterId: string, sourceId: string, serviceCode: string, description: string, department: string, category: string, quantity: number, unitPrice: number): Promise<OpdApiResponse<OpdBillableChargeRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdBillableChargeRecord>>('/billing/charges', {
      patientId,
      encounterId,
      chargeMasterId: null,
      sourceModule: 'OPD',
      sourceEntity: 'OPD_VISIT',
      sourceId,
      serviceCode,
      description,
      department,
      category,
      unit: 'Each',
      quantity,
      unitPrice,
      discountAmount: 0,
      taxPercent: 0,
      chargeDate: null
    }));
  }

  createInvoiceFromCharges(patientId: string, encounterId: string, chargeIds: string[]): Promise<OpdApiResponse<OpdInvoiceRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdInvoiceRecord>>('/billing/invoices', {
      patientId,
      encounterId,
      invoiceType: 'OPD',
      chargeIds,
      dueDate: null
    }));
  }

  updateQueueStatus(queue: AppointmentQueueRecord, statusCode: string): Promise<OpdApiResponse<AppointmentQueueRecord>> {
    return firstValueFrom(this.api.put<OpdApiResponse<AppointmentQueueRecord>>(`/queue/${queue.id}`, {
      id: queue.id,
      appointmentId: queue.appointmentId,
      queueNo: queue.queueNo,
      tokenNumber: queue.tokenNumber,
      arrivedAt: queue.arrivedAt,
      priorityCode: queue.priorityCode,
      statusCode,
      notes: queue.notes
    }));
  }
}

function createConsultationPayload(form: OpdEncounterForm) {
  return {
    id: form.consultationId || undefined,
    patientId: form.patientId,
    doctorId: form.doctorId,
    appointmentId: form.appointmentId,
    notes: form.notes.trim(),
    clinicalData: form.clinicalData || "{}",
    statusCode: form.statusCode
  };
}

function formatDiagnosisText(diagnosis: OpdDiagnosisForm): string {
  return [
    diagnosis.diagnosisType,
    diagnosis.diagnosisCode.trim(),
    diagnosis.diagnosisName.trim(),
    diagnosis.notes.trim()
  ].filter(Boolean).join(' | ');
}
