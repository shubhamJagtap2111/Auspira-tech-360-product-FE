import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  CreateSupportTicketRequest,
  SupportCenterApiResponse,
  SupportCenterSnapshot,
  UpdateSupportTicketStatusRequest
} from './support-center.models';

@Injectable({ providedIn: 'root' })
export class SupportCenterService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<SupportCenterApiResponse<SupportCenterSnapshot>> {
    return firstValueFrom(this.api.get<SupportCenterApiResponse<SupportCenterSnapshot>>('/super-admin/support'));
  }

  createTicket(request: CreateSupportTicketRequest): Promise<SupportCenterApiResponse<SupportCenterSnapshot>> {
    return firstValueFrom(this.api.post<SupportCenterApiResponse<SupportCenterSnapshot>>('/super-admin/support/tickets', request));
  }

  updateStatus(ticketId: string, request: UpdateSupportTicketStatusRequest): Promise<SupportCenterApiResponse<SupportCenterSnapshot>> {
    return firstValueFrom(this.api.post<SupportCenterApiResponse<SupportCenterSnapshot>>(`/super-admin/support/tickets/${encodeURIComponent(ticketId)}/status`, request));
  }
}
