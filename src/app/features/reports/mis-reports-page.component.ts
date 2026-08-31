import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ReportDefinition, ReportFilters, ReportKpi, ReportResult, ReportsWorkspace } from './reports-insights.models';
import { ReportsInsightsService } from './reports-insights.service';

type DatePreset = 'today' | '7' | '30' | 'custom';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent, AcGridLoaderComponent],
  template: `
    <section class="mis-page">
      <header class="mis-header">
        <div>
          <p class="ac-eyebrow">MIS Reports</p>
          <h1 class="ac-page-title">Management Information Reports</h1>
          <p>Consolidated patient, clinical, financial, pharmacy, and inventory reporting for hospital management.</p>
        </div>
        <div class="as-of">
          <span>Period: {{ filters().from | date:'dd MMM yyyy' }} - {{ filters().to | date:'dd MMM yyyy' }}</span>
          <small>Generated: {{ generatedAt() | date:'dd MMM yyyy, h:mm a' }}</small>
          <small>Data last updated: {{ generatedAt() | date:'h:mm a' }}</small>
        </div>
      </header>

      <section class="filter-panel ac-card">
        <label class="search-field">
          <span>Search reports</span>
          <input type="search" [ngModel]="reportSearch()" (ngModelChange)="reportSearch.set($event)" placeholder="Search MIS reports..." />
        </label>
        <div class="preset-group" aria-label="Date range">
          @for (preset of datePresets; track preset.value) {
            <button type="button" [class.active]="activePreset() === preset.value" (click)="applyPreset(preset.value)">
              {{ preset.label }}
            </button>
          }
        </div>
        <label>
          <span>From</span>
          <input type="date" [ngModel]="filters().from" (ngModelChange)="updateFilter('from', $event)" />
        </label>
        <label>
          <span>To</span>
          <input type="date" [ngModel]="filters().to" (ngModelChange)="updateFilter('to', $event)" />
        </label>
        <label>
          <span>Branch</span>
          <ac-dropdown name="misBranch" [ngModel]="filters().branch" (ngModelChange)="updateFilter('branch', $event ?? '')" [options]="branchOptions()" placeholder="All Branches" [clearable]="true" />
        </label>
        <label>
          <span>Department</span>
          <ac-dropdown name="misDepartment" [ngModel]="filters().department" (ngModelChange)="updateFilter('department', $event ?? '')" [options]="departmentOptions()" placeholder="All Departments" [clearable]="true" />
        </label>
        <label>
          <span>Doctor</span>
          <ac-dropdown name="misDoctor" [ngModel]="filters().doctorId" (ngModelChange)="updateFilter('doctorId', $event ?? '')" [options]="doctorOptions()" placeholder="All Doctors" [clearable]="true" />
        </label>
        <button type="button" class="ac-btn ac-btn-primary" (click)="refresh()" [disabled]="loading() || generating()">
          <span class="material-symbols-rounded">filter_alt</span>
          Apply
        </button>
        <button type="button" class="ac-btn ac-btn-secondary" (click)="resetFilters()" [disabled]="loading() || generating()">
          <span class="material-symbols-rounded">restart_alt</span>
          Reset
        </button>
      </section>

      @if (loading()) {
        <section class="ac-card">
          <ac-grid-loader title="Loading MIS reports..." message="Preparing management dashboard, catalogue, and filters." [compact]="true" />
        </section>
      } @else {
        <section class="summary-grid">
          @for (card of summaryCards(); track card.label) {
            <button type="button" class="summary-card ac-card" [style.--tone]="card.color" [routerLink]="['/reports/mis']" [queryParams]="{ report: card.reportKey }">
              <span class="material-symbols-rounded">{{ card.icon }}</span>
              <div>
                <small>{{ card.label }}</small>
                <strong>{{ card.value }}</strong>
                <em>{{ card.meta }}</em>
              </div>
            </button>
          }
        </section>

        <section class="catalog-panel">
          <div class="panel-title">
            <div>
              <p class="ac-eyebrow">Report Categories</p>
              <h2>Popular MIS Reports</h2>
            </div>
            <span>{{ filteredReports().length }} reports</span>
          </div>
          <div class="report-cards">
            @for (definition of filteredReports(); track definition.key) {
              <button type="button" class="report-card ac-card" [class.active]="definition.key === selectedReportKey()" (click)="selectReport(definition)">
                <span class="material-symbols-rounded">{{ definition.icon }}</span>
                <div>
                  <strong>{{ definition.title }}</strong>
                  <small>{{ definition.description }}</small>
                  <em>View Report <span class="material-symbols-rounded">arrow_forward</span></em>
                </div>
              </button>
            } @empty {
              <div class="empty-state ac-card">No MIS report matches your search.</div>
            }
          </div>
        </section>

        @if (report(); as generated) {
          <section class="viewer ac-card">
            <header class="viewer-head">
              <div>
                <p class="ac-eyebrow">{{ generated.categoryKey === 'mis' ? 'Management Report' : 'Report' }}</p>
                <h2>{{ generated.title }}</h2>
                <p>{{ generated.description }}</p>
              </div>
              <div class="viewer-actions">
                <button type="button" class="icon-action" (click)="downloadExcel(generated)" title="Export Excel">
                  <span class="material-symbols-rounded">table_view</span>
                </button>
                <button type="button" class="icon-action" (click)="downloadCsv(generated)" title="Export CSV">
                  <span class="material-symbols-rounded">download</span>
                </button>
                <button type="button" class="icon-action" (click)="printReport(generated)" title="Print or save PDF">
                  <span class="material-symbols-rounded">print</span>
                </button>
              </div>
            </header>

            @if (generating()) {
              <ac-grid-loader title="Generating MIS report..." message="Aggregating report metrics from hospital transactions." [compact]="true" />
            } @else {
              <div class="kpi-grid">
                @for (kpi of generated.kpis; track kpi.label) {
                  <article class="kpi-card" [style.--tone]="kpi.color">
                    <span class="material-symbols-rounded">{{ kpi.icon }}</span>
                    <div>
                      <small>{{ kpi.label }}</small>
                      <strong>{{ kpi.value }}</strong>
                      <em>{{ kpi.meta }}</em>
                    </div>
                  </article>
                }
              </div>

              <section class="analysis-grid">
                <article class="chart-panel">
                  <div class="panel-title compact">
                    <div>
                      <p class="ac-eyebrow">Trend</p>
                      <h3>{{ trendTitle(generated) }}</h3>
                    </div>
                    <span>{{ generated.trend.length }} days</span>
                  </div>
                  @if (generated.trend.length) {
                    <div class="bars">
                      @for (point of sampledTrend(generated); track point.date) {
                        <div class="day" [title]="(point.date | date:'dd MMM yyyy') + ': ' + point.primaryValue + ' / ' + point.secondaryValue">
                          <span class="primary" [style.height.%]="trendHeight(point.primaryValue, generated)"></span>
                          <span class="secondary" [style.height.%]="trendHeight(point.secondaryValue, generated)"></span>
                          <small>{{ point.date | date:'d' }}</small>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="empty-state compact">Trend is not available for this report yet.</div>
                  }
                </article>

                <article class="chart-panel">
                  <div class="panel-title compact">
                    <div>
                      <p class="ac-eyebrow">Distribution</p>
                      <h3>KPI mix</h3>
                    </div>
                    <span>{{ numericKpis(generated.kpis).length }} metrics</span>
                  </div>
                  <div class="mix-list">
                    @for (kpi of numericKpis(generated.kpis); track kpi.label) {
                      <div class="mix-row">
                        <span [style.background]="kpi.color"></span>
                        <strong>{{ kpi.label }}</strong>
                        <em>{{ kpi.value }}</em>
                      </div>
                    } @empty {
                      <div class="empty-state compact">No numeric KPI values available.</div>
                    }
                  </div>
                </article>
              </section>

              <section class="table-panel">
                <div class="panel-title compact">
                  <div>
                    <p class="ac-eyebrow">Detailed Report</p>
                    <h3>{{ generated.table.rows.length }} rows</h3>
                  </div>
                  <label class="record-search">
                    <span class="material-symbols-rounded">search</span>
                    <input type="search" [ngModel]="recordSearch()" (ngModelChange)="recordSearch.set($event)" placeholder="Search records..." />
                  </label>
                </div>
                <div class="table-wrap">
                  <table class="ac-table">
                    <thead>
                      <tr>
                        @for (column of generated.table.columns; track column) {
                          <th>{{ column }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of filteredRows(generated); track $index) {
                        <tr>
                          @for (column of generated.table.columns; track column) {
                            <td>{{ row[column] || '-' }}</td>
                          }
                        </tr>
                      } @empty {
                        <tr>
                          <td [attr.colspan]="generated.table.columns.length || 1">
                            <div class="empty-state compact">No records found for selected filters.</div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>

              <footer class="drilldowns">
                @for (link of generated.drilldowns; track link.route) {
                  <a class="ac-btn ac-btn-secondary" [routerLink]="link.route">
                    <span class="material-symbols-rounded">{{ link.icon }}</span>
                    {{ link.label }}
                  </a>
                }
              </footer>
            }
          </section>
        }
      }
    </section>
  `,
  styles: `
    .mis-page { display: grid; gap: 16px; }
    .mis-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .mis-header p { margin: 5px 0 0; color: var(--ac-muted); line-height: 1.45; }
    .as-of { display: grid; gap: 3px; justify-items: end; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .as-of span { color: var(--ac-text); }
    .filter-panel { display: grid; grid-template-columns: minmax(220px, 1.4fr) minmax(220px, 1fr) repeat(5, minmax(135px, 1fr)) auto auto; gap: 10px; align-items: end; padding: 12px; }
    .filter-panel label { display: grid; gap: 5px; min-width: 0; color: var(--ac-muted); font-size: 11.5px; font-weight: 850; }
    .filter-panel input { width: 100%; min-height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text); padding: 0 11px; font: inherit; font-weight: 750; }
    .preset-group { min-height: 38px; padding: 4px; border: 1px solid var(--ac-border); border-radius: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; background: var(--ac-subtle); }
    .preset-group button { border: 0; border-radius: 8px; background: transparent; color: var(--ac-muted); font: inherit; font-size: 12px; font-weight: 850; cursor: pointer; }
    .preset-group button.active { background: var(--ac-surface); color: var(--ac-primary); box-shadow: var(--ac-sh-sm); }
    .filter-panel .material-symbols-rounded, .drilldowns .material-symbols-rounded { font-size: 18px; }
    .summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    .summary-card, .report-card { --tone: var(--ac-primary); width: 100%; border: 1px solid color-mix(in srgb, var(--tone) 24%, var(--ac-border)); text-align: left; cursor: pointer; transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
    .summary-card { display: flex; gap: 10px; align-items: center; padding: 13px; }
    .summary-card:hover, .report-card:hover, .report-card.active { transform: translateY(-1px); border-color: color-mix(in srgb, var(--tone) 50%, var(--ac-border)); box-shadow: var(--ac-sh-md); }
    .summary-card > span, .report-card > span, .kpi-card > span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--tone) 13%, transparent); color: var(--tone); flex: 0 0 auto; }
    .summary-card small, .kpi-card small { color: var(--ac-muted); font-size: 11px; font-weight: 850; text-transform: uppercase; }
    .summary-card strong, .kpi-card strong { display: block; margin-top: 2px; color: var(--ac-text); font-size: 20px; line-height: 1.05; }
    .summary-card em, .kpi-card em { display: block; margin-top: 3px; color: var(--ac-muted); font-size: 11.5px; font-style: normal; }
    .panel-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .panel-title h2, .panel-title h3 { margin: 0; color: var(--ac-text); }
    .panel-title span { color: var(--ac-muted); font-size: 12px; font-weight: 850; }
    .compact { margin-bottom: 8px; align-items: center; }
    .report-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .report-card { min-height: 132px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 11px; padding: 14px; }
    .report-card strong { display: block; color: var(--ac-text); font-size: 14px; }
    .report-card small { display: block; margin-top: 5px; color: var(--ac-muted); line-height: 1.35; }
    .report-card em { display: flex; align-items: center; gap: 4px; margin-top: 12px; color: var(--ac-primary); font-size: 12px; font-style: normal; font-weight: 900; }
    .report-card em .material-symbols-rounded { font-size: 15px; }
    .viewer { display: grid; gap: 14px; padding: 14px; }
    .viewer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .viewer-head h2 { margin: 0; color: var(--ac-text); }
    .viewer-head p { margin: 5px 0 0; color: var(--ac-muted); }
    .viewer-actions { display: flex; gap: 8px; }
    .icon-action { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text); cursor: pointer; }
    .icon-action:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .kpi-card { --tone: var(--ac-primary); display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px; background: var(--ac-subtle); }
    .analysis-grid { display: grid; grid-template-columns: 1.35fr .65fr; gap: 12px; }
    .chart-panel { border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px; background: var(--ac-surface); min-width: 0; }
    .bars { height: 210px; display: grid; grid-template-columns: repeat(auto-fit, minmax(16px, 1fr)); gap: 5px; align-items: end; padding-top: 8px; border-top: 1px solid var(--ac-border); }
    .day { height: 100%; display: flex; align-items: end; justify-content: center; gap: 2px; position: relative; }
    .day span { width: 8px; min-height: 4px; border-radius: 999px 999px 0 0; }
    .day .primary { background: #2563EB; }
    .day .secondary { background: #10B981; }
    .day small { position: absolute; bottom: -18px; color: var(--ac-muted); font-size: 10px; }
    .mix-list { display: grid; gap: 10px; }
    .mix-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .mix-row span { width: 10px; height: 10px; border-radius: 999px; }
    .mix-row strong { color: var(--ac-text); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mix-row em { color: var(--ac-muted); font-size: 12px; font-style: normal; font-weight: 850; }
    .table-panel { display: grid; gap: 8px; }
    .record-search { width: min(300px, 44vw); min-height: 36px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-muted); }
    .record-search .material-symbols-rounded { font-size: 18px; }
    .record-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ac-text); font: inherit; font-size: 12.5px; font-weight: 750; }
    .table-wrap { overflow: auto; border: 1px solid var(--ac-border); border-radius: 8px; }
    .table-wrap .ac-table th, .table-wrap .ac-table td { white-space: nowrap; }
    .drilldowns { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .empty-state { border: 1px dashed var(--ac-border); border-radius: 8px; padding: 18px; color: var(--ac-muted); text-align: center; background: var(--ac-subtle); }
    .empty-state.compact { padding: 14px; font-size: 13px; }
    @media (max-width: 1280px) {
      .filter-panel { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .report-cards, .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .analysis-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .mis-header, .viewer-head, .panel-title { display: grid; justify-items: stretch; }
      .as-of { justify-items: start; }
      .filter-panel, .summary-grid, .report-cards, .kpi-grid { grid-template-columns: 1fr; }
      .record-search { width: 100%; }
      .drilldowns .ac-btn { width: 100%; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MisReportsPageComponent implements OnInit {
  private readonly service = inject(ReportsInsightsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly generating = signal(false);
  protected readonly workspace = signal<ReportsWorkspace | null>(null);
  protected readonly report = signal<ReportResult | null>(null);
  protected readonly selectedReportKey = signal('patient-mis');
  protected readonly reportSearch = signal('');
  protected readonly recordSearch = signal('');
  protected readonly activePreset = signal<DatePreset>('30');
  protected readonly filters = signal<ReportFilters>(defaultFilters());
  protected readonly datePresets: Array<{ value: DatePreset; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: '7', label: '7 Days' },
    { value: '30', label: '30 Days' },
    { value: 'custom', label: 'Custom' }
  ];

  protected readonly generatedAt = computed(() => this.report()?.generatedAt || this.workspace()?.generatedAt || new Date().toISOString());
  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Branches', value: '' },
    ...(this.workspace()?.branches ?? [])
  ]);
  protected readonly departmentOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Departments', value: '' },
    ...(this.workspace()?.departments ?? [])
  ]);
  protected readonly doctorOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Doctors', value: '' },
    ...(this.workspace()?.doctors ?? [])
  ]);
  protected readonly misReports = computed(() =>
    this.workspace()?.categories.find(category => category.key === 'mis')?.reports ?? fallbackMisReports);
  protected readonly filteredReports = computed(() => {
    const query = this.reportSearch().trim().toLowerCase();
    if (!query) {
      return this.misReports();
    }

    return this.misReports().filter(report =>
      report.title.toLowerCase().includes(query) ||
      report.description.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const reportKey = params.get('report') || 'patient-mis';
        const changed = reportKey !== this.selectedReportKey();
        this.selectedReportKey.set(reportKey);

        if (!this.workspace()) {
          void this.refresh();
          return;
        }

        if (changed) {
          void this.generateReport(false);
        }
      });
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    const response = await this.service.getMisWorkspace(this.filters());
    this.loading.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to load MIS reports', getApiErrorMessage(response, 'MIS API failed'));
      return;
    }

    this.workspace.set(response.data);
    await this.generateReport(false);
  }

  protected async generateReport(notify = true): Promise<void> {
    this.generating.set(true);
    const response = await this.service.generateMis(this.selectedReportKey(), this.filters());
    this.generating.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to generate MIS report', getApiErrorMessage(response, 'MIS API failed'));
      return;
    }

    this.report.set(response.data);
    this.recordSearch.set('');
    if (notify) {
      this.toast.success('MIS report generated', response.data.title);
    }
  }

  protected applyPreset(preset: DatePreset): void {
    this.activePreset.set(preset);
    if (preset !== 'custom') {
      this.filters.set(createPresetFilters(preset, this.filters()));
      void this.refresh();
    }
  }

  protected updateFilter(key: keyof ReportFilters, value: string): void {
    this.activePreset.set('custom');
    this.filters.update(current => ({ ...current, [key]: value }));
  }

  protected resetFilters(): void {
    this.activePreset.set('30');
    this.filters.set(defaultFilters());
    void this.refresh();
  }

  protected selectReport(report: ReportDefinition): void {
    this.selectedReportKey.set(report.key);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { report: report.key },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    void this.generateReport();
  }

  protected summaryCards(): Array<{ label: string; value: string; meta: string; icon: string; color: string; reportKey: string }> {
    const summary = this.workspace()?.summary;
    return [
      { label: 'Total Patients', value: formatNumber(summary?.patients ?? 0), meta: 'Registered in period', icon: 'groups', color: '#2563EB', reportKey: 'patient-mis' },
      { label: 'OPD Visits', value: formatNumber(summary?.opdVisits ?? 0), meta: 'Clinical encounters', icon: 'stethoscope', color: '#10B981', reportKey: 'opd-mis' },
      { label: 'IPD Admissions', value: formatNumber(summary?.activeIpd ?? 0), meta: 'Current inpatients', icon: 'hotel', color: '#0F766E', reportKey: 'ipd-mis' },
      { label: 'Appointments', value: formatNumber(summary?.appointments ?? 0), meta: 'Booked visits', icon: 'event', color: '#0891B2', reportKey: 'appointment-mis' },
      { label: 'Revenue', value: currency(summary?.revenue ?? 0), meta: 'Collected amount', icon: 'payments', color: '#7C3AED', reportKey: 'revenue-mis' },
      { label: 'Collection Due', value: currency(summary?.outstanding ?? 0), meta: 'Pending billing', icon: 'pending_actions', color: '#F59E0B', reportKey: 'revenue-mis' }
    ];
  }

  protected trendTitle(report: ReportResult): string {
    return report.trend.length ? `${report.trend[0].primaryLabel} vs ${report.trend[0].secondaryLabel}` : report.title;
  }

  protected sampledTrend(report: ReportResult): ReportResult['trend'] {
    const trend = report.trend;
    if (trend.length <= 31) {
      return trend;
    }

    const step = Math.ceil(trend.length / 31);
    return trend.filter((_, index) => index % step === 0).slice(0, 31);
  }

  protected trendHeight(value: number, report: ReportResult): number {
    const points = this.sampledTrend(report);
    const max = Math.max(1, ...points.flatMap(point => [point.primaryValue, point.secondaryValue]));
    return Math.max(4, Math.round((Number(value || 0) / max) * 100));
  }

  protected numericKpis(kpis: ReportKpi[]): ReportKpi[] {
    return kpis.filter(kpi => numericValue(kpi.value) > 0);
  }

  protected filteredRows(report: ReportResult): Record<string, string>[] {
    const search = this.recordSearch().trim().toLowerCase();
    if (!search) {
      return report.table.rows;
    }

    return report.table.rows.filter(row =>
      report.table.columns.some(column => String(row[column] ?? '').toLowerCase().includes(search)));
  }

  protected downloadCsv(report: ReportResult): void {
    this.download(report, 'text/csv;charset=utf-8;', 'csv', toCsv(report));
  }

  protected downloadExcel(report: ReportResult): void {
    const table = [
      '<table>',
      `<caption>${escapeHtml(report.title)}</caption>`,
      `<thead><tr>${report.table.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>`,
      `<tbody>${report.table.rows.map(row => `<tr>${report.table.columns.map(column => `<td>${escapeHtml(row[column] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`,
      '</table>'
    ].join('');
    this.download(report, 'application/vnd.ms-excel;charset=utf-8;', 'xls', table);
  }

  protected printReport(report: ReportResult): void {
    const popup = window.open('', '_blank', 'width=1100,height=720');
    if (!popup) {
      this.toast.warning('Print blocked', 'Allow popups to print this MIS report.');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>${escapeHtml(report.title)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            p { margin: 0 0 16px; color: #4B5563; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #D1D5DB; padding: 7px; text-align: left; }
            th { background: #F3F4F6; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(report.title)}</h1>
          <p>${escapeHtml(report.description)} | ${report.fromDate} to ${report.toDate}</p>
          ${this.reportTableHtml(report)}
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  private download(report: ReportResult, type: string, extension: string, content: string): void {
    if (!report.table.rows.length) {
      this.toast.warning('No report rows', 'Generate a report with rows before exporting.');
      return;
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.reportKey}-${report.fromDate}-to-${report.toDate}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.toast.success('Export ready', `${report.title} exported.`);
  }

  private reportTableHtml(report: ReportResult): string {
    return `<table><thead><tr>${report.table.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${report.table.rows.map(row => `<tr>${report.table.columns.map(column => `<td>${escapeHtml(row[column] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
}

const fallbackMisReports: ReportDefinition[] = [
  { key: 'patient-mis', categoryKey: 'mis', title: 'Patient MIS', description: 'Patient registrations, demographics, age groups, insurance coverage, and active status.', icon: 'groups', route: '/reports/mis?report=patient-mis' },
  { key: 'appointment-mis', categoryKey: 'mis', title: 'Appointment MIS', description: 'Appointments by completion, cancellation, no-show, doctor, and department.', icon: 'event_available', route: '/reports/mis?report=appointment-mis' },
  { key: 'opd-mis', categoryKey: 'mis', title: 'OPD MIS', description: 'OPD visits, completion, prescriptions, investigations, and doctor activity.', icon: 'stethoscope', route: '/reports/mis?report=opd-mis' },
  { key: 'ipd-mis', categoryKey: 'mis', title: 'IPD MIS', description: 'Admissions, discharges, current inpatients, and bed occupancy.', icon: 'hotel', route: '/reports/mis?report=ipd-mis' },
  { key: 'revenue-mis', categoryKey: 'mis', title: 'Revenue MIS', description: 'Gross billing, collections, outstanding amounts, and refund trends.', icon: 'payments', route: '/reports/mis?report=revenue-mis' },
  { key: 'doctor-mis', categoryKey: 'mis', title: 'Doctor MIS', description: 'Doctor-wise appointments, consultations, workload, and revenue.', icon: 'medical_services', route: '/reports/mis?report=doctor-mis' },
  { key: 'pharmacy-mis', categoryKey: 'mis', title: 'Pharmacy MIS', description: 'Medicine sales, pharmacy revenue, purchases, and daily movement.', icon: 'medication', route: '/reports/mis?report=pharmacy-mis' },
  { key: 'inventory-mis', categoryKey: 'mis', title: 'Inventory MIS', description: 'Current stock, low stock, reorder status, and category coverage.', icon: 'inventory_2', route: '/reports/mis?report=inventory-mis' }
];

function defaultFilters(): ReportFilters {
  return createPresetFilters('30', { from: '', to: '', branch: '', department: '', doctorId: '' });
}

function createPresetFilters(preset: DatePreset, current: ReportFilters): ReportFilters {
  const today = new Date();
  const from = new Date(today);
  if (preset === '7') {
    from.setDate(today.getDate() - 6);
  } else if (preset === '30') {
    from.setDate(today.getDate() - 29);
  }

  return {
    ...current,
    from: formatDateInput(preset === 'today' ? today : from),
    to: formatDateInput(today)
  };
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function numericValue(value: string): number {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function toCsv(report: ReportResult): string {
  return [
    report.table.columns.join(','),
    ...report.table.rows.map(row => report.table.columns.map(column => csvCell(row[column] ?? '')).join(','))
  ].join('\n');
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
