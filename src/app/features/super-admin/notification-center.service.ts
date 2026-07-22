import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  NotificationCenterApiResponse,
  NotificationCenterSnapshot,
  SendNotificationRequest,
  UpsertNotificationTemplateRequest
} from './notification-center.models';

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<NotificationCenterApiResponse<NotificationCenterSnapshot>> {
    return firstValueFrom(this.api.get<NotificationCenterApiResponse<NotificationCenterSnapshot>>('/super-admin/notifications'));
  }

  send(request: SendNotificationRequest): Promise<NotificationCenterApiResponse<NotificationCenterSnapshot>> {
    return firstValueFrom(this.api.post<NotificationCenterApiResponse<NotificationCenterSnapshot>>('/super-admin/notifications/send', request));
  }

  saveTemplate(request: UpsertNotificationTemplateRequest): Promise<NotificationCenterApiResponse<NotificationCenterSnapshot>> {
    return firstValueFrom(this.api.post<NotificationCenterApiResponse<NotificationCenterSnapshot>>('/super-admin/notifications/templates', request));
  }
}
