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
  IpdDischarge
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

  allocateBed(admissionId: string, bedId: string): Promise<IpdApiResponse<IpdBedAllocation>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdBedAllocation>>(`/ipd/admissions/${admissionId}/bed-allocation`, { bedId }));
  }

  addDoctorRound(admissionId: string, note: string): Promise<IpdApiResponse<IpdCareNote>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdCareNote>>(`/ipd/admissions/${admissionId}/doctor-rounds`, { note }));
  }

  addNursingNote(admissionId: string, note: string): Promise<IpdApiResponse<IpdCareNote>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdCareNote>>(`/ipd/admissions/${admissionId}/nursing-notes`, { note }));
  }

  discharge(admissionId: string, summary: string): Promise<IpdApiResponse<IpdDischarge>> {
    return firstValueFrom(this.api.post<IpdApiResponse<IpdDischarge>>(`/ipd/admissions/${admissionId}/discharge`, {
      summary,
      dischargedAt: new Date().toISOString()
    }));
  }
}
