import { ApiResponse } from '../../core/auth/auth.models';

export type BillingApiResponse<T> = ApiResponse<T>;
export type BillingTab = 'dashboard' | 'charge-master' | 'charges' | 'invoices' | 'payments' | 'receipts' | 'refunds' | 'discounts' | 'insurance' | 'credit-notes' | 'outstanding' | 'reports' | 'settings';

export interface BillingDashboard {
  summary: BillingDashboardSummary;
  trend: BillingTrendPoint[];
  breakdown: BillingBreakdown[];
  recentInvoices: BillingInvoice[];
  generatedAt: string;
}

export interface BillingDashboardSummary {
  todayBilling: number;
  monthBilling: number;
  outstanding: number;
  refunds: number;
  todayCollections: number;
  invoiceCount: number;
  paymentCount: number;
  pendingRefunds: number;
}

export interface BillingTrendPoint { label: string; billed: number; collected: number; }
export interface BillingBreakdown { module: string; amount: number; invoices: number; }

export interface ChargeMaster {
  id: string;
  serviceCode: string;
  serviceName: string;
  department: string;
  category: string;
  unit: string;
  taxPercent: number;
  basePrice: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface SaveChargeMasterRequest {
  serviceCode: string;
  serviceName: string;
  department: string;
  category: string;
  unit: string;
  basePrice: number;
  taxPercent: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface BillableCharge {
  id: string;
  patientId: string;
  patientName: string;
  medicalRecordNo: string;
  encounterId: string | null;
  sourceModule: string;
  sourceEntity: string;
  sourceId: string;
  serviceCode: string;
  description: string;
  department: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  chargeDate: string;
  statusCode: string;
  invoiceId: string | null;
  createdAt: string;
}

export interface CreateBillableChargeRequest {
  patientId: string;
  encounterId: string | null;
  chargeMasterId: string | null;
  serviceCode: string | null;
  description: string | null;
  sourceModule: string;
  sourceEntity: string;
  sourceId: string;
  department: string | null;
  category: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number | null;
  discountAmount: number;
  taxPercent: number;
  chargeDate: string | null;
}

export interface PatientFinancialAccount {
  patientId: string;
  medicalRecordNo: string;
  patientName: string;
  totalCharges: number;
  discountAmount: number;
  insuranceAmount: number;
  paidAmount: number;
  refundAmount: number;
  outstandingAmount: number;
  updatedAt: string;
}

export interface BillingInvoice {
  id: string;
  invoiceNo: string;
  patientId: string;
  medicalRecordNo: string;
  patientName: string;
  encounterId: string | null;
  invoiceType: string;
  invoiceDate: string;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  insuranceAmount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string | null;
  statusCode: string;
  issuedAt: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  chargeId: string | null;
  serviceCode: string;
  description: string;
  department: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  sourceModule: string;
  sourceId: string | null;
}

export interface InvoiceDetail { invoice: BillingInvoice; items: InvoiceItem[]; payments: BillingPayment[]; }

export interface BillingPayment {
  id: string;
  paymentNo: string;
  invoiceId: string;
  invoiceNo: string;
  patientId: string;
  patientName: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  collectedBy: string | null;
  statusCode: string;
  paidAt: string;
  receiptId: string | null;
  receiptNo: string | null;
}

export interface BillingReceipt {
  id: string;
  receiptNo: string;
  paymentId: string;
  paymentNo: string;
  invoiceId: string;
  invoiceNo: string;
  patientId: string;
  medicalRecordNo: string;
  patientName: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  issuedBy: string | null;
  issuedAt: string;
  statusCode: string;
}

export interface BillingRefund {
  id: string;
  refundNo: string;
  paymentId: string;
  paymentNo: string;
  invoiceId: string;
  invoiceNo: string;
  patientName: string;
  amount: number;
  reason: string;
  refundMode: string | null;
  statusCode: string;
  requestedBy: string | null;
  approvedBy: string | null;
  processedBy: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface BillingDiscount {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  discountType: string;
  discountValue: number;
  amount: number;
  reason: string;
  statusCode: string;
  requestedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
}

export interface InsuranceClaim {
  id: string;
  claimNo: string;
  invoiceId: string;
  invoiceNo: string;
  patientId: string;
  patientName: string;
  providerName: string;
  policyNumber: string | null;
  memberId: string | null;
  tpaName: string | null;
  coverageAmount: number;
  approvedAmount: number;
  claimAmount: number;
  settledAmount: number;
  rejectedAmount: number;
  patientPayable: number;
  statusCode: string;
  submittedAt: string | null;
  settledAt: string | null;
}

export interface CreditNote {
  id: string;
  creditNoteNo: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  reason: string;
  statusCode: string;
  issuedBy: string | null;
  issuedAt: string;
}

export interface OutstandingInvoice {
  invoiceId: string;
  invoiceNo: string;
  patientId: string;
  medicalRecordNo: string;
  patientName: string;
  invoiceType: string;
  invoiceDate: string;
  dueDate: string | null;
  total: number;
  paid: number;
  due: number;
  statusCode: string;
  ageDays: number;
}

export interface BillingReport {
  from: string;
  to: string;
  rows: BillingReportRow[];
  paymentModes: PaymentModeReport[];
}

export interface BillingReportRow { module: string; invoiceCount: number; grossAmount: number; discountAmount: number; taxAmount: number; netAmount: number; collectedAmount: number; outstandingAmount: number; refundAmount: number; }
export interface PaymentModeReport { paymentMode: string; transactions: number; amount: number; }
export interface BillingSetting { key: string; value: string; description: string | null; updatedAt: string; }
export interface IdNumberResult { id: string; invoiceNo?: string; paymentNo?: string; receiptId?: string; receiptNo?: string; refundNo?: string; creditNoteNo?: string; claimNo?: string; statusCode?: string; }
