import { ApiResponse } from '../../core/auth/auth.models';

export type QualityApiResponse<T> = ApiResponse<T>;

export interface QualityDashboard {
  year: number;
  month: number;
  department: string;
  totalIndicators: number;
  onTarget: number;
  attention: number;
  critical: number;
  noData: number;
  overallCompliance: number;
  indicators: QualityIndicatorResult[];
  recentEvents: QualityEvent[];
  recentAudits: QualityAudit[];
  generatedAt: string;
}

export interface QualityIndicatorDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  department: string;
  category: string;
  calculationType: string;
  numeratorKey: string;
  denominatorKey: string | null;
  multiplier: number;
  unit: string;
  decimalPlaces: number;
  targetType: string;
  targetValue: number | null;
  warningValue: number | null;
  direction: string;
  sourceModule: string;
  frequency: string;
  isSystemDefined: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface QualityIndicatorResult {
  indicatorId: string;
  code: string;
  name: string;
  description: string;
  department: string;
  category: string;
  calculationType: string;
  unit: string;
  targetValue: number | null;
  warningValue: number | null;
  direction: string;
  sourceModule: string;
  numerator: number;
  denominator: number | null;
  calculatedValue: number | null;
  displayValue: string;
  targetLabel: string;
  statusCode: string;
  statusLabel: string;
  statusSort: number;
  trendDelta: number | null;
  calculatedAt: string;
}

export interface QualityTrend {
  indicator: QualityIndicatorDefinition;
  points: QualityTrendPoint[];
  generatedAt: string;
}

export interface QualityTrendPoint {
  year: number;
  month: number;
  monthLabel: string;
  numerator: number;
  denominator: number | null;
  calculatedValue: number | null;
  statusCode: string;
  displayValue: string;
}

export interface QualityCalculationRun {
  year: number;
  month: number;
  calculated: number;
  results: QualityIndicatorResult[];
  calculatedAt: string;
}

export interface QualityEvent {
  id: string;
  eventNo: string;
  eventType: string;
  eventDate: string;
  department: string;
  location: string | null;
  patientId: string | null;
  doctorId: string | null;
  staffName: string | null;
  severity: string;
  description: string;
  relatedModule: string | null;
  relatedTransactionId: string | null;
  statusCode: string;
  createdAt: string;
}

export interface QualityAudit {
  id: string;
  auditNo: string;
  auditType: string;
  auditDate: string;
  department: string;
  location: string | null;
  numeratorValue: number;
  denominatorValue: number;
  scoreValue: number | null;
  auditorName: string | null;
  notes: string | null;
  statusCode: string;
  createdAt: string;
}

export interface QualityMetricDefinition {
  key: string;
  label: string;
  group: string;
  description: string;
  aggregationType: string;
}

export interface QualityFilters {
  year: number;
  month: number;
  department: string;
  search: string;
  category: string;
}

export interface SaveQualityIndicatorRequest {
  code: string | null;
  name: string;
  description: string | null;
  department: string | null;
  category: string | null;
  calculationType: string;
  numeratorKey: string;
  denominatorKey: string | null;
  multiplier: number;
  unit: string | null;
  decimalPlaces: number;
  targetValue: number | null;
  warningValue: number | null;
  direction: string;
  frequency: string | null;
}

export interface SaveQualityEventRequest {
  eventType: string;
  eventDate: string | null;
  department: string | null;
  location: string | null;
  patientId: string | null;
  doctorId: string | null;
  staffName: string | null;
  severity: string | null;
  description: string;
  relatedModule: string | null;
  relatedTransactionId: string | null;
  statusCode: string | null;
}

export interface SaveQualityAuditRequest {
  auditType: string;
  auditDate: string | null;
  department: string | null;
  location: string | null;
  numeratorValue: number;
  denominatorValue: number;
  auditorName: string | null;
  notes: string | null;
  statusCode: string | null;
}
