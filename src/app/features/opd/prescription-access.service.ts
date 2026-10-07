import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/http/api-endpoints';
import { ApiClientService } from '../../core/http/api-client.service';
import QRCode from 'qrcode';

export interface PrescriptionAccessLink { token: string; accessCode: string; expiresAt: string; tenantCode: string; url: string; qrImage: string; }
export interface PrescriptionHospitalHeader {
  hospitalName: string; logoUrl?: string | null;
  address?: { addressLine1: string; addressLine2?: string; cityName: string; stateName: string; postalCode: string };
  contact?: { primaryPhone: string; email: string };
}

// A standards-based QR with a four-module quiet zone, generated locally without sending records to a QR service.
export function prescriptionQrImage(url: string): string {
  const matrix = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules;
  const size = matrix.size + 8;
  let path = '';
  for (let row = 0; row < matrix.size; row++) for (let col = 0; col < matrix.size; col++) {
    if (matrix.get(row, col)) path += `M${col + 4},${row + 4}h1v1h-1z`;
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path d="${path}" fill="black"/></svg>`);
}

@Injectable({ providedIn: 'root' })
export class PrescriptionAccessService {
  private readonly api = inject(ApiClientService);
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  async issue(id: string): Promise<PrescriptionAccessLink> {
    const response = await firstValueFrom(this.api.post<{ success: boolean; data: Omit<PrescriptionAccessLink, 'url' | 'qrImage'> }>(`/prescription-access/consultations/${id}`, {}));
    if (!response.success || !response.data) throw new Error('Digital access could not be prepared. Please retry.');
    const url = `${location.origin}/prescription-access#${new URLSearchParams({ token: response.data.token, tenant: response.data.tenantCode })}`;
    return { ...response.data, url, qrImage: prescriptionQrImage(url) };
  }
  async header(): Promise<PrescriptionHospitalHeader | null> {
    const response = await firstValueFrom(this.api.get<{ success: boolean; data: PrescriptionHospitalHeader }>('/prescription-access/hospital-header'));
    return response.success ? response.data : null;
  }
  async records(token: string, tenant: string, code: string, staff: boolean): Promise<DigitalPrescription> {
    const response = await firstValueFrom(this.http.post<{ success: boolean; data: DigitalPrescription }>(
      `${this.base}/prescription-access/${staff ? 'staff' : 'patient'}`, { token, accessCode: code },
      { headers: new HttpHeaders({ 'X-Tenant-Code': tenant }), withCredentials: staff }));
    if (!response.success || !response.data) throw new Error('Unable to open the record.');
    return response.data;
  }
}

export interface DigitalVisit {
  id: string; visitDate: string; status: string; patientName: string; mrn: string; age: number | null; gender: string;
  doctorName: string; qualification: string; registrationNo: string; department: string;
  investigations?: string[];
  clinical: Partial<import('./opd-management.models').OpdClinicalForm>; legacyNotes?: string;
}
export interface DigitalPrescription extends PrescriptionHospitalHeader { selectedId: string; expiresAt: string; visits: DigitalVisit[]; }
