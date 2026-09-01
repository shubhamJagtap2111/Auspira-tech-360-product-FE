import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { CriticalResult, LabApiResponse, LabDashboard, LabMaster, LabOrder, LabReport, LabResultDetail, LabTest, LabTestDetail, LabWorkItem, OrderOptions, PendingCollection, VerificationItem } from './laboratory.models';

@Injectable({ providedIn: 'root' })
export class LaboratoryService {
  private readonly api = inject(ApiClientService);
  dashboard() { return this.get<LabDashboard>('/laboratory/dashboard'); }
  tests() { return this.get<LabTest[]>('/laboratory/tests'); }
  test(id: string) { return this.get<LabTestDetail>(`/laboratory/tests/${id}`); }
  sampleTypes() { return this.get<LabMaster[]>('/laboratory/sample-types'); }
  containers() { return this.get<LabMaster[]>('/laboratory/sample-containers'); }
  rejectionReasons() { return this.get<Array<LabMaster & { recollectionRequired: boolean }>>('/laboratory/rejection-reasons'); }
  orderOptions(search = '') { return this.get<OrderOptions>(`/laboratory/order-options?patientSearch=${encodeURIComponent(search)}`); }
  orders(status = '') { return this.get<LabOrder[]>(`/laboratory/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`); }
  createOrder(body: unknown) { return this.post<{ id: string; orderNumber: string }>('/laboratory/orders', body); }
  register(id: string) { return this.post(`/laboratory/orders/${id}/register`, {}); }
  cancel(id: string, reason: string) { return this.post(`/laboratory/orders/${id}/cancel`, { reason }); }
  pendingCollection() { return this.get<PendingCollection[]>('/laboratory/samples/pending-collection'); }
  collect(orderId: string) { return this.post<{ id: string; sampleNumber: string; barcodeValue: string }>('/laboratory/samples/collect', { orderId, orderItemIds: [], sampleTypeId: null, containerId: null, predecessorSampleId: null, notes: '' }); }
  receive(sampleId: string) { return this.post(`/laboratory/samples/${sampleId}/receive`, {}); }
  sample(value: string) { return this.get<unknown>(`/laboratory/samples/${encodeURIComponent(value)}`); }
  reject(sampleId: string, reasonId: string, details: string) { return this.post(`/laboratory/samples/${sampleId}/reject`, { reasonId, details }); }
  worklist() { return this.get<LabWorkItem[]>('/laboratory/worklist'); }
  start(processingId: string) { return this.post(`/laboratory/processing/${processingId}/start`, { technicianId: null }); }
  result(orderItemId: string) { return this.get<LabResultDetail>(`/laboratory/results/by-item/${orderItemId}`); }
  saveResult(id: string, body: unknown, submit: boolean) { return this.post(`/laboratory/results/${id}/${submit ? 'submit' : 'draft'}`, body); }
  verification() { return this.get<VerificationItem[]>('/laboratory/verification'); }
  verifyRelease(id: string) { return this.post(`/laboratory/verification/${id}/verify-release`, {}); }
  rejectResult(id: string, reason: string) { return this.post(`/laboratory/verification/${id}/reject`, { reason }); }
  reports() { return this.get<LabReport[]>('/laboratory/reports'); }
  critical() { return this.get<CriticalResult[]>('/laboratory/critical-results'); }
  acknowledge(id: string, reason: string) { return this.post(`/laboratory/critical-results/${id}/acknowledge`, { reason }); }
  reportPdfUrl(id: string) { return `/api/v1/laboratory/reports/${id}/pdf`; }
  private get<T>(path: string): Promise<LabApiResponse<T>> { return firstValueFrom(this.api.get<LabApiResponse<T> | T>(path)).then(toLabResponse<T>); }
  private post<T = unknown>(path: string, body: unknown): Promise<LabApiResponse<T>> { return firstValueFrom(this.api.post<LabApiResponse<T> | T>(path, body)).then(toLabResponse<T>); }
}

function toLabResponse<T>(value: LabApiResponse<T> | T): LabApiResponse<T> {
  if (value && typeof value === 'object' && 'success' in value && 'data' in value) {
    return value as LabApiResponse<T>;
  }

  return {
    success: true,
    statusCode: 200,
    message: '',
    data: value as T
  };
}
