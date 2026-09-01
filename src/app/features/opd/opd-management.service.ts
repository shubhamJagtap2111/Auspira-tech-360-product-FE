import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { AppointmentQueueRecord } from '../appointments/appointment-management.models';
import {
  OpdAdmissionRecord,
  OpdApiResponse,
  OpdConsultationRecord,
  OpdDiagnosisForm,
  OpdDiagnosisRecord,
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
    return firstValueFrom(this.api.get<OpdApiResponse<OpdMedicineRecord[]>>(`/pharmacy/medicines?pageNumber=${pageNumber}&pageSize=${pageSize}`));
  }

  createConsultation(form: OpdEncounterForm): Promise<OpdApiResponse<OpdConsultationRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdConsultationRecord>>('/opd/consultations', createConsultationPayload(form)));
  }

  updateConsultation(form: OpdEncounterForm): Promise<OpdApiResponse<OpdConsultationRecord>> {
    return firstValueFrom(this.api.put<OpdApiResponse<OpdConsultationRecord>>(`/opd/consultations/${form.consultationId}`, createConsultationPayload(form)));
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

  createPrescription(consultationId: string, instructions: string): Promise<OpdApiResponse<OpdPrescriptionRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdPrescriptionRecord>>('/opd/prescriptions', {
      consultationId,
      instructions: instructions.trim()
    }));
  }

  createPrescriptionItem(prescriptionId: string, item: OpdPrescriptionItemForm): Promise<OpdApiResponse<OpdPrescriptionItemRecord>> {
    return firstValueFrom(this.api.post<OpdApiResponse<OpdPrescriptionItemRecord>>('/opd/prescription-items', {
      prescriptionId,
      medicineId: item.medicineId || null,
      medicineName: item.medicine.trim(),
      dosage: [item.dosage, item.strength, item.dosageForm, item.quantity ? `Qty ${item.quantity}` : ''].filter(Boolean).join(' · '),
      frequency: [item.frequency, item.route, item.instructions].filter(Boolean).join(' · '),
      days: parseDurationDays(item.duration)
    }));
  }

  createLabOrder(patientId: string, consultationId: string, tests: OpdLabTestRecord[], priority: string, clinicalNotes: string, doctorId: string): Promise<OpdApiResponse<OpdLabOrderRecord>> {
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
      idempotencyKey: crypto.randomUUID()
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

function parseDurationDays(value: string): number {
  const match = value.match(/\d+/);
  return match ? Math.max(Number(match[0]), 1) : 1;
}
