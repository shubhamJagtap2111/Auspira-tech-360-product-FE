import { ApiResponse } from '../../core/auth/auth.models';
import { AppointmentQueueRecord, AppointmentRecord } from '../appointments/appointment-management.models';
import { DoctorSummary } from '../doctors/doctor-management.models';
import { PatientSummary } from '../patients/patient-management.models';

export type OpdApiResponse<T> = ApiResponse<T>;
export type OpdTab = 'dashboard' | 'queue' | 'check-in' | 'active' | 'completed' | 'encounter';
export type OpdConsultationStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type OpdEncounterSection = 'snapshot' | 'vitals' | 'consultation' | 'diagnosis' | 'lab-orders' | 'procedures' | 'notes' | 'prescription' | 'follow-up';

export interface OpdConsultationRecord {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  notes: string;
  statusCode: OpdConsultationStatus | string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdEncounterForm {
  consultationId: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  notes: string;
  statusCode: OpdConsultationStatus;
}

export interface OpdFollowUpRecord {
  id: string;
  patientId: string;
  appointmentId: string | null;
  followUpDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdSymptomRecord {
  id: string;
  consultationId: string;
  symptom: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdDiagnosisRecord {
  id: string;
  consultationId: string;
  diagnosisText: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdPrescriptionRecord {
  id: string;
  consultationId: string;
  instructions: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdPrescriptionItemRecord {
  id: string;
  prescriptionId: string;
  medicineId: string | null;
  medicineName: string;
  dosage: string;
  frequency: string;
  days: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdMedicineRecord {
  id: string;
  name: string;
  genericName: string;
  unit: string;
  salePrice: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdLabTestRecord {
  id: string;
  code: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdLabOrderRecord {
  id: string;
  patientId: string;
  consultationId: string | null;
  statusCode: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdLabOrderItemRecord {
  id: string;
  labOrderId: string;
  labTestId: string;
  price: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdAdmissionRecord {
  id: string;
  patientId: string;
  doctorId: string;
  admittedAt: string;
  statusCode: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdInvoiceRecord {
  id: string;
  patientId: string;
  invoiceNo: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  statusCode: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdBillableChargeRecord {
  id: string;
  patientId: string;
  serviceCode: string;
  description: string;
  netAmount: number;
  statusCode: string;
}

export interface OpdInvoiceItemRecord {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpdVitalsForm {
  temperature: string;
  bloodPressure: string;
  pulseRate: string;
  respiratoryRate: string;
  spo2: string;
  height: string;
  weight: string;
}

export interface OpdComplaintForm {
  id?: string;
  complaint: string;
  duration: string;
  severity: string;
  notes: string;
}

export interface OpdHistoryForm {
  presentIllness: string;
  pastHistory: string;
  familyHistory: string;
  surgicalHistory: string;
}

export interface OpdExaminationForm {
  generalExamination: string;
  systemExamination: string;
  observations: string;
}

export interface OpdDiagnosisForm {
  id?: string;
  diagnosisCode: string;
  diagnosisName: string;
  diagnosisType: 'PRIMARY' | 'SECONDARY';
  notes: string;
}

export interface OpdPrescriptionItemForm {
  id?: string;
  medicineId?: string | null;
  medicine: string;
  strength: string;
  dosageForm: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

export interface OpdLabOrderForm {
  labOrderId?: string;
  testCategory: string;
  testId: string;
  priority: string;
  notes: string;
}

export interface OpdProcedureForm {
  procedure: string;
  notes: string;
  charge: string;
}

export interface OpdFollowUpForm {
  followUpRequired: boolean;
  followUpAfterDays: string;
  followUpDate: string;
  preferredDoctorId: string;
  reason: string;
  notes: string;
  createAppointment: boolean;
}

export interface OpdClinicalForm {
  vitals: OpdVitalsForm;
  includeVitalsInPrescription: boolean;
  complaints: OpdComplaintForm[];
  complaintDraft: OpdComplaintForm;
  history: OpdHistoryForm;
  examination: OpdExaminationForm;
  diagnoses: OpdDiagnosisForm[];
  diagnosisDraft: OpdDiagnosisForm;
  prescriptions: OpdPrescriptionItemForm[];
  prescriptionDraft: OpdPrescriptionItemForm;
  prescriptionId: string;
  prescriptionNo: string;
  includeInvestigationsInPrescription: boolean;
  investigationDraft: string;
  prescriptionInvestigations: string[];
  adviceDraft: string;
  adviceList: string[];
  dietAdviceDraft: string;
  dietAdviceList: string[];
  labOrders: OpdLabOrderForm[];
  labOrderDraft: OpdLabOrderForm;
  procedures: OpdProcedureForm[];
  procedureDraft: OpdProcedureForm;
  clinicalNotes: string;
  followUp: OpdFollowUpForm;
  invoiceId: string;
  admissionId: string;
}

export interface OpdVisitVm {
  appointment: AppointmentRecord;
  queue: AppointmentQueueRecord | null;
  consultation: OpdConsultationRecord | null;
  patient: PatientSummary | null;
  doctor: DoctorSummary | null;
  appointmentNo: string;
  tokenNumber: string;
  queueNo: number | null;
  priorityCode: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  departmentName: string;
  branchName: string;
  appointmentTime: string;
  arrivalTime: string | null;
  statusCode: string;
  consultationStatus: string;
}

export interface OpdStats {
  waiting: number;
  inConsultation: number;
  completed: number;
  followUps: number;
  noShows: number;
}
