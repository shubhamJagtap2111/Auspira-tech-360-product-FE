import { ApiResponse } from '../../core/auth/auth.models';

export type MonitoringApiResponse<T> = ApiResponse<T>;

export interface MonitoringSnapshot {
  metrics: MonitoringMetricCard[];
  databases: MonitoringDatabaseItem[];
  slowQueries: MonitoringSlowQueryItem[];
  requests: MonitoringRequestItem[];
  errors: MonitoringErrorItem[];
  queues: MonitoringQueueItem[];
  storage: MonitoringStorageItem[];
}

export interface MonitoringMetricCard {
  key: string;
  group: string;
  label: string;
  value: number;
  unit: string;
  status: string;
  capturedAt: string;
}

export interface MonitoringDatabaseItem {
  tenantCode: string;
  hospitalName: string;
  databaseName: string;
  health: string;
  storageGb: number;
  connections: number;
  updatedAt: string;
}

export interface MonitoringSlowQueryItem {
  slowQueryId: string;
  tenantCode: string | null;
  databaseName: string;
  queryText: string;
  durationMs: number;
  status: string;
  occurredAt: string;
}

export interface MonitoringRequestItem {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  occurredAt: string;
}

export interface MonitoringErrorItem {
  errorId: string;
  source: string;
  message: string;
  severity: string;
  occurredAt: string;
}

export interface MonitoringQueueItem {
  queueMetricId: string;
  queueName: string;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  status: string;
  capturedAt: string;
}

export interface MonitoringStorageItem {
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  databaseName: string;
  storageGb: number;
  capacityGb: number;
  usagePercent: number;
  status: string;
}
