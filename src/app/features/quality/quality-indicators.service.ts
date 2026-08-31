import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  QualityApiResponse,
  QualityAudit,
  QualityCalculationRun,
  QualityDashboard,
  QualityFilters,
  QualityIndicatorDefinition,
  QualityMetricDefinition,
  QualityTrend,
  SaveQualityAuditRequest,
  SaveQualityEventRequest,
  SaveQualityIndicatorRequest,
  QualityEvent
} from './quality-indicators.models';

@Injectable({ providedIn: 'root' })
export class QualityIndicatorsService {
  private readonly api = inject(ApiClientService);

  dashboard(filters: QualityFilters): Promise<QualityApiResponse<QualityDashboard>> {
    return firstValueFrom(this.api.get<QualityApiResponse<QualityDashboard>>(`/quality/dashboard?${toPeriodQuery(filters)}`));
  }

  indicators(filters: QualityFilters): Promise<QualityApiResponse<QualityIndicatorDefinition[]>> {
    return firstValueFrom(this.api.get<QualityApiResponse<QualityIndicatorDefinition[]>>(`/quality/indicators?${toIndicatorQuery(filters)}`));
  }

  trend(indicatorId: string, filters: QualityFilters): Promise<QualityApiResponse<QualityTrend>> {
    return firstValueFrom(this.api.get<QualityApiResponse<QualityTrend>>(`/quality/indicators/${encodeURIComponent(indicatorId)}/trend?${toPeriodQuery(filters)}`));
  }

  dataSources(): Promise<QualityApiResponse<QualityMetricDefinition[]>> {
    return firstValueFrom(this.api.get<QualityApiResponse<QualityMetricDefinition[]>>('/quality/data-sources'));
  }

  createIndicator(request: SaveQualityIndicatorRequest): Promise<QualityApiResponse<QualityIndicatorDefinition>> {
    return firstValueFrom(this.api.post<QualityApiResponse<QualityIndicatorDefinition>>('/quality/indicators', request));
  }

  createEvent(request: SaveQualityEventRequest): Promise<QualityApiResponse<QualityEvent>> {
    return firstValueFrom(this.api.post<QualityApiResponse<QualityEvent>>('/quality/events', request));
  }

  createAudit(request: SaveQualityAuditRequest): Promise<QualityApiResponse<QualityAudit>> {
    return firstValueFrom(this.api.post<QualityApiResponse<QualityAudit>>('/quality/audits', request));
  }

  calculate(filters: QualityFilters): Promise<QualityApiResponse<QualityCalculationRun>> {
    return firstValueFrom(this.api.post<QualityApiResponse<QualityCalculationRun>>(`/quality/results/calculate?${toPeriodQuery(filters)}`, {}));
  }
}

function toPeriodQuery(filters: QualityFilters): URLSearchParams {
  const query = new URLSearchParams();
  query.set('year', String(filters.year));
  query.set('month', String(filters.month));
  setQuery(query, 'department', filters.department);
  return query;
}

function toIndicatorQuery(filters: QualityFilters): URLSearchParams {
  const query = toPeriodQuery(filters);
  setQuery(query, 'search', filters.search);
  setQuery(query, 'category', filters.category);
  return query;
}

function setQuery(query: URLSearchParams, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) {
    query.set(key, trimmed);
  }
}
