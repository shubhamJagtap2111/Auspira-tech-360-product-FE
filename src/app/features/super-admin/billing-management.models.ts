import { ApiResponse } from '../../core/auth/auth.models';

export type BillingManagementApiResponse<T> = ApiResponse<T>;

export interface BillingManagementSnapshot {
  summary: BillingSummary;
  tenants: BillingTenantOption[];
  invoices: BillingInvoice[];
  payments: BillingPayment[];
  taxRates: BillingTaxRate[];
  refunds: BillingRefund[];
  credits: BillingCredit[];
  transactions: BillingTransaction[];
}

export interface BillingSummary {
  openInvoiceAmount: number;
  paidAmount: number;
  taxCollected: number;
  refundAmount: number;
  creditBalance: number;
  currencyCode: string;
}

export interface BillingTenantOption { tenantId: string; tenantCode: string; hospitalName: string; }

export interface BillingInvoice {
  invoiceId: string;
  subscriptionId: string;
  invoiceNo: string;
  tenantCode: string;
  hospitalName: string;
  amount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currencyCode: string;
  status: string;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
}

export interface BillingPayment {
  paymentId: string;
  subscriptionId: string;
  invoiceId: string | null;
  tenantCode: string;
  hospitalName: string;
  paymentReference: string;
  amount: number;
  currencyCode: string;
  method: string;
  status: string;
  paidAt: string;
}

export interface BillingTaxRate {
  taxRateId: string;
  taxCode: string;
  taxName: string;
  taxType: string;
  countryCode: string;
  stateCode: string | null;
  ratePercent: number;
  registrationNo: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface BillingRefund {
  refundId: string;
  paymentId: string;
  invoiceId: string | null;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  refundReference: string;
  amount: number;
  currencyCode: string;
  reason: string;
  status: string;
  requestedBy: string;
  refundedAt: string | null;
  createdAt: string;
}

export interface BillingCredit {
  creditId: string;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  creditNo: string;
  amount: number;
  remainingAmount: number;
  currencyCode: string;
  reason: string;
  status: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string | null;
}

export interface BillingTransaction {
  transactionId: string;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  subscriptionId: string | null;
  invoiceId: string | null;
  paymentId: string | null;
  refundId: string | null;
  creditId: string | null;
  transactionType: string;
  referenceNo: string;
  direction: string;
  amount: number;
  currencyCode: string;
  status: string;
  description: string;
  occurredAt: string;
}

export interface UpsertBillingTaxRateRequest {
  taxCode: string;
  taxName: string;
  taxType: string;
  countryCode: string;
  stateCode: string | null;
  ratePercent: number;
  registrationNo: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface CreateBillingRefundRequest { paymentId: string; amount: number; currencyCode: string; reason: string; status: string; }

export interface CreateBillingCreditRequest { tenantCode: string; amount: number; currencyCode: string; reason: string; expiresAt: string | null; }

export interface RecordBillingTransactionRequest {
  tenantCode: string;
  subscriptionId: string | null;
  invoiceId: string | null;
  paymentId: string | null;
  refundId: string | null;
  creditId: string | null;
  transactionType: string;
  referenceNo: string;
  direction: string;
  amount: number;
  currencyCode: string;
  status: string;
  description: string | null;
  occurredAt: string | null;
}
