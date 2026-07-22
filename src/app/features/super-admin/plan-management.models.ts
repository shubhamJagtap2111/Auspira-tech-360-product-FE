import { ApiResponse } from '../../core/auth/auth.models';

export type PlanManagementApiResponse<T> = ApiResponse<T>;

export interface PlanCatalog {
  plans: Plan[];
  features: Feature[];
  limitDefinitions: LimitDefinition[];
}

export interface Plan {
  planId: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currencyCode: string;
  isCustom: boolean;
  isActive: boolean;
  sortOrder: number;
  tenantCount: number;
  createdAt: string;
  updatedAt: string | null;
  limits: PlanLimitValue[];
  features: PlanFeatureValue[];
}

export interface Feature {
  featureId: string;
  code: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface LimitDefinition {
  limitDefinitionId: string;
  limitKey: string;
  label: string;
  unit: string;
  valueType: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PlanLimitValue {
  limitKey: string;
  value: number | null;
}

export interface PlanFeatureValue {
  featureCode: string;
  isEnabled: boolean;
}

export interface SetPlanFeatureRequest {
  planCode: string;
  featureCode: string;
  isEnabled: boolean;
}

export interface UpsertPlanRequest {
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  currencyCode: string;
  isCustom: boolean;
  isActive: boolean;
  sortOrder: number;
  limits: PlanLimitValue[];
  features: PlanFeatureValue[];
}

export interface UpsertFeatureRequest {
  code: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UpsertLimitDefinitionRequest {
  limitKey: string;
  label: string;
  unit: string;
  valueType: string;
  sortOrder: number;
  isActive: boolean;
}
