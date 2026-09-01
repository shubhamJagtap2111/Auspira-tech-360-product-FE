import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  BillableCharge, BillingApiResponse, BillingDashboard, BillingDiscount, BillingInvoice, BillingPayment, BillingReceipt,
  BillingRefund, BillingReport, BillingSetting, ChargeMaster, CreateBillableChargeRequest, CreditNote, IdNumberResult,
  InsuranceClaim, InvoiceDetail, OutstandingInvoice, PatientFinancialAccount, SaveChargeMasterRequest
} from './billing.models';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly api = inject(ApiClientService);

  dashboard() { return this.get<BillingDashboard>('/billing/dashboard'); }
  chargeMaster(search = '') { return this.get<ChargeMaster[]>(`/billing/charge-master?search=${encodeURIComponent(search)}`); }
  saveChargeMaster(request: SaveChargeMasterRequest, id?: string) { return id ? this.put<IdNumberResult>(`/billing/charge-master/${id}`, request) : this.post<IdNumberResult>('/billing/charge-master', request); }
  charges(patientId = '', status = '') { const query = new URLSearchParams(); if (patientId) query.set('patientId', patientId); if (status) query.set('status', status); return this.get<BillableCharge[]>(`/billing/charges?${query}`); }
  createCharge(request: CreateBillableChargeRequest) { return this.post<BillableCharge>('/billing/charges', request); }
  voidCharge(id: string, reason: string) { return this.post<IdNumberResult>(`/billing/charges/${id}/void`, { reason }); }
  account(patientId: string) { return this.get<PatientFinancialAccount>(`/billing/accounts/${patientId}`); }
  invoices(search = '', status = '', type = '') { const query = new URLSearchParams(); if (search) query.set('search', search); if (status) query.set('status', status); if (type) query.set('type', type); return this.get<BillingInvoice[]>(`/billing/invoices?${query}`); }
  invoice(id: string) { return this.get<InvoiceDetail>(`/billing/invoices/${id}`); }
  createInvoice(patientId: string, invoiceType: string, chargeIds: string[], dueDate: string | null) { return this.post<IdNumberResult>('/billing/invoices', { patientId, encounterId: null, invoiceType, chargeIds, dueDate }); }
  issueInvoice(id: string) { return this.post<IdNumberResult>(`/billing/invoices/${id}/issue`, {}); }
  cancelInvoice(id: string, reason: string) { return this.post<IdNumberResult>(`/billing/invoices/${id}/cancel`, { reason }); }
  payments(invoiceId = '') { return this.get<BillingPayment[]>(`/billing/payments${invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : ''}`); }
  createPayment(invoiceId: string, amount: number, paymentMode: string, referenceNumber: string | null) { return this.post<IdNumberResult>('/billing/payments', { invoiceId, amount, paymentMode, referenceNumber }); }
  reversePayment(id: string, reason: string) { return this.post<IdNumberResult>(`/billing/payments/${id}/reverse`, { reason }); }
  receipts() { return this.get<BillingReceipt[]>('/billing/receipts'); }
  receipt(id: string) { return this.get<BillingReceipt>(`/billing/receipts/${id}`); }
  refunds() { return this.get<BillingRefund[]>('/billing/refunds'); }
  requestRefund(paymentId: string, amount: number, reason: string, refundMode: string) { return this.post<IdNumberResult>('/billing/refunds', { paymentId, amount, reason, refundMode }); }
  approveRefund(id: string) { return this.post<IdNumberResult>(`/billing/refunds/${id}/approve`, {}); }
  processRefund(id: string) { return this.post<IdNumberResult>(`/billing/refunds/${id}/process`, {}); }
  discounts() { return this.get<BillingDiscount[]>('/billing/discounts'); }
  requestDiscount(invoiceId: string, type: string, value: number, reason: string) { return this.post<IdNumberResult>('/billing/discounts', { invoiceId, type, value, reason }); }
  approveDiscount(id: string) { return this.post<IdNumberResult>(`/billing/discounts/${id}/approve`, {}); }
  claims() { return this.get<InsuranceClaim[]>('/billing/insurance/claims'); }
  createClaim(request: Record<string, unknown>) { return this.post<IdNumberResult>('/billing/insurance/claims', request); }
  creditNotes() { return this.get<CreditNote[]>('/billing/credit-notes'); }
  createCreditNote(invoiceId: string, amount: number, reason: string) { return this.post<IdNumberResult>('/billing/credit-notes', { invoiceId, amount, reason }); }
  outstanding(aging = '') { return this.get<OutstandingInvoice[]>(`/billing/outstanding${aging ? `?aging=${encodeURIComponent(aging)}` : ''}`); }
  reports(from: string, to: string) { return this.get<BillingReport>(`/billing/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); }
  settings() { return this.get<BillingSetting[]>('/billing/settings'); }
  updateSetting(key: string, value: string) { return this.put<{ key: string; value: string }>(`/billing/settings/${encodeURIComponent(key)}`, { value }); }

  private get<T>(path: string): Promise<BillingApiResponse<T>> { return firstValueFrom(this.api.get<BillingApiResponse<T>>(path)); }
  private post<T>(path: string, body: unknown): Promise<BillingApiResponse<T>> { return firstValueFrom(this.api.post<BillingApiResponse<T>>(path, body)); }
  private put<T>(path: string, body: unknown): Promise<BillingApiResponse<T>> { return firstValueFrom(this.api.put<BillingApiResponse<T>>(path, body)); }
}
