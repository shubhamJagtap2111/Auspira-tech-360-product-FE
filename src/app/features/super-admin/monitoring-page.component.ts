import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { MonitoringMetricCard, MonitoringSnapshot } from './monitoring.models';
import { MonitoringService } from './monitoring.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="monitoring-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Monitoring</p>
          <h1 class="ac-page-title">Platform Health Dashboard</h1>
          <p>Track CPU, memory, database health, slow queries, requests, errors, queue state, and tenant storage across the Care360 control plane.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/databases" title="Open database management">
            <span class="material-symbols-rounded">database</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh monitoring">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (snapshot(); as model) {
        <section class="metric-grid">
          @for (card of visibleMetricCards(); track card.key) {
            <article class="metric-card" [class]="statusClass(card.status)">
              <header>
                <span class="material-symbols-rounded">{{ iconFor(card.group) }}</span>
                <b>{{ card.group }}</b>
              </header>
              <strong>{{ formatMetric(card) }}</strong>
              <p>{{ card.label }}</p>
              <small>{{ card.capturedAt | date:'mediumTime' }}</small>
            </article>
          }
        </section>

        <section class="dashboard-grid">
          <article class="panel database-panel">
            <header><h2>Database</h2><span class="pill healthy">{{ healthyDatabaseCount() }} healthy</span></header>
            <table>
              <thead><tr><th>Hospital</th><th>Database</th><th>Health</th><th>Connections</th><th>Storage</th></tr></thead>
              <tbody>
                @for (db of model.databases; track db.tenantCode) {
                  <tr><td>{{ db.hospitalName }}</td><td><code>{{ db.databaseName }}</code></td><td><span class="pill" [class]="statusClass(db.health)">{{ db.health }}</span></td><td>{{ db.connections }}</td><td>{{ db.storageGb }} GB</td></tr>
                } @empty { <tr><td colspan="5" class="empty">No database telemetry.</td></tr> }
              </tbody>
            </table>
          </article>

          <article class="panel">
            <header><h2>Slow Queries</h2><span class="pill" [class.warning]="model.slowQueries.length > 0">{{ model.slowQueries.length }}</span></header>
            <table>
              <thead><tr><th>Database</th><th>Duration</th><th>Query</th><th>Time</th></tr></thead>
              <tbody>
                @for (query of model.slowQueries; track query.slowQueryId) {
                  <tr><td>{{ query.databaseName }}</td><td>{{ query.durationMs }} ms</td><td class="truncate"><code>{{ query.queryText }}</code></td><td>{{ query.occurredAt | date:'shortTime' }}</td></tr>
                } @empty { <tr><td colspan="4" class="empty">No slow queries recorded.</td></tr> }
              </tbody>
            </table>
          </article>

          <article class="panel">
            <header><h2>Requests</h2><span class="pill healthy">{{ model.requests.length }}</span></header>
            <table>
              <thead><tr><th>Method</th><th>Path</th><th>Status</th><th>Duration</th></tr></thead>
              <tbody>
                @for (request of model.requests; track request.requestId) {
                  <tr><td>{{ request.method }}</td><td class="truncate">{{ request.path }}</td><td><span class="pill" [class]="requestStatusClass(request.statusCode)">{{ request.statusCode }}</span></td><td>{{ request.durationMs }} ms</td></tr>
                } @empty { <tr><td colspan="4" class="empty">No request events recorded.</td></tr> }
              </tbody>
            </table>
          </article>

          <article class="panel">
            <header><h2>Errors</h2><span class="pill" [class.failed]="model.errors.length > 0">{{ model.errors.length }}</span></header>
            <table>
              <thead><tr><th>Source</th><th>Severity</th><th>Message</th><th>Time</th></tr></thead>
              <tbody>
                @for (error of model.errors; track error.errorId) {
                  <tr><td>{{ error.source }}</td><td><span class="pill" [class]="statusClass(error.severity)">{{ error.severity }}</span></td><td class="truncate">{{ error.message }}</td><td>{{ error.occurredAt | date:'short' }}</td></tr>
                } @empty { <tr><td colspan="4" class="empty">No platform errors recorded.</td></tr> }
              </tbody>
            </table>
          </article>

          <article class="panel">
            <header><h2>Queue</h2><span class="pill" [class.warning]="pendingQueueCount() > 0">{{ pendingQueueCount() }} pending</span></header>
            <div class="queue-list">
              @for (queue of model.queues; track queue.queueMetricId) {
                <section>
                  <strong>{{ queue.queueName }}</strong>
                  <div class="queue-counts"><span>{{ queue.pendingCount }} pending</span><span>{{ queue.processingCount }} running</span><span>{{ queue.failedCount }} failed</span></div>
                  <i [style.width.%]="queueWidth(queue.pendingCount, queue.processingCount, queue.failedCount)"></i>
                </section>
              } @empty { <p class="empty">No queues configured.</p> }
            </div>
          </article>

          <article class="panel">
            <header><h2>Storage</h2><span class="pill healthy">{{ totalStorageGb() }} GB</span></header>
            <div class="storage-list">
              @for (item of model.storage; track item.tenantId) {
                <section>
                  <header><strong>{{ item.hospitalName }}</strong><span>{{ item.usagePercent }}%</span></header>
                  <div class="bar"><i [style.width.%]="item.usagePercent"></i></div>
                  <small>{{ item.storageGb }} GB / {{ item.capacityGb }} GB</small>
                </section>
              } @empty { <p class="empty">No storage telemetry.</p> }
            </div>
          </article>
        </section>
      } @else {
        <section class="loading">Loading monitoring dashboard...</section>
      }
    </section>
  `,
  styles: [`
    .monitoring-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .metric-card, .panel { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 8px; box-shadow: var(--ac-shadow-sm); }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); max-width: 900px; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .head-actions { display: flex; gap: 8px; }
    .icon-btn { width: 38px; height: 38px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); background: var(--ac-surface); text-decoration: none; cursor: pointer; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric-card { padding: 16px; display: grid; gap: 8px; }
    .metric-card header { display: flex; justify-content: space-between; align-items: center; color: var(--ac-muted); }
    .metric-card header span { color: var(--ac-primary); }
    .metric-card strong { font-size: 28px; }
    .metric-card p, .metric-card small { margin: 0; color: var(--ac-muted); }
    .metric-card.warning { border-color: color-mix(in srgb, #c78318 45%, var(--ac-border)); }
    .metric-card.failed, .metric-card.critical { border-color: var(--ac-danger); }
    .dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
    .panel { padding: 14px; overflow: auto; }
    .panel header { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 10px; }
    .panel h2 { margin: 0; font-size: 18px; }
    .database-panel { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; min-width: 620px; }
    th, td { padding: 10px; border-bottom: 1px solid var(--ac-border); text-align: left; white-space: nowrap; }
    th { font-size: 12px; color: var(--ac-muted); text-transform: uppercase; }
    code { font-size: 12px; }
    .truncate { max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
    .pill { border-radius: 999px; padding: 4px 8px; font-size: 12px; background: var(--ac-border); color: var(--ac-text); }
    .pill.healthy, .pill.success { background: color-mix(in srgb, var(--ac-success) 14%, var(--ac-surface)); color: var(--ac-success); }
    .pill.warning { background: color-mix(in srgb, #c78318 18%, var(--ac-surface)); color: #9a5c00; }
    .pill.failed, .pill.critical { background: color-mix(in srgb, var(--ac-danger) 14%, var(--ac-surface)); color: var(--ac-danger); }
    .queue-list, .storage-list { display: grid; gap: 12px; }
    .queue-list section, .storage-list section { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); padding: 12px; display: grid; gap: 8px; }
    .queue-counts { display: flex; flex-wrap: wrap; gap: 8px; color: var(--ac-muted); font-size: 12px; }
    .queue-list i, .bar { height: 8px; border-radius: 999px; background: var(--ac-border); overflow: hidden; display: block; }
    .queue-list i { background: var(--ac-primary); }
    .bar i { display: block; height: 100%; background: var(--ac-primary); }
    .storage-list small, .empty, .loading { color: var(--ac-muted); }
    @media (max-width: 1120px) { .metric-grid, .dashboard-grid { grid-template-columns: 1fr; } .database-panel { grid-column: auto; } }
    @media (max-width: 720px) { .page-head { flex-direction: column; } }
  `]
})
export class MonitoringPageComponent implements OnInit {
  private readonly monitoringService = inject(MonitoringService);
  private readonly toast = inject(ToastService);

  protected readonly snapshot = signal<MonitoringSnapshot | null>(null);
  protected readonly visibleMetricCards = computed(() => {
    const model = this.snapshot();
    if (!model) {
      return [];
    }
    const order = ['CPU', 'Memory', 'Database', 'Slow Queries', 'Requests', 'Errors', 'Queue', 'Storage'];
    return order
      .map(group => model.metrics.find(metric => metric.group === group))
      .filter((metric): metric is MonitoringMetricCard => !!metric);
  });
  protected readonly healthyDatabaseCount = computed(() => this.snapshot()?.databases.filter(item => item.health === 'Healthy').length ?? 0);
  protected readonly pendingQueueCount = computed(() => this.snapshot()?.queues.reduce((sum, item) => sum + item.pendingCount, 0) ?? 0);
  protected readonly totalStorageGb = computed(() => this.snapshot()?.storage.reduce((sum, item) => sum + item.storageGb, 0) ?? 0);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    const response = await this.monitoringService.getSnapshot();
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load monitoring');
      return;
    }

    this.snapshot.set(response.data);
  }

  protected iconFor(group: string): string {
    return {
      CPU: 'memory',
      Memory: 'developer_board',
      Database: 'database',
      'Slow Queries': 'query_stats',
      Requests: 'route',
      Errors: 'error',
      Queue: 'pending_actions',
      Storage: 'storage'
    }[group] ?? 'monitoring';
  }

  protected formatMetric(card: MonitoringMetricCard): string {
    const value = Number.isInteger(card.value) ? card.value.toFixed(0) : card.value.toFixed(1);
    return `${value}${card.unit === '%' ? '%' : card.unit ? ` ${card.unit}` : ''}`;
  }

  protected statusClass(status: string): string {
    return status.toLowerCase();
  }

  protected requestStatusClass(statusCode: number): string {
    return statusCode >= 500 ? 'failed' : statusCode >= 400 ? 'warning' : 'healthy';
  }

  protected queueWidth(...values: number[]): number {
    const total = values.reduce((sum, item) => sum + item, 0);
    return Math.min(100, total * 10);
  }
}
