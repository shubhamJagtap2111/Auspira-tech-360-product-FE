import { ApiResponse } from '../../core/auth/auth.models';

export type DatabaseManagementApiResponse<T> = ApiResponse<T>;

export interface DatabaseManagementSnapshot {
  summary: DatabaseManagementSummary;
  databases: DatabaseGridItem[];
  recentOperations: DatabaseOperationLogItem[];
}

export interface DatabaseManagementSummary {
  totalDatabases: number;
  healthyDatabases: number;
  warningDatabases: number;
  failedDatabases: number;
  totalStorageGb: number;
  activeConnections: number;
}

export interface DatabaseGridItem {
  tenantId: string;
  hospitalName: string;
  tenantCode: string;
  databaseName: string;
  databaseServerKey: string;
  version: string;
  storageGb: number;
  health: string;
  connections: number;
  lastBackupAt: string | null;
  migrationVersion: string;
  migrationStatus: string;
  updatedAt: string;
}

export interface DatabaseOperationLogItem {
  operationLogId: string;
  tenantId: string;
  tenantCode: string;
  hospitalName: string;
  databaseName: string;
  operationType: string;
  status: string;
  requestedBy: string;
  message: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface RunDatabaseOperationRequest {
  operationType: string;
  targetVersion?: string | null;
  message?: string | null;
}

export interface DatabaseLogDownload {
  fileName: string;
  contentType: string;
  content: string;
}
