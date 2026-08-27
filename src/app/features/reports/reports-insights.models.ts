import { ApiResponse } from '../../core/auth/auth.models';

export type ReportsApiResponse<T> = ApiResponse<T>;

export interface ReportsWorkspace {
  fromDate: string;
  toDate: string;
  branch: string;
  categories: ReportCategory[];
  summary: ReportWorkspaceSummary;
  trend: ReportTrendPoint[];
  alerts: ReportAlert[];
  branches: ReportOption[];
  departments: ReportOption[];
  doctors: ReportOption[];
  generatedAt: string;
}

export interface ReportCategory {
  key: string;
  title: string;
  description: string;
  icon: string;
  tone: string;
  availableReports: number;
  reports: ReportDefinition[];
}

export interface ReportDefinition {
  key: string;
  categoryKey: string;
  title: string;
  description: string;
  icon: string;
  route: string;
}

export interface ReportWorkspaceSummary {
  patients: number;
  appointments: number;
  opdVisits: number;
  activeIpd: number;
  revenue: number;
  outstanding: number;
  generatedAt: string;
}

export interface ReportTrendPoint {
  date: string;
  primaryValue: number;
  secondaryValue: number;
  primaryLabel: string;
  secondaryLabel: string;
}

export interface ReportAlert {
  key: string;
  area: string;
  title: string;
  actionLabel: string;
  route: string;
  severity: number;
}

export interface ReportOption {
  value: string;
  label: string;
}

export interface ReportResult {
  reportKey: string;
  categoryKey: string;
  title: string;
  description: string;
  fromDate: string;
  toDate: string;
  branch: string;
  department: string;
  doctorId: string | null;
  kpis: ReportKpi[];
  trend: ReportTrendPoint[];
  table: ReportTable;
  drilldowns: ReportDrilldown[];
  generatedAt: string;
}

export interface ReportKpi {
  label: string;
  value: string;
  meta: string;
  icon: string;
  color: string;
}

export interface ReportTable {
  columns: string[];
  rows: Record<string, string>[];
}

export interface ReportDrilldown {
  label: string;
  route: string;
  icon: string;
}

export interface ReportFilters {
  from: string;
  to: string;
  branch: string;
  department: string;
  doctorId: string;
}
