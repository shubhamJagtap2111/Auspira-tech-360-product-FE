import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ReportCategory, ReportDefinition, ReportFilters, ReportKpi, ReportResult, ReportsWorkspace } from './reports-insights.models';
import { ReportsInsightsService } from './reports-insights.service';

type DatePreset = 'today' | '7' | '30' | 'custom';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent, AcGridLoaderComponent],
  template: `
    <section class="reports-page">
      <header class="reports-header">
        <div>
          <p class="ac-eyebrow">Analytics</p>
          <h1 class="ac-page-title">Reports & Insights</h1>
          <p>Analyze clinical operations, financial performance, resources, and hospital activity.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="ac-btn ac-btn-secondary" (click)="resetFilters()">
            <span class="material-symbols-rounded">restart_alt</span>
            Reset
          </button>
          <button type="button" class="ac-btn ac-btn-secondary" (click)="refresh()" [disabled]="loading() || generating()">
            <span class="material-symbols-rounded">refresh</span>
            Refresh
          </button>
          <button type="button" class="ac-btn ac-btn-primary" (click)="exportCsv()" [disabled]="!report()?.table?.rows?.length">
            <span class="material-symbols-rounded">download</span>
            Export CSV
          </button>
        </div>
      </header>

      <section class="filter-panel ac-card">
        <div class="preset-group" aria-label="Date range">
          @for (preset of datePresets; track preset.value) {
            <button type="button" [class.active]="activePreset() === preset.value" (click)="applyPreset(preset.value)">
              {{ preset.label }}
            </button>
          }
        </div>
        <label>
          <span>From</span>
          <input type="date" [value]="filters().from" (input)="updateFilter('from', $any($event.target).value)" />
        </label>
        <label>
          <span>To</span>
          <input type="date" [value]="filters().to" (input)="updateFilter('to', $any($event.target).value)" />
        </label>
        <label>
          <span>Branch</span>
          <ac-dropdown name="reportBranch" [ngModel]="filters().branch" (ngModelChange)="updateFilter('branch', $event ?? '')" [options]="branchOptions()" placeholder="All Branches" [clearable]="true" />
        </label>
        <label>
          <span>Department</span>
          <ac-dropdown name="reportDepartment" [ngModel]="filters().department" (ngModelChange)="updateFilter('department', $event ?? '')" [options]="departmentOptions()" placeholder="All Departments" [clearable]="true" />
        </label>
        <label>
          <span>Doctor</span>
          <ac-dropdown name="reportDoctor" [ngModel]="filters().doctorId" (ngModelChange)="updateFilter('doctorId', $event ?? '')" [options]="doctorOptions()" placeholder="All Doctors" [clearable]="true" />
        </label>
        <button type="button" class="ac-btn ac-btn-primary generate-btn" (click)="generateReport()" [disabled]="generating()">
          <span class="material-symbols-rounded">play_arrow</span>
          Generate Report
        </button>
      </section>

      @if (loading()) {
        <section class="ac-card">
          <ac-grid-loader title="Loading reports..." message="Preparing dashboard metrics, report catalog, and filter lists." [compact]="true" />
        </section>
      } @else if (workspace(); as model) {
        <section class="summary-grid">
          @for (card of summaryCards(); track card.label) {
            <button type="button" class="summary-card ac-card" [style.--tone]="card.color" [routerLink]="card.route">
              <span class="material-symbols-rounded">{{ card.icon }}</span>
              <div>
                <strong>{{ card.value }}</strong>
                <small>{{ card.label }}</small>
                <em>{{ card.meta }}</em>
              </div>
            </button>
          }
        </section>

        @if (report(); as generated) {
          <section class="result-panel ac-card">
            <header class="result-head">
              <div>
                <p class="ac-eyebrow">Generated report</p>
                <h2>{{ generated.title }}</h2>
                <p>{{ generated.description }}</p>
              </div>
              <div class="result-meta">
                <span>{{ generated.fromDate | date:'dd MMM yyyy' }} - {{ generated.toDate | date:'dd MMM yyyy' }}</span>
                <small>Generated {{ generated.generatedAt | date:'short' }}</small>
              </div>
            </header>

            @if (generating()) {
              <ac-grid-loader title="Generating report..." message="Aggregating report data from module transactions." [compact]="true" />
            } @else {
              <div class="report-kpis">
                @for (kpi of generated.kpis; track kpi.label) {
                  <article class="report-kpi" [style.--tone]="kpi.color">
                    <span class="material-symbols-rounded">{{ kpi.icon }}</span>
                    <div>
                      <small>{{ kpi.label }}</small>
                      <strong>{{ kpi.value }}</strong>
                      <em>{{ kpi.meta }}</em>
                    </div>
                  </article>
                }
              </div>

              <section class="analytics-grid">
                @if (generated.trend.length) {
                  <section class="chart-panel trend-panel">
                    <div class="panel-head compact">
                      <div>
                        <p class="ac-eyebrow">Trend</p>
                        <h3>{{ generated.trend[0].primaryLabel }} vs {{ generated.trend[0].secondaryLabel }}</h3>
                      </div>
                      <span>{{ generated.trend.length }} days</span>
                    </div>
                    <div class="trend-chart">
                      @for (point of generated.trend; track point.date) {
                        <div class="trend-day" [title]="(point.date | date:'dd MMM') + ': ' + point.primaryValue + ' / ' + point.secondaryValue">
                          <div class="bars">
                            <span class="bar primary" [style.height.%]="trendHeight(point.primaryValue, generated.trend)"></span>
                            <span class="bar secondary" [style.height.%]="trendHeight(point.secondaryValue, generated.trend)"></span>
                          </div>
                          <small>{{ point.date | date:'dd MMM' }}</small>
                        </div>
                      }
                    </div>
                    <div class="chart-legend">
                      <span><i class="primary"></i>{{ generated.trend[0].primaryLabel }}</span>
                      <span><i class="secondary"></i>{{ generated.trend[0].secondaryLabel }}</span>
                    </div>
                  </section>
                }

                <section class="chart-panel donut-panel">
                  <div class="panel-head compact">
                    <div>
                      <p class="ac-eyebrow">Mix</p>
                      <h3>KPI distribution</h3>
                    </div>
                    <span>{{ generated.kpis.length }} KPIs</span>
                  </div>
                  <div class="donut-layout">
                    <div class="donut-chart" [style.background]="pieChartBackground(generated.kpis)">
                      <strong>{{ distributionTotal(generated.kpis) }}</strong>
                      <small>Total</small>
                    </div>
                    <div class="legend-list">
                      @for (slice of pieSlices(generated.kpis); track slice.label) {
                        <div class="legend-row">
                          <i [style.background]="slice.color"></i>
                          <div>
                            <strong>{{ slice.label }}</strong>
                            <small>{{ slice.display }}</small>
                          </div>
                        </div>
                      } @empty {
                        <div class="empty-state compact">No numeric KPI values for this report.</div>
                      }
                    </div>
                  </div>
                </section>
              </section>

              @if (model.alerts.length) {
                <section class="alert-strip">
                  @for (alert of model.alerts; track alert.key) {
                    <a [routerLink]="alert.route" class="alert-row">
                      <span class="material-symbols-rounded">warning</span>
                      <div>
                        <strong>{{ alert.title }}</strong>
                        <small>{{ alert.area }} · {{ alert.actionLabel }}</small>
                      </div>
                    </a>
                  }
                </section>
              }

              <section class="table-panel">
                <div class="panel-head compact">
                  <div>
                    <p class="ac-eyebrow">Records</p>
                    <h3>Detailed data</h3>
                  </div>
                  <span>{{ generated.table.rows.length }} rows</span>
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
                      @for (row of generated.table.rows; track $index) {
                        <tr>
                          @for (column of generated.table.columns; track column) {
                            <td>{{ row[column] || '-' }}</td>
                          }
                        </tr>
                      } @empty {
                        <tr>
                          <td [attr.colspan]="generated.table.columns.length || 1">
                            <div class="empty-state compact">No rows found for selected filters.</div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>

              <footer class="drilldown-row">
                @for (link of generated.drilldowns; track link.route) {
                  <a class="ac-btn ac-btn-secondary" [routerLink]="link.route">
                    <span class="material-symbols-rounded">{{ link.icon }}</span>
                    {{ link.label }}
                  </a>
                }
                <button type="button" class="ac-btn ac-btn-primary" (click)="exportCsv()" [disabled]="!generated.table.rows.length">
                  <span class="material-symbols-rounded">download</span>
                  Export CSV
                </button>
              </footer>
            }
          </section>
        } @else {
          <section class="result-panel ac-card">
            <ac-grid-loader title="Preparing dashboard..." message="Loading the selected dashboard and report data." [compact]="true" />
          </section>
        }
      }
    </section>
  `,
  styles: `
    .reports-page { display: grid; gap: 16px; }
    .reports-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .reports-header p { margin: 5px 0 0; color: var(--ac-muted); line-height: 1.45; }
    .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .header-actions .material-symbols-rounded, .generate-btn .material-symbols-rounded, .drilldown-row .material-symbols-rounded { font-size: 18px; }

    .filter-panel {
      display: grid;
      grid-template-columns: minmax(240px, 1.2fr) repeat(5, minmax(150px, 1fr)) auto;
      gap: 10px;
      align-items: end;
      padding: 12px;
    }
    .filter-panel label { display: grid; gap: 5px; min-width: 0; color: var(--ac-muted); font-size: 11.5px; font-weight: 850; }
    .filter-panel input {
      width: 100%;
      min-height: 38px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      color: var(--ac-text);
      padding: 0 11px;
      font: inherit;
      font-weight: 750;
    }
    .preset-group {
      min-height: 38px;
      padding: 4px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      background: var(--ac-subtle);
    }
    .preset-group button {
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--ac-muted);
      font: inherit;
      font-size: 12px;
      font-weight: 850;
      cursor: pointer;
    }
    .preset-group button.active { background: var(--ac-surface); color: var(--ac-primary); box-shadow: var(--ac-sh-sm); }
    .generate-btn { min-height: 38px; white-space: nowrap; }

    .summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    .summary-card {
      --tone: var(--ac-primary);
      border: 1px solid color-mix(in srgb, var(--ac-border) 84%, var(--tone));
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 78px;
      padding: 12px;
      text-align: left;
      cursor: pointer;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }
    .summary-card:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--tone) 34%, var(--ac-border)); box-shadow: 0 14px 30px rgba(15,23,42,.075); }
    .summary-card > .material-symbols-rounded {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 11%, var(--ac-surface));
      flex: 0 0 38px;
    }
    .summary-card strong { display: block; color: var(--ac-text); font-size: 22px; line-height: 1; overflow-wrap: anywhere; }
    .summary-card small { display: block; margin-top: 3px; color: var(--ac-muted); font-size: 12px; font-weight: 850; }
    .summary-card em { display: block; margin-top: 3px; color: var(--ac-text-2); font-size: 11px; font-style: normal; font-weight: 700; }

    .result-panel { padding: 14px; }
    .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
    .panel-head h2, .panel-head h3 { margin: 2px 0 0; color: var(--ac-text); font-size: 17px; }
    .panel-head.compact { margin: 0 0 10px; }
    .panel-head.compact h3 { font-size: 15px; }
    .panel-head > span, .result-meta span {
      border: 1px solid var(--ac-border);
      border-radius: 999px;
      padding: 5px 9px;
      color: var(--ac-muted);
      background: var(--ac-subtle);
      font-size: 11.5px;
      font-weight: 800;
      white-space: nowrap;
    }

    .alert-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
    .alert-row {
      width: 100%;
      border: 1px solid #FED7AA;
      border-radius: 10px;
      background: #FFFBEB;
      color: inherit;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      padding: 12px;
      text-align: left;
      text-decoration: none;
      transition: border-color .16s ease, background .16s ease, transform .16s ease;
    }
    .alert-row:hover { transform: translateY(-1px); border-color: #FDBA74; }
    .alert-row > .material-symbols-rounded {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: #D97706;
      background: #FEF3C7;
    }
    .alert-row strong { display: block; color: var(--ac-text); font-size: 13.5px; }
    .alert-row small { display: block; margin-top: 4px; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }

    .result-panel { display: grid; gap: 14px; }
    .result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; border-bottom: 1px solid var(--ac-border); padding-bottom: 14px; }
    .result-head h2 { margin: 2px 0 0; color: var(--ac-text); font-size: 22px; }
    .result-head p { margin: 5px 0 0; color: var(--ac-muted); }
    .result-meta { display: grid; justify-items: end; gap: 5px; color: var(--ac-muted); font-size: 12px; }
    .report-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .report-kpi {
      --tone: var(--ac-primary);
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 86px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 84%, var(--tone));
      border-radius: 12px;
      padding: 12px;
      background: linear-gradient(145deg, var(--ac-surface), color-mix(in srgb, var(--tone) 5%, var(--ac-surface)));
    }
    .report-kpi > .material-symbols-rounded {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 10%, var(--ac-surface));
      flex: 0 0 38px;
    }
    .report-kpi small { display: block; color: var(--ac-muted); font-size: 11.5px; font-weight: 850; text-transform: uppercase; }
    .report-kpi strong { display: block; margin-top: 3px; color: var(--ac-text); font-size: 22px; line-height: 1; overflow-wrap: anywhere; }
    .report-kpi em { display: block; margin-top: 5px; color: var(--ac-text-2); font-size: 11.5px; font-style: normal; line-height: 1.25; }

    .analytics-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .85fr); gap: 12px; align-items: stretch; }
    .chart-panel, .table-panel { border: 1px solid var(--ac-border); border-radius: 12px; padding: 12px; background: var(--ac-surface); min-width: 0; }
    .trend-panel { background: linear-gradient(180deg, var(--ac-surface), color-mix(in srgb, var(--ac-primary) 3%, var(--ac-surface))); }
    .trend-chart { min-height: 156px; display: grid; grid-template-columns: repeat(auto-fit, minmax(30px, 1fr)); gap: 7px; align-items: end; padding-top: 6px; }
    .trend-day { display: grid; gap: 6px; justify-items: center; min-width: 0; }
    .bars { height: 108px; width: 100%; display: flex; align-items: end; justify-content: center; gap: 3px; border-bottom: 1px solid var(--ac-border); }
    .bar { width: 10px; min-height: 3px; border-radius: 999px 999px 0 0; }
    .bar.primary { background: var(--ac-primary); }
    .bar.secondary { background: #10B981; }
    .trend-day small { color: var(--ac-muted); font-size: 10.5px; white-space: nowrap; }
    .chart-legend { display: flex; align-items: center; gap: 14px; margin-top: 10px; color: var(--ac-muted); font-size: 11.5px; font-weight: 800; }
    .chart-legend span { display: inline-flex; align-items: center; gap: 6px; }
    .chart-legend i { width: 9px; height: 9px; border-radius: 999px; }
    .chart-legend i.primary { background: var(--ac-primary); }
    .chart-legend i.secondary { background: #10B981; }
    .donut-panel { background: linear-gradient(145deg, var(--ac-surface), color-mix(in srgb, #10B981 4%, var(--ac-surface))); }
    .donut-layout { display: grid; grid-template-columns: 138px minmax(0, 1fr); gap: 14px; align-items: center; min-height: 166px; }
    .donut-chart {
      position: relative;
      width: 138px;
      height: 138px;
      border-radius: 50%;
      display: grid;
      place-content: center;
      color: var(--ac-text);
      text-align: center;
      box-shadow: inset 0 0 0 1px rgba(15,23,42,.06), 0 16px 34px rgba(15,23,42,.08);
    }
    .donut-chart::after {
      content: '';
      position: absolute;
      inset: 24px;
      border-radius: 50%;
      background: var(--ac-surface);
      box-shadow: inset 0 0 0 1px var(--ac-border);
    }
    .donut-chart strong, .donut-chart small { position: relative; z-index: 1; text-align: center; }
    .donut-chart strong { display: block; font-size: 20px; line-height: 1; }
    .donut-chart small { display: block; margin-top: 4px; color: var(--ac-muted); font-size: 10.5px; font-weight: 850; text-transform: uppercase; }
    .legend-list { display: grid; gap: 8px; min-width: 0; }
    .legend-row { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; }
    .legend-row i { width: 10px; height: 10px; border-radius: 999px; }
    .legend-row strong { display: block; color: var(--ac-text); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .legend-row small { display: block; margin-top: 1px; color: var(--ac-muted); font-size: 11px; font-weight: 750; }
    .table-wrap { overflow: auto; border: 1px solid var(--ac-border); border-radius: 10px; }
    .table-wrap .ac-table th, .table-wrap .ac-table td { white-space: nowrap; }
    .drilldown-row { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .empty-state { border: 1px dashed var(--ac-border); border-radius: 10px; padding: 18px; color: var(--ac-muted); text-align: center; background: var(--ac-subtle); }
    .empty-state.compact { padding: 14px; font-size: 13px; }

    @media (max-width: 1280px) {
      .filter-panel { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .report-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .analytics-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .reports-header, .result-head { display: grid; }
      .header-actions, .drilldown-row { justify-content: stretch; }
      .header-actions .ac-btn, .drilldown-row .ac-btn { width: 100%; }
      .filter-panel, .summary-grid, .report-kpis, .analytics-grid, .donut-layout { grid-template-columns: 1fr; }
      .donut-chart { margin: 0 auto; }
      .result-meta { justify-items: start; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsInsightsPageComponent implements OnInit {
  private readonly service = inject(ReportsInsightsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly generating = signal(false);
  protected readonly workspace = signal<ReportsWorkspace | null>(null);
  protected readonly report = signal<ReportResult | null>(null);
  protected readonly selectedCategoryKey = signal('dashboards');
  protected readonly selectedReportKey = signal('dashboard-overview');
  protected readonly activePreset = signal<DatePreset>('30');
  protected readonly filters = signal<ReportFilters>(defaultFilters());
  protected readonly datePresets: Array<{ value: DatePreset; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: '7', label: '7 Days' },
    { value: '30', label: '30 Days' },
    { value: 'custom', label: 'Custom' }
  ];

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

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const reportKey = params.get('report') || 'dashboard-overview';
        const changedReport = reportKey !== this.selectedReportKey();
        this.selectedReportKey.set(reportKey);

        if (!this.workspace()) {
          void this.refresh();
          return;
        }

        this.syncCategoryFromReport();
        if (changedReport) {
          void this.generateReport(false);
        }
      });
  }

  protected async refresh(): Promise<void> {
    await this.loadWorkspace();
    this.syncCategoryFromReport();
    await this.generateReport(false);
  }

  protected async loadWorkspace(): Promise<void> {
    this.loading.set(true);
    const response = await this.service.getWorkspace(this.filters());
    this.loading.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to load reports', getApiErrorMessage(response, 'Reports API failed'));
      return;
    }

    this.workspace.set(response.data);
  }

  protected async generateReport(notify = true): Promise<void> {
    this.generating.set(true);
    const response = await this.service.generate(this.selectedReportKey(), this.filters());
    this.generating.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to generate report', getApiErrorMessage(response, 'Reports API failed'));
      return;
    }

    this.report.set(response.data);
    this.syncCategoryFromReport();
    if (notify) {
      this.toast.success('Report generated', response.data.title);
    }
  }

  protected applyPreset(preset: DatePreset): void {
    this.activePreset.set(preset);
    if (preset === 'custom') {
      return;
    }

    this.filters.set(createPresetFilters(preset, this.filters()));
    void this.refresh();
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

  protected selectCategory(category: ReportCategory): void {
    this.selectedCategoryKey.set(category.key);
    const nextReport = category.reports[0];
    if (nextReport) {
      this.selectReport(nextReport);
    }
  }

  protected selectReport(report: ReportDefinition): void {
    const isCurrentReport = report.key === this.selectedReportKey();
    this.selectedCategoryKey.set(report.categoryKey);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { report: report.key },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    if (isCurrentReport) {
      void this.generateReport();
    }
  }

  protected reportsForSelectedCategory(): ReportDefinition[] {
    const category = this.workspace()?.categories.find(item => item.key === this.selectedCategoryKey());
    return category?.reports ?? [];
  }

  protected summaryCards(): Array<{ label: string; value: string; meta: string; icon: string; color: string; route: string }> {
    const summary = this.workspace()?.summary;
    return [
      { label: 'Patients', value: formatNumber(summary?.patients ?? 0), meta: 'Registered in range', icon: 'groups', color: '#2563EB', route: '/patients' },
      { label: 'Appointments', value: formatNumber(summary?.appointments ?? 0), meta: 'Booked visits', icon: 'event', color: '#0891B2', route: '/appointments' },
      { label: 'OPD Visits', value: formatNumber(summary?.opdVisits ?? 0), meta: 'Clinical encounters', icon: 'stethoscope', color: '#10B981', route: '/opd' },
      { label: 'Active IPD', value: formatNumber(summary?.activeIpd ?? 0), meta: 'Current admissions', icon: 'bed', color: '#0F766E', route: '/ipd' },
      { label: 'Revenue', value: currency(summary?.revenue ?? 0), meta: 'Collected amount', icon: 'payments', color: '#7C3AED', route: '/billing' },
      { label: 'Outstanding', value: currency(summary?.outstanding ?? 0), meta: 'Pending bills', icon: 'pending_actions', color: '#F59E0B', route: '/billing' }
    ];
  }

  protected trendHeight(value: number, points: Array<{ primaryValue: number; secondaryValue: number }>): number {
    const max = Math.max(1, ...points.flatMap(point => [point.primaryValue, point.secondaryValue]));
    return Math.max(4, Math.round((Number(value || 0) / max) * 100));
  }

  protected pieSlices(kpis: ReportKpi[]): Array<{ label: string; display: string; value: number; percent: number; color: string }> {
    const values = kpis
      .map(kpi => ({ label: kpi.label, display: kpi.value, value: numericValue(kpi.value), color: kpi.color }))
      .filter(item => item.value > 0);
    const total = values.reduce((sum, item) => sum + item.value, 0);

    if (!total) {
      return [];
    }

    return values.map(item => ({
      ...item,
      percent: (item.value / total) * 100
    }));
  }

  protected pieChartBackground(kpis: ReportKpi[]): string {
    const slices = this.pieSlices(kpis);
    let cursor = 0;
    const parts = slices.map(slice => {
      const start = cursor;
      cursor += slice.percent;
      return `${slice.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    return parts.length ? `conic-gradient(${parts.join(', ')})` : 'conic-gradient(#E2E8F0 0% 100%)';
  }

  protected distributionTotal(kpis: ReportKpi[]): string {
    const total = this.pieSlices(kpis).reduce((sum, slice) => sum + slice.value, 0);
    return total ? formatNumber(total) : '0';
  }

  protected exportCsv(): void {
    const current = this.report();
    if (!current?.table.rows.length) {
      this.toast.warning('No report rows', 'Generate a report with rows before exporting.');
      return;
    }

    const csv = [
      current.table.columns.join(','),
      ...current.table.rows.map(row => current.table.columns.map(column => csvCell(row[column] ?? '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${current.reportKey}-${current.fromDate}-to-${current.toDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.toast.success('Export ready', `${current.title} CSV downloaded.`);
  }

  private syncCategoryFromReport(): void {
    const selected = this.workspace()?.categories
      .flatMap(category => category.reports)
      .find(report => report.key === this.selectedReportKey());
    if (selected) {
      this.selectedCategoryKey.set(selected.categoryKey);
    }
  }
}

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

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
