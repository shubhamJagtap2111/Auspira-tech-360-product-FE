import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  CreateSubscriptionInvoiceRequest,
  RecordSubscriptionPaymentRequest,
  RenewSubscriptionRequest,
  SubscriptionManagementApiResponse,
  SubscriptionManagementSnapshot,
  UpsertSubscriptionCouponRequest,
  UpsertSubscriptionRequest
} from './subscription-management.models';

@Injectable({ providedIn: 'root' })
export class SubscriptionManagementService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>> {
    return firstValueFrom(this.api.get<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>>('/super-admin/subscriptions'));
  }

  saveSubscription(request: UpsertSubscriptionRequest): Promise<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>> {
    return firstValueFrom(this.api.post<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>>('/super-admin/subscriptions', request));
  }

  renew(subscriptionId: string, request: RenewSubscriptionRequest): Promise<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>> {
    return firstValueFrom(this.api.post<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>>(`/super-admin/subscriptions/${encodeURIComponent(subscriptionId)}/renew`, request));
  }

  createInvoice(request: CreateSubscriptionInvoiceRequest): Promise<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>> {
    return firstValueFrom(this.api.post<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>>('/super-admin/subscriptions/invoices', request));
  }

  recordPayment(request: RecordSubscriptionPaymentRequest): Promise<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>> {
    return firstValueFrom(this.api.post<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>>('/super-admin/subscriptions/payments', request));
  }

  saveCoupon(request: UpsertSubscriptionCouponRequest): Promise<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>> {
    return firstValueFrom(this.api.post<SubscriptionManagementApiResponse<SubscriptionManagementSnapshot>>('/super-admin/subscriptions/coupons', request));
  }
}
