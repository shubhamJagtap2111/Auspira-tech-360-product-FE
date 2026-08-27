import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  CreateIpdAdmissionRequest,
  IpdAdmissionWorkflow,
  IpdApiResponse,
  IpdBedAllocation,
  IpdCareNote,
  IpdDashboard,
  IpdDischarge,
  IpdVitalRecord,
  SaveIpdBedRequest,
  SaveIpdRoomRequest,
  SaveIpdVitalRequest,
  SaveIpdWardRequest
} from './ipd-management.models';

@Injectable({ providedIn: 'root' })
export class IpdManagementService {
  private readonly api = inject(ApiClientService);

  dashboard(): Promise<IpdApiResponse<IpdDashboard>> {
    return firstValueFrom(this.api.get<IpdApiResponse<IpdDashboard>>('/ipd/dashboard'));
  }

  createAdmission(request: CreateIpdAdmissionRequest): Promise<IpdApiResponse<IpdAdmissionWorkflow>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdAdmissionWorkflow>>('/ipd/admissions/workflow', request));
  }

  saveAdmissionDraft(request: CreateIpdAdmissionRequest): Promise<IpdApiResponse<IpdAdmissionWorkflow>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdAdmissionWorkflow>>('/ipd/admissions/draft', request));
  }

  reserveBed(admissionId: string, bedId: string): Promise<IpdApiResponse<IpdBedAllocation>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdBedAllocation>>(`/ipd/admissions/${admissionId}/reserve-bed`, { bedId }));
  }

  confirmAdmission(admissionId: string): Promise<IpdApiResponse<IpdAdmissionWorkflow>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdAdmissionWorkflow>>(`/ipd/admissions/${admissionId}/confirm`, {}));
  }

  allocateBed(admissionId: string, bedId: string): Promise<IpdApiResponse<IpdBedAllocation>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdBedAllocation>>(`/ipd/admissions/${admissionId}/bed-allocation`, { bedId }));
  }

  saveWard(request: SaveIpdWardRequest): Promise<IpdApiResponse<{ id: string; statusCode: string }>> {
    return firstValueFrom(this.api.post<IpdApiResponse<{ id: string; statusCode: string }>>('/ipd/facility/wards', request));
  }

  saveRoom(request: SaveIpdRoomRequest): Promise<IpdApiResponse<{ id: string; statusCode: string }>> {
    return firstValueFrom(this.api.post<IpdApiResponse<{ id: string; statusCode: string }>>('/ipd/facility/rooms', request));
  }

  saveBed(request: SaveIpdBedRequest): Promise<IpdApiResponse<{ id: string; statusCode: string }>> {
    return firstValueFrom(this.api.post<IpdApiResponse<{ id: string; statusCode: string }>>('/ipd/facility/beds', request));
  }

  updateBedStatus(bedId: string, statusCode: string): Promise<IpdApiResponse<{ bedId: string; statusCode: string }>> {
    return firstValueFrom(this.api.post<IpdApiResponse<{ bedId: string; statusCode: string }>>(`/ipd/facility/beds/${bedId}/status`, { statusCode }));
  }

  deleteWard(wardId: string): Promise<IpdApiResponse<unknown>> {
    return firstValueFrom(this.api.delete<IpdApiResponse<unknown>>(`/ipd/facility/wards/${wardId}`));
  }

  deleteRoom(roomId: string): Promise<IpdApiResponse<unknown>> {
    return firstValueFrom(this.api.delete<IpdApiResponse<unknown>>(`/ipd/facility/rooms/${roomId}`));
  }

  deleteBed(bedId: string): Promise<IpdApiResponse<unknown>> {
    return firstValueFrom(this.api.delete<IpdApiResponse<unknown>>(`/ipd/facility/beds/${bedId}`));
  }

  addDoctorRound(admissionId: string, note: string): Promise<IpdApiResponse<IpdCareNote>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdCareNote>>(`/ipd/admissions/${admissionId}/doctor-rounds`, { note }));
  }

  addNursingNote(admissionId: string, note: string): Promise<IpdApiResponse<IpdCareNote>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdCareNote>>(`/ipd/admissions/${admissionId}/nursing-notes`, { note }));
  }

  vitals(admissionId: string): Promise<IpdApiResponse<IpdVitalRecord[]>> {
    return firstValueFrom(this.api.get<IpdApiResponse<IpdVitalRecord[]>>(`/ipd/admissions/${admissionId}/vitals`));
  }

  saveVitals(admissionId: string, request: SaveIpdVitalRequest): Promise<IpdApiResponse<IpdVitalRecord>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdVitalRecord>>(`/ipd/admissions/${admissionId}/vitals`, request));
  }

  deleteVitals(admissionId: string, vitalId: string): Promise<IpdApiResponse<unknown>> {
    return firstValueFrom(this.api.delete<IpdApiResponse<unknown>>(`/ipd/admissions/${admissionId}/vitals/${vitalId}`));
  }

  discharge(admissionId: string, summary: string): Promise<IpdApiResponse<IpdDischarge>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdDischarge>>(`/ipd/admissions/${admissionId}/discharge`, {
      summary,
      dischargedAt: new Date().toISOString()
    }));
  }
}
