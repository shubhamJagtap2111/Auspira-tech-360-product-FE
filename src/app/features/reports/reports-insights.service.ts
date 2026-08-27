import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { ReportFilters, ReportResult, ReportsApiResponse, ReportsWorkspace } from './reports-insights.models';

@Injectable({ providedIn: 'root' })
export class ReportsInsightsService {
  private readonly api = inject(ApiClientService);

  getWorkspace(filters: ReportFilters): Promise<ReportsApiResponse<ReportsWorkspace>> {
    return firstValueFrom(this.api.get<ReportsApiResponse<ReportsWorkspace>>(`/reports/workspace?${toQuery(filters)}`));
  }

  generate(reportKey: string, filters: ReportFilters): Promise<ReportsApiResponse<ReportResult>> {
    const query = toQuery(filters);
    query.set('reportKey', reportKey);
    return firstValueFrom(this.api.get<ReportsApiResponse<ReportResult>>(`/reports/generate?${query.toString()}`));
  }
}

function toQuery(filters: ReportFilters): URLSearchParams {
  const query = new URLSearchParams();
  setQuery(query, 'from', filters.from);
  setQuery(query, 'to', filters.to);
  setQuery(query, 'branch', filters.branch);
  setQuery(query, 'department', filters.department);
  setQuery(query, 'doctorId', filters.doctorId);
  return query;
}

function setQuery(query: URLSearchParams, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) {
    query.set(key, trimmed);
  }
}
