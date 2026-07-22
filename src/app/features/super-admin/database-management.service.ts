import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  DatabaseLogDownload,
  DatabaseManagementApiResponse,
  DatabaseManagementSnapshot,
  RunDatabaseOperationRequest
} from './database-management.models';

@Injectable({ providedIn: 'root' })
export class DatabaseManagementService {
  private readonly api = inject(ApiClientService);

  getSnapshot(): Promise<DatabaseManagementApiResponse<DatabaseManagementSnapshot>> {
    return firstValueFrom(this.api.get<DatabaseManagementApiResponse<DatabaseManagementSnapshot>>('/super-admin/databases'));
  }

  runOperation(tenantCode: string, request: RunDatabaseOperationRequest): Promise<DatabaseManagementApiResponse<DatabaseManagementSnapshot>> {
    return firstValueFrom(this.api.post<DatabaseManagementApiResponse<DatabaseManagementSnapshot>>(`/super-admin/databases/${encodeURIComponent(tenantCode)}/operations`, request));
  }

  getLogs(tenantCode: string): Promise<DatabaseManagementApiResponse<DatabaseLogDownload>> {
    return firstValueFrom(this.api.get<DatabaseManagementApiResponse<DatabaseLogDownload>>(`/super-admin/databases/${encodeURIComponent(tenantCode)}/logs`));
  }
}
