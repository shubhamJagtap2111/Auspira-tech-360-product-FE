import { ApiResponse } from '../../core/auth/auth.models';

export type SubscriptionManagementApiResponse<T> = ApiResponse<T>;

export interface SubscriptionManagementSnapshot {
  tenants: SubscriptionTenantOption[];
  plans: SubscriptionPlanOption[];
  subscriptions: TenantSubscription[];
  invoices: SubscriptionInvoice[];
  payments: SubscriptionPayment[];
  renewals: SubscriptionRenewal[];
  trials: SubscriptionTrial[];
  coupons: SubscriptionCoupon[];
}

export interface SubscriptionTenantOption {
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
}

export interface SubscriptionPlanOption {
  planId: string;
  planCode: string;
  planName: string;
  monthlyPrice: number;
  annualPrice: number;
  currencyCode: string;
}

export interface TenantSubscription {
  subscriptionId: string;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  planId: string;
  planCode: string;
  planName: string;
  status: string;
  startDate: string;
  endDate: string;
  gracePeriodDays: number;
  graceEndsAt: string;
  billingCycle: string;
  autoRenew: boolean;
  amount: number;
  currencyCode: string;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SubscriptionInvoice {
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

export interface SubscriptionPayment {
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
  createdAt: string;
}

export interface SubscriptionRenewal {
  renewalId: string;
  subscriptionId: string;
  tenantCode: string;
  hospitalName: string;
  previousEndDate: string;
  newEndDate: string;
  gracePeriodDays: number;
  amount: number;
  currencyCode: string;
  status: string;
  requestedBy: string;
  notes: string;
  createdAt: string;
  completedAt: string | null;
}

export interface SubscriptionTrial {
  trialId: string;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  planCode: string;
  startDate: string;
  endDate: string;
  status: string;
  convertedSubscriptionId: string | null;
}

export interface SubscriptionCoupon {
  couponId: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface UpsertSubscriptionRequest {
  tenantCode: string;
  planCode: string;
  startDate: string;
  endDate: string;
  gracePeriodDays: number;
  billingCycle: string;
  autoRenew: boolean;
  amount: number;
  currencyCode: string;
  status: string;
  couponCode?: string | null;
}

export interface RenewSubscriptionRequest {
  newEndDate: string;
  gracePeriodDays: number;
  amount: number;
  currencyCode: string;
  notes?: string | null;
}

export interface CreateSubscriptionInvoiceRequest {
  subscriptionId: string;
  amount: number;
  taxAmount: number;
  discountAmount: number;
  currencyCode: string;
  dueDate: string;
}

export interface RecordSubscriptionPaymentRequest {
  subscriptionId: string;
  invoiceId?: string | null;
  paymentReference: string;
  amount: number;
  currencyCode: string;
  method: string;
  status: string;
  paidAt: string;
}

export interface UpsertSubscriptionCouponRequest {
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  maxRedemptions: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}
