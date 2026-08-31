import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  QualityAudit,
  QualityDashboard,
  QualityFilters,
  QualityIndicatorResult,
  QualityMetricDefinition,
  QualityTrend,
  SaveQualityAuditRequest,
  SaveQualityEventRequest,
  SaveQualityIndicatorRequest
} from './quality-indicators.models';
import { QualityIndicatorsService } from './quality-indicators.service';

type QualityTab = 'dashboard' | 'indicators' | 'audits' | 'events' | 'builder';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent, AcGridLoaderComponent],
  template: `
    <section class="quality-page">
      <header class="quality-header">
        <div>
          <p class="ac-eyebrow">Quality & KPI</p>
          <h1 class="ac-page-title">Automated Quality Indicators</h1>
          <p>Track hospital quality indicators, capture audits and safety events, compare against targets, and push monthly results into MIS.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="ac-btn ac-btn-secondary" [routerLink]="['/reports/mis']" [queryParams]="{ report: 'patient-mis' }">
            <span class="material-symbols-rounded">analytics</span>
            MIS Reports
          </button>
          <button type="button" class="ac-btn ac-btn-primary" (click)="calculateResults()" [disabled]="loading() || calculating()">
            <span class="material-symbols-rounded">calculate</span>
            {{ calculating() ? 'Calculating...' : 'Calculate Month' }}
          </button>
        </div>
      </header>

      <section class="filter-panel ac-card">
        <label>
          <span>Month</span>
          <ac-dropdown name="qualityMonth" [ngModel]="filters().month" (ngModelChange)="updateFilter('month', $event ?? filters().month)" [options]="monthOptions" />
        </label>
        <label>
          <span>Year</span>
          <input type="number" min="2020" max="2100" [ngModel]="filters().year" (ngModelChange)="updateFilter('year', numeric($event, filters().year))" />
        </label>
        <label>
          <span>Department</span>
          <ac-dropdown name="qualityDepartment" [ngModel]="filters().department" (ngModelChange)="updateFilter('department', $event ?? '')" [options]="departmentOptions()" placeholder="All Departments" [clearable]="true" />
        </label>
        <label>
          <span>Category</span>
          <ac-dropdown name="qualityCategory" [ngModel]="filters().category" (ngModelChange)="updateFilter('category', $event ?? '')" [options]="categoryOptions()" placeholder="All Categories" [clearable]="true" />
        </label>
        <label class="search-field">
          <span>Search</span>
          <input type="search" [ngModel]="filters().search" (ngModelChange)="updateFilter('search', $event)" placeholder="Search indicators..." />
        </label>
        <button type="button" class="ac-btn ac-btn-primary" (click)="refresh()" [disabled]="loading()">
          <span class="material-symbols-rounded">filter_alt</span>
          Apply
        </button>
      </section>

      <nav class="tab-bar ac-card" aria-label="Quality workspace">
        @for (tab of tabs; track tab.value) {
          <button type="button" [class.active]="activeTab() === tab.value" (click)="activeTab.set(tab.value)">
            <span class="material-symbols-rounded">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        }
      </nav>

      @if (loading()) {
        <section class="ac-card">
          <ac-grid-loader title="Loading quality indicators..." message="Preparing indicators, trends, recent audits, and safety events." [compact]="true" />
        </section>
      } @else if (dashboard(); as model) {
        @if (activeTab() === 'dashboard') {
          <section class="summary-grid">
            @for (card of dashboardCards(model); track card.label) {
              <article class="summary-card ac-card" [style.--tone]="card.color">
                <span class="material-symbols-rounded">{{ card.icon }}</span>
                <div>
                  <small>{{ card.label }}</small>
                  <strong>{{ card.value }}</strong>
                  <em>{{ card.meta }}</em>
                </div>
              </article>
            }
          </section>

          <section class="dashboard-grid">
            <article class="score-panel ac-card">
              <div class="score-ring" [style.--score]="model.overallCompliance">
                <strong>{{ model.overallCompliance | number:'1.0-1' }}%</strong>
                <small>On-target rate</small>
              </div>
              <div>
                <p class="ac-eyebrow">Monthly Score</p>
                <h2>{{ monthName(model.month) }} {{ model.year }}</h2>
                <p>{{ model.onTarget }} indicators are on target, {{ model.attention + model.critical }} need attention, and {{ model.noData }} are waiting for source data.</p>
              </div>
            </article>

            <article class="attention-panel ac-card">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">Needs Focus</p>
                  <h2>Priority Indicators</h2>
                </div>
                <button type="button" class="icon-action" (click)="downloadIndicatorsCsv()" title="Export indicators">
                  <span class="material-symbols-rounded">download</span>
                </button>
              </div>
              <div class="priority-list">
                @for (indicator of priorityIndicators(); track indicator.indicatorId) {
                  <button type="button" class="priority-row" [class]="statusClass(indicator.statusCode)" (click)="selectIndicator(indicator)">
                    <span></span>
                    <div>
                      <strong>{{ indicator.name }}</strong>
                      <small>{{ indicator.department }} - {{ indicator.targetLabel }}</small>
                    </div>
                    <em>{{ indicator.displayValue }}</em>
                  </button>
                } @empty {
                  <div class="empty-state compact">No priority indicators for this period.</div>
                }
              </div>
            </article>
          </section>

          <section class="indicator-layout">
            <article class="indicator-table ac-card">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">Indicator Performance</p>
                  <h2>{{ filteredResults().length }} indicators</h2>
                </div>
                <span>Generated {{ model.generatedAt | date:'short' }}</span>
              </div>
              <div class="table-wrap">
                <table class="ac-table">
                  <thead>
                    <tr>
                      <th>Indicator</th>
                      <th>Value</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (indicator of filteredResults(); track indicator.indicatorId) {
                      <tr (click)="selectIndicator(indicator)" [class.selected]="selectedIndicator()?.indicatorId === indicator.indicatorId">
                        <td>
                          <strong>{{ indicator.name }}</strong>
                          <small>{{ indicator.code }} - {{ indicator.department }}</small>
                        </td>
                        <td>{{ indicator.displayValue }}</td>
                        <td>{{ indicator.targetLabel }}</td>
                        <td><span class="status-pill" [class]="statusClass(indicator.statusCode)">{{ indicator.statusLabel }}</span></td>
                        <td>{{ trendLabel(indicator) }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5"><div class="empty-state compact">No indicators match your filters.</div></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </article>

            <article class="detail-panel ac-card">
              @if (selectedIndicator(); as indicator) {
                <div class="panel-head">
                  <div>
                    <p class="ac-eyebrow">{{ indicator.code }}</p>
                    <h2>{{ indicator.name }}</h2>
                  </div>
                  <span class="status-pill" [class]="statusClass(indicator.statusCode)">{{ indicator.statusLabel }}</span>
                </div>
                <p class="detail-copy">{{ indicator.description }}</p>
                <div class="why-grid">
                  <article>
                    <small>Numerator</small>
                    <strong>{{ indicator.numerator | number:'1.0-2' }}</strong>
                  </article>
                  <article>
                    <small>Denominator</small>
                    <strong>{{ indicator.denominator === null ? 'N/A' : (indicator.denominator | number:'1.0-2') }}</strong>
                  </article>
                  <article>
                    <small>Target</small>
                    <strong>{{ indicator.targetLabel }}</strong>
                  </article>
                  <article>
                    <small>Source</small>
                    <strong>{{ indicator.sourceModule }}</strong>
                  </article>
                </div>
                <div class="trend-panel">
                  <div class="panel-head compact">
                    <div>
                      <p class="ac-eyebrow">Monthly Trend</p>
                      <h3>{{ trend()?.indicator?.name || indicator.name }}</h3>
                    </div>
                  </div>
                  @if (trend(); as trendModel) {
                    <div class="month-bars">
                      @for (point of trendModel.points; track point.month) {
                        <div class="month-bar" [title]="point.monthLabel + ': ' + point.displayValue">
                          <span [class]="statusClass(point.statusCode)" [style.height.%]="trendHeight(point.calculatedValue, trendModel.points)"></span>
                          <small>{{ point.monthLabel }}</small>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="empty-state compact">Select an indicator to load trend.</div>
                  }
                </div>
              } @else {
                <div class="empty-state">Select an indicator to inspect numerator, denominator, target, and trend.</div>
              }
            </article>
          </section>
        }

        @if (activeTab() === 'indicators') {
          <section class="master-grid">
            @for (indicator of filteredResults(); track indicator.indicatorId) {
              <button type="button" class="indicator-card ac-card" [class]="statusClass(indicator.statusCode)" (click)="selectIndicator(indicator); activeTab.set('dashboard')">
                <span class="material-symbols-rounded">{{ indicatorIcon(indicator) }}</span>
                <div>
                  <small>{{ indicator.code }} - {{ indicator.category }}</small>
                  <strong>{{ indicator.name }}</strong>
                  <p>{{ indicator.description }}</p>
                  <em>{{ indicator.calculationType }} - {{ indicator.targetLabel }}</em>
                </div>
              </button>
            }
          </section>
        }

        @if (activeTab() === 'audits') {
          <section class="entry-grid">
            <form class="entry-form ac-card" (ngSubmit)="submitAudit()">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">Audit Entry</p>
                  <h2>Submit Quality Audit</h2>
                </div>
              </div>
              <label>
                <span>Audit Type</span>
                <ac-dropdown name="auditType" [(ngModel)]="auditForm.auditType" [options]="auditTypeOptions" />
              </label>
              <label>
                <span>Audit Date</span>
                <input type="date" name="auditDate" [(ngModel)]="auditForm.auditDate" />
              </label>
              <label>
                <span>Department</span>
                <input name="auditDepartment" [(ngModel)]="auditForm.department" placeholder="ICU, OT, OPD..." />
              </label>
              <label>
                <span>Location</span>
                <input name="auditLocation" [(ngModel)]="auditForm.location" placeholder="Ward, unit, room" />
              </label>
              <div class="value-row">
                <label>
                  <span>Compliant / Performed</span>
                  <input type="number" name="auditNumerator" min="0" [(ngModel)]="auditForm.numeratorValue" />
                </label>
                <label>
                  <span>Total Opportunities</span>
                  <input type="number" name="auditDenominator" min="0" [(ngModel)]="auditForm.denominatorValue" />
                </label>
              </div>
              <label>
                <span>Auditor</span>
                <input name="auditorName" [(ngModel)]="auditForm.auditorName" placeholder="Quality officer" />
              </label>
              <label>
                <span>Notes</span>
                <textarea name="auditNotes" [(ngModel)]="auditForm.notes" rows="3" placeholder="Observations and corrective action notes"></textarea>
              </label>
              <button type="submit" class="ac-btn ac-btn-primary" [disabled]="saving()">
                <span class="material-symbols-rounded">save</span>
                Submit Audit
              </button>
            </form>

            <article class="recent-panel ac-card">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">Recent Audits</p>
                  <h2>{{ model.recentAudits.length }} entries</h2>
                </div>
              </div>
              <div class="activity-list">
                @for (audit of model.recentAudits; track audit.id) {
                  <div class="activity-row">
                    <span class="material-symbols-rounded">fact_check</span>
                    <div>
                      <strong>{{ labelize(audit.auditType) }}</strong>
                      <small>{{ audit.department }} - {{ audit.auditDate | date:'mediumDate' }} - Score {{ audit.scoreValue === null ? 'N/A' : (audit.scoreValue | number:'1.0-1') + '%' }}</small>
                    </div>
                  </div>
                } @empty {
                  <div class="empty-state compact">No audits submitted this month.</div>
                }
              </div>
            </article>
          </section>
        }

        @if (activeTab() === 'events') {
          <section class="entry-grid">
            <form class="entry-form ac-card" (ngSubmit)="submitEvent()">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">Safety Event</p>
                  <h2>Capture Quality Event</h2>
                </div>
              </div>
              <label>
                <span>Event Type</span>
                <ac-dropdown name="eventType" [(ngModel)]="eventForm.eventType" [options]="eventTypeOptions" />
              </label>
              <label>
                <span>Event Date</span>
                <input type="date" name="eventDate" [(ngModel)]="eventForm.eventDate" />
              </label>
              <label>
                <span>Department</span>
                <input name="eventDepartment" [(ngModel)]="eventForm.department" placeholder="Nursing, ICU, Laboratory..." />
              </label>
              <label>
                <span>Severity</span>
                <ac-dropdown name="severity" [(ngModel)]="eventForm.severity" [options]="severityOptions" />
              </label>
              <label>
                <span>Location</span>
                <input name="eventLocation" [(ngModel)]="eventForm.location" placeholder="Ward, unit, room" />
              </label>
              <label>
                <span>Staff</span>
                <input name="staffName" [(ngModel)]="eventForm.staffName" placeholder="Optional" />
              </label>
              <label class="span-2">
                <span>Description</span>
                <textarea name="eventDescription" [(ngModel)]="eventForm.description" rows="4" placeholder="What happened, where, and immediate action taken"></textarea>
              </label>
              <button type="submit" class="ac-btn ac-btn-primary" [disabled]="saving()">
                <span class="material-symbols-rounded">add_alert</span>
                Save Event
              </button>
            </form>

            <article class="recent-panel ac-card">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">Recent Events</p>
                  <h2>{{ model.recentEvents.length }} entries</h2>
                </div>
              </div>
              <div class="activity-list">
                @for (event of model.recentEvents; track event.id) {
                  <div class="activity-row" [class]="event.severity.toLowerCase()">
                    <span class="material-symbols-rounded">report</span>
                    <div>
                      <strong>{{ labelize(event.eventType) }}</strong>
                      <small>{{ event.department }} - {{ event.severity }} - {{ event.eventDate | date:'mediumDate' }}</small>
                      <p>{{ event.description }}</p>
                    </div>
                  </div>
                } @empty {
                  <div class="empty-state compact">No quality events captured this month.</div>
                }
              </div>
            </article>
          </section>
        }

        @if (activeTab() === 'builder') {
          <section class="builder-grid">
            <form class="entry-form ac-card" (ngSubmit)="submitKpi()">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">KPI Builder</p>
                  <h2>Create Custom KPI</h2>
                </div>
              </div>
              <label>
                <span>KPI Name</span>
                <input name="kpiName" [(ngModel)]="kpiForm.name" placeholder="Average Discharge Time" />
              </label>
              <label>
                <span>Department</span>
                <input name="kpiDepartment" [(ngModel)]="kpiForm.department" placeholder="Medical Services" />
              </label>
              <label>
                <span>Category</span>
                <input name="kpiCategory" [(ngModel)]="kpiForm.category" placeholder="Custom KPI" />
              </label>
              <label>
                <span>Calculation</span>
                <ac-dropdown name="calculationType" [(ngModel)]="kpiForm.calculationType" [options]="calculationOptions" />
              </label>
              <label>
                <span>Numerator</span>
                <ac-dropdown name="numeratorKey" [(ngModel)]="kpiForm.numeratorKey" [options]="metricOptions()" />
              </label>
              <label>
                <span>Denominator</span>
                <ac-dropdown name="denominatorKey" [(ngModel)]="kpiForm.denominatorKey" [options]="metricOptions()" [disabled]="kpiForm.calculationType === 'COUNT'" [clearable]="true" />
              </label>
              <div class="value-row">
                <label>
                  <span>Target</span>
                  <input type="number" name="targetValue" [(ngModel)]="kpiForm.targetValue" />
                </label>
                <label>
                  <span>Warning</span>
                  <input type="number" name="warningValue" [(ngModel)]="kpiForm.warningValue" />
                </label>
              </div>
              <div class="value-row">
                <label>
                  <span>Unit</span>
                  <input name="unit" [(ngModel)]="kpiForm.unit" placeholder="%, min, /1000" />
                </label>
                <label>
                  <span>Direction</span>
                  <ac-dropdown name="direction" [(ngModel)]="kpiForm.direction" [options]="directionOptions" />
                </label>
              </div>
              <label class="span-2">
                <span>Description</span>
                <textarea name="kpiDescription" [(ngModel)]="kpiForm.description" rows="3" placeholder="What this KPI measures and how management should read it"></textarea>
              </label>
              <button type="submit" class="ac-btn ac-btn-primary" [disabled]="saving()">
                <span class="material-symbols-rounded">add_chart</span>
                Save KPI
              </button>
            </form>

            <article class="source-panel ac-card">
              <div class="panel-head">
                <div>
                  <p class="ac-eyebrow">Approved Data Sources</p>
                  <h2>{{ dataSources().length }} metrics</h2>
                </div>
              </div>
              <div class="source-list">
                @for (metric of dataSources(); track metric.key) {
                  <div class="source-row">
                    <strong>{{ metric.label }}</strong>
                    <small>{{ metric.group }} - {{ metric.aggregationType }}</small>
                    <p>{{ metric.description }}</p>
                  </div>
                }
              </div>
            </article>
          </section>
        }
      }
    </section>
  `,
  styles: `
    .quality-page { display: grid; gap: 16px; }
    .quality-header, .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .quality-header p, .detail-copy { margin: 5px 0 0; color: var(--ac-muted); line-height: 1.45; }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .header-actions .material-symbols-rounded, .filter-panel .material-symbols-rounded, .entry-form .material-symbols-rounded { font-size: 18px; }
    .filter-panel { display: grid; grid-template-columns: repeat(4, minmax(145px, 1fr)) minmax(240px, 1.4fr) auto; gap: 10px; align-items: end; padding: 12px; }
    label { display: grid; gap: 5px; color: var(--ac-muted); font-size: 11.5px; font-weight: 850; min-width: 0; }
    input, textarea { width: 100%; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text); padding: 0 11px; font: inherit; font-weight: 750; outline: 0; }
    input { min-height: 38px; }
    textarea { padding-top: 9px; resize: vertical; line-height: 1.4; }
    input:focus, textarea:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent); }
    .tab-bar { display: flex; gap: 6px; padding: 6px; overflow-x: auto; }
    .tab-bar button { min-height: 38px; border: 0; border-radius: 8px; background: transparent; color: var(--ac-muted); padding: 0 12px; display: flex; align-items: center; gap: 7px; font: inherit; font-size: 12.5px; font-weight: 900; white-space: nowrap; cursor: pointer; }
    .tab-bar button.active { background: var(--ac-primary); color: #fff; box-shadow: var(--ac-sh-sm); }
    .tab-bar .material-symbols-rounded { font-size: 18px; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .summary-card { --tone: var(--ac-primary); display: flex; gap: 10px; align-items: center; padding: 13px; border-color: color-mix(in srgb, var(--tone) 24%, var(--ac-border)); }
    .summary-card > span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--tone) 13%, transparent); color: var(--tone); flex: 0 0 auto; }
    .summary-card small, .why-grid small { color: var(--ac-muted); font-size: 11px; font-weight: 850; text-transform: uppercase; }
    .summary-card strong { display: block; margin-top: 2px; color: var(--ac-text); font-size: 21px; line-height: 1.05; }
    .summary-card em { display: block; margin-top: 3px; color: var(--ac-muted); font-size: 11.5px; font-style: normal; }
    .dashboard-grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 12px; }
    .score-panel { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: center; padding: 16px; }
    .score-ring { --score: 0; width: 152px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; align-content: center; background: conic-gradient(#10B981 calc(var(--score) * 1%), #E2E8F0 0); position: relative; color: var(--ac-text); }
    .score-ring::after { content: ''; position: absolute; inset: 18px; border-radius: 50%; background: var(--ac-surface); box-shadow: inset 0 0 0 1px var(--ac-border); }
    .score-ring strong, .score-ring small { position: relative; z-index: 1; text-align: center; }
    .score-ring strong { font-size: 25px; line-height: 1; }
    .score-ring small { color: var(--ac-muted); font-size: 11px; font-weight: 850; text-transform: uppercase; }
    .score-panel h2, .attention-panel h2, .indicator-table h2, .detail-panel h2, .entry-form h2, .recent-panel h2, .source-panel h2 { margin: 0; color: var(--ac-text); }
    .score-panel p:not(.ac-eyebrow) { margin: 6px 0 0; color: var(--ac-muted); line-height: 1.45; }
    .icon-action { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text); cursor: pointer; }
    .icon-action:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .priority-list, .activity-list, .source-list { display: grid; gap: 8px; }
    .priority-row { width: 100%; min-height: 56px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); padding: 9px; text-align: left; cursor: pointer; }
    .priority-row > span { width: 9px; height: 34px; border-radius: 999px; background: var(--status); }
    .priority-row strong, .activity-row strong, .source-row strong { display: block; color: var(--ac-text); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .priority-row small, .activity-row small, .source-row small { display: block; margin-top: 2px; color: var(--ac-muted); font-size: 11.5px; }
    .priority-row em { color: var(--ac-text); font-size: 12px; font-style: normal; font-weight: 900; }
    .indicator-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(360px, .6fr); gap: 12px; align-items: start; }
    .indicator-table, .detail-panel { padding: 14px; }
    .panel-head span { color: var(--ac-muted); font-size: 12px; font-weight: 850; }
    .table-wrap { overflow: auto; border: 1px solid var(--ac-border); border-radius: 8px; }
    .ac-table tbody tr { cursor: pointer; }
    .ac-table tbody tr.selected { background: color-mix(in srgb, var(--ac-primary) 10%, transparent); }
    .ac-table td strong { display: block; color: var(--ac-text); font-size: 13px; }
    .ac-table td small { display: block; margin-top: 2px; color: var(--ac-muted); font-size: 11px; }
    .status-pill { --status: #64748B; display: inline-flex; align-items: center; min-height: 24px; border-radius: 999px; padding: 0 9px; color: var(--status); background: color-mix(in srgb, var(--status) 12%, transparent); font-size: 11.5px; font-weight: 900; white-space: nowrap; }
    .on-target { --status: #10B981; }
    .attention { --status: #F59E0B; }
    .critical { --status: #EF4444; }
    .no-data { --status: #64748B; }
    .why-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
    .why-grid article { border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; background: var(--ac-subtle); }
    .why-grid strong { display: block; margin-top: 4px; color: var(--ac-text); font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trend-panel { border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px; }
    .compact { align-items: center; margin-bottom: 8px; }
    .month-bars { height: 190px; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 5px; align-items: end; padding: 6px 0 19px; border-top: 1px solid var(--ac-border); }
    .month-bar { height: 100%; display: flex; align-items: end; justify-content: center; position: relative; }
    .month-bar span { width: 13px; min-height: 4px; border-radius: 999px 999px 0 0; background: var(--status); }
    .month-bar small { position: absolute; bottom: -19px; color: var(--ac-muted); font-size: 10px; }
    .master-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .indicator-card { --status: #64748B; min-height: 150px; border: 1px solid color-mix(in srgb, var(--status) 30%, var(--ac-border)); border-radius: 8px; background: var(--ac-surface); padding: 14px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; text-align: left; cursor: pointer; }
    .indicator-card > span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 8px; color: var(--status); background: color-mix(in srgb, var(--status) 12%, transparent); }
    .indicator-card small { color: var(--ac-muted); font-size: 11px; font-weight: 850; }
    .indicator-card strong { display: block; margin-top: 4px; color: var(--ac-text); font-size: 14px; }
    .indicator-card p { margin: 6px 0 0; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
    .indicator-card em { display: block; margin-top: 9px; color: var(--status); font-size: 11.5px; font-style: normal; font-weight: 900; }
    .entry-grid, .builder-grid { display: grid; grid-template-columns: minmax(380px, .8fr) minmax(0, 1.2fr); gap: 12px; align-items: start; }
    .entry-form, .recent-panel, .source-panel { padding: 14px; display: grid; gap: 10px; }
    .value-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .span-2 { grid-column: 1 / -1; }
    .activity-row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; background: var(--ac-surface); }
    .activity-row > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--ac-primary) 10%, transparent); color: var(--ac-primary); }
    .activity-row.high > span, .activity-row.critical > span { background: rgba(239,68,68,.12); color: #EF4444; }
    .activity-row.medium > span { background: rgba(245,158,11,.14); color: #F59E0B; }
    .activity-row p { margin: 5px 0 0; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
    .source-list { max-height: 620px; overflow: auto; padding-right: 3px; }
    .source-row { border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; background: var(--ac-surface); }
    .source-row p { margin: 5px 0 0; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
    .empty-state { border: 1px dashed var(--ac-border); border-radius: 8px; padding: 18px; color: var(--ac-muted); text-align: center; background: var(--ac-subtle); }
    .empty-state.compact { padding: 13px; font-size: 13px; }
    @media (max-width: 1280px) {
      .filter-panel, .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .dashboard-grid, .indicator-layout, .entry-grid, .builder-grid { grid-template-columns: 1fr; }
      .master-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      .quality-header, .header-actions, .panel-head, .score-panel { display: grid; }
      .filter-panel, .summary-grid, .master-grid, .value-row, .why-grid { grid-template-columns: 1fr; }
      .header-actions .ac-btn { width: 100%; }
      .score-ring { margin: 0 auto; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QualityIndicatorsPageComponent implements OnInit {
  private readonly service = inject(QualityIndicatorsService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly calculating = signal(false);
  protected readonly dashboard = signal<QualityDashboard | null>(null);
  protected readonly dataSources = signal<QualityMetricDefinition[]>([]);
  protected readonly selectedIndicator = signal<QualityIndicatorResult | null>(null);
  protected readonly trend = signal<QualityTrend | null>(null);
  protected readonly activeTab = signal<QualityTab>('dashboard');
  protected readonly filters = signal<QualityFilters>(defaultFilters());

  protected readonly tabs: Array<{ value: QualityTab; label: string; icon: string }> = [
    { value: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { value: 'indicators', label: 'Indicators', icon: 'fact_check' },
    { value: 'audits', label: 'Audits', icon: 'assignment' },
    { value: 'events', label: 'Events', icon: 'report' },
    { value: 'builder', label: 'KPI Builder', icon: 'add_chart' }
  ];

  protected readonly monthOptions: DropdownOption<number>[] = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: monthName(index + 1)
  }));
  protected readonly auditTypeOptions: DropdownOption<string>[] = [
    option('HAND_HYGIENE', 'Hand Hygiene'),
    option('SAFE_SURGERY', 'Safe Surgery Checklist'),
    option('MEDICATION_SAFETY', 'Medication Safety'),
    option('DIAGNOSTIC_SAFETY', 'Diagnostic Safety'),
    option('SAFETY_PRECAUTIONS', 'Safety Precautions'),
    option('NURSING_HANDOVER', 'Nursing Handover'),
    option('CONSENT_COMPLIANCE', 'Consent Compliance'),
    option('DISCHARGE_TIME', 'Discharge Time'),
    option('BLOOD_TRANSFUSION', 'Blood Transfusion')
  ];
  protected readonly eventTypeOptions: DropdownOption<string>[] = [
    option('MEDICATION_ERROR', 'Medication Error'),
    option('ADR', 'Adverse Drug Reaction'),
    option('LAB_REPORTING_ERROR', 'Lab Reporting Error'),
    option('PATIENT_FALL', 'Patient Fall'),
    option('NEAR_MISS', 'Near Miss'),
    option('NEEDLE_STICK_INJURY', 'Needle Stick Injury'),
    option('TRANSFUSION_REACTION', 'Transfusion Reaction'),
    option('CAUTI', 'CAUTI'),
    option('VAP', 'VAP'),
    option('CLABSI', 'CLABSI'),
    option('SSI', 'SSI'),
    option('PRESSURE_ULCER', 'Pressure Ulcer')
  ];
  protected readonly severityOptions: DropdownOption<string>[] = [
    option('LOW', 'Low'),
    option('MEDIUM', 'Medium'),
    option('HIGH', 'High'),
    option('CRITICAL', 'Critical')
  ];
  protected readonly calculationOptions: DropdownOption<string>[] = [
    option('PERCENTAGE', 'Percentage'),
    option('RATE', 'Rate'),
    option('AVERAGE', 'Average'),
    option('RATIO', 'Ratio'),
    option('COUNT', 'Count')
  ];
  protected readonly directionOptions: DropdownOption<string>[] = [
    option('LOWER_IS_BETTER', 'Lower is Better'),
    option('HIGHER_IS_BETTER', 'Higher is Better')
  ];

  protected readonly departmentOptions = computed<DropdownOption<string>[]>(() => [
    { value: '', label: 'All Departments' },
    ...uniqueOptions(this.dashboard()?.indicators.map(indicator => indicator.department) ?? ['Hospital', 'OPD', 'IPD', 'ICU', 'OT', 'Laboratory', 'Nursing', 'Pharmacy'])
  ]);
  protected readonly categoryOptions = computed<DropdownOption<string>[]>(() => [
    { value: '', label: 'All Categories' },
    ...uniqueOptions(this.dashboard()?.indicators.map(indicator => indicator.category) ?? [])
  ]);
  protected readonly filteredResults = computed(() => {
    const query = this.filters().search.trim().toLowerCase();
    const category = this.filters().category;
    return (this.dashboard()?.indicators ?? []).filter(indicator =>
      (!category || indicator.category === category) &&
      (!query ||
        indicator.name.toLowerCase().includes(query) ||
        indicator.code.toLowerCase().includes(query) ||
        indicator.description.toLowerCase().includes(query)));
  });
  protected readonly priorityIndicators = computed(() =>
    this.filteredResults().filter(indicator => indicator.statusCode === 'CRITICAL' || indicator.statusCode === 'ATTENTION').slice(0, 6));

  protected auditForm = defaultAuditForm();
  protected eventForm = defaultEventForm();
  protected kpiForm = defaultKpiForm();

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadDataSources(), this.refresh()]);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    const response = await this.service.dashboard(this.filters());
    this.loading.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to load quality indicators', getApiErrorMessage(response, 'Quality API failed'));
      return;
    }

    this.dashboard.set(response.data);
    const selected = response.data.indicators.find(indicator => indicator.indicatorId === this.selectedIndicator()?.indicatorId)
      ?? response.data.indicators.find(indicator => indicator.statusCode === 'CRITICAL')
      ?? response.data.indicators[0]
      ?? null;
    this.selectedIndicator.set(selected);
    if (selected) {
      await this.loadTrend(selected);
    }
  }

  protected async loadDataSources(): Promise<void> {
    const response = await this.service.dataSources();
    if (response.success && response.data) {
      this.dataSources.set(response.data);
    }
  }

  protected updateFilter<K extends keyof QualityFilters>(key: K, value: QualityFilters[K]): void {
    this.filters.update(filters => ({ ...filters, [key]: value }));
  }

  protected async selectIndicator(indicator: QualityIndicatorResult): Promise<void> {
    this.selectedIndicator.set(indicator);
    await this.loadTrend(indicator);
  }

  protected async loadTrend(indicator: QualityIndicatorResult): Promise<void> {
    this.trend.set(null);
    const response = await this.service.trend(indicator.indicatorId, this.filters());
    if (response.success && response.data) {
      this.trend.set(response.data);
    }
  }

  protected async calculateResults(): Promise<void> {
    this.calculating.set(true);
    const response = await this.service.calculate(this.filters());
    this.calculating.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Calculation failed', getApiErrorMessage(response, 'Unable to calculate indicators'));
      return;
    }

    this.toast.success('Quality indicators calculated', `${response.data.calculated} indicators updated for ${monthName(response.data.month)} ${response.data.year}.`);
    await this.refresh();
  }

  protected async submitAudit(): Promise<void> {
    const request: SaveQualityAuditRequest = {
      auditType: this.auditForm.auditType,
      auditDate: dateToIso(this.auditForm.auditDate),
      department: this.auditForm.department || null,
      location: this.auditForm.location || null,
      numeratorValue: Number(this.auditForm.numeratorValue || 0),
      denominatorValue: Number(this.auditForm.denominatorValue || 0),
      auditorName: this.auditForm.auditorName || null,
      notes: this.auditForm.notes || null,
      statusCode: 'SUBMITTED'
    };

    this.saving.set(true);
    const response = await this.service.createAudit(request);
    this.saving.set(false);

    if (!response.success) {
      this.toast.error('Audit not saved', getApiErrorMessage(response, 'Unable to submit audit'));
      return;
    }

    this.toast.success('Audit submitted', labelize(request.auditType));
    this.auditForm = defaultAuditForm();
    await this.refresh();
  }

  protected async submitEvent(): Promise<void> {
    const request: SaveQualityEventRequest = {
      eventType: this.eventForm.eventType,
      eventDate: dateToIso(this.eventForm.eventDate),
      department: this.eventForm.department || null,
      location: this.eventForm.location || null,
      patientId: null,
      doctorId: null,
      staffName: this.eventForm.staffName || null,
      severity: this.eventForm.severity,
      description: this.eventForm.description,
      relatedModule: null,
      relatedTransactionId: null,
      statusCode: 'OPEN'
    };

    this.saving.set(true);
    const response = await this.service.createEvent(request);
    this.saving.set(false);

    if (!response.success) {
      this.toast.error('Event not saved', getApiErrorMessage(response, 'Unable to save event'));
      return;
    }

    this.toast.success('Quality event saved', labelize(request.eventType));
    this.eventForm = defaultEventForm();
    await this.refresh();
  }

  protected async submitKpi(): Promise<void> {
    const request: SaveQualityIndicatorRequest = {
      code: null,
      name: this.kpiForm.name,
      description: this.kpiForm.description || null,
      department: this.kpiForm.department || null,
      category: this.kpiForm.category || 'Custom KPI',
      calculationType: this.kpiForm.calculationType,
      numeratorKey: this.kpiForm.numeratorKey,
      denominatorKey: this.kpiForm.calculationType === 'COUNT' ? null : this.kpiForm.denominatorKey,
      multiplier: Number(this.kpiForm.multiplier || defaultMultiplier(this.kpiForm.calculationType)),
      unit: this.kpiForm.unit || null,
      decimalPlaces: Number(this.kpiForm.decimalPlaces ?? 2),
      targetValue: nullableNumber(this.kpiForm.targetValue),
      warningValue: nullableNumber(this.kpiForm.warningValue),
      direction: this.kpiForm.direction,
      frequency: 'Monthly'
    };

    this.saving.set(true);
    const response = await this.service.createIndicator(request);
    this.saving.set(false);

    if (!response.success) {
      this.toast.error('KPI not saved', getApiErrorMessage(response, 'Unable to save KPI'));
      return;
    }

    this.toast.success('Custom KPI saved', request.name);
    this.kpiForm = defaultKpiForm();
    this.activeTab.set('indicators');
    await this.refresh();
  }

  protected metricOptions(): DropdownOption<string>[] {
    return this.dataSources().map(metric => ({ value: metric.key, label: `${metric.label} (${metric.group})` }));
  }

  protected dashboardCards(model: QualityDashboard): Array<{ label: string; value: string; meta: string; icon: string; color: string }> {
    return [
      { label: 'Indicators', value: formatNumber(model.totalIndicators), meta: 'Tracked monthly', icon: 'fact_check', color: '#2563EB' },
      { label: 'On Target', value: formatNumber(model.onTarget), meta: 'Meeting targets', icon: 'verified', color: '#10B981' },
      { label: 'Attention', value: formatNumber(model.attention), meta: 'Below warning band', icon: 'warning', color: '#F59E0B' },
      { label: 'Critical', value: formatNumber(model.critical), meta: 'Immediate action', icon: 'priority_high', color: '#EF4444' },
      { label: 'No Data', value: formatNumber(model.noData), meta: 'Needs audit/event input', icon: 'data_alert', color: '#64748B' }
    ];
  }

  protected trendHeight(value: number | null, points: Array<{ calculatedValue: number | null }>): number {
    if (value === null) {
      return 4;
    }

    const max = Math.max(1, ...points.map(point => point.calculatedValue ?? 0));
    return Math.max(4, Math.round((value / max) * 100));
  }

  protected statusClass(statusCode: string): string {
    return statusCode.toLowerCase().replace(/_/g, '-');
  }

  protected trendLabel(indicator: QualityIndicatorResult): string {
    if (indicator.trendDelta === null) {
      return 'No prior data';
    }

    const prefix = indicator.trendDelta > 0 ? '+' : '';
    return `${prefix}${indicator.trendDelta}`;
  }

  protected indicatorIcon(indicator: QualityIndicatorResult): string {
    if (indicator.category.includes('Infection')) {
      return 'health_and_safety';
    }
    if (indicator.category.includes('Medication') || indicator.category.includes('Pharmacy')) {
      return 'medication';
    }
    if (indicator.category.includes('Surgical')) {
      return 'surgical';
    }
    if (indicator.category.includes('Documentation')) {
      return 'description';
    }
    return 'monitoring';
  }

  protected downloadIndicatorsCsv(): void {
    const rows = this.filteredResults();
    if (!rows.length) {
      this.toast.warning('No rows', 'No indicators match the current filters.');
      return;
    }

    const columns = ['Code', 'Indicator', 'Department', 'Category', 'Value', 'Target', 'Status', 'Numerator', 'Denominator', 'Source'];
    const csv = [
      columns.join(','),
      ...rows.map(row => [
        row.code,
        row.name,
        row.department,
        row.category,
        row.displayValue,
        row.targetLabel,
        row.statusLabel,
        String(row.numerator),
        row.denominator === null ? 'N/A' : String(row.denominator),
        row.sourceModule
      ].map(csvCell).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `quality-indicators-${this.filters().year}-${String(this.filters().month).padStart(2, '0')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected numeric(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  protected monthName = monthName;
  protected labelize = labelize;
}

function defaultFilters(): QualityFilters {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    department: '',
    search: '',
    category: ''
  };
}

function defaultAuditForm() {
  return {
    auditType: 'HAND_HYGIENE',
    auditDate: todayInput(),
    department: 'Hospital',
    location: '',
    numeratorValue: 0,
    denominatorValue: 0,
    auditorName: '',
    notes: ''
  };
}

function defaultEventForm() {
  return {
    eventType: 'NEAR_MISS',
    eventDate: todayInput(),
    department: 'Hospital',
    location: '',
    staffName: '',
    severity: 'LOW',
    description: ''
  };
}

function defaultKpiForm() {
  return {
    name: '',
    description: '',
    department: 'Hospital',
    category: 'Custom KPI',
    calculationType: 'PERCENTAGE',
    numeratorKey: 'AUDIT:HAND_HYGIENE:NUMERATOR',
    denominatorKey: 'AUDIT:HAND_HYGIENE:DENOMINATOR',
    multiplier: 100,
    unit: '%',
    decimalPlaces: 1,
    targetValue: 90,
    warningValue: 85,
    direction: 'HIGHER_IS_BETTER'
  };
}

function option<T>(value: T, label: string): DropdownOption<T> {
  return { value, label };
}

function monthName(month: number): string {
  return new Date(2026, month - 1, 1).toLocaleString('en-IN', { month: 'short' });
}

function todayInput(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function dateToIso(value: string): string | null {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`).toISOString();
}

function labelize(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueOptions(values: string[]): DropdownOption<string>[] {
  return Array.from(new Set(values.filter(Boolean))).sort().map(value => ({ value, label: value }));
}

function nullableNumber(value: number | string | null): number | null {
  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultMultiplier(calculationType: string): number {
  return calculationType === 'PERCENTAGE' ? 100 : 1;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
