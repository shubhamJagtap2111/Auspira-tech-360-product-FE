import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  BillingManagementApiResponse,
  BillingManagementSnapshot,
  CreateBillingCreditRequest,
  CreateBillingRefundRequest,
  RecordBillingTransactionRequest,
  UpsertBillingTaxRateRequest
} from './billing-management.models';

@Injectable({ providedIn: 'root' })
export class BillingManagementService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<BillingManagementApiResponse<BillingManagementSnapshot>> {
    return firstValueFrom(this.api.get<BillingManagementApiResponse<BillingManagementSnapshot>>('/super-admin/billing'));
  }

  saveTaxRate(request: UpsertBillingTaxRateRequest): Promise<BillingManagementApiResponse<BillingManagementSnapshot>> {
    return firstValueFrom(this.api.post<BillingManagementApiResponse<BillingManagementSnapshot>>('/super-admin/billing/tax-rates', request));
  }

  createRefund(request: CreateBillingRefundRequest): Promise<BillingManagementApiResponse<BillingManagementSnapshot>> {
    return firstValueFrom(this.api.post<BillingManagementApiResponse<BillingManagementSnapshot>>('/super-admin/billing/refunds', request));
  }

  createCredit(request: CreateBillingCreditRequest): Promise<BillingManagementApiResponse<BillingManagementSnapshot>> {
    return firstValueFrom(this.api.post<BillingManagementApiResponse<BillingManagementSnapshot>>('/super-admin/billing/credits', request));
  }

  recordTransaction(request: RecordBillingTransactionRequest): Promise<BillingManagementApiResponse<BillingManagementSnapshot>> {
    return firstValueFrom(this.api.post<BillingManagementApiResponse<BillingManagementSnapshot>>('/super-admin/billing/transactions', request));
  }
}
