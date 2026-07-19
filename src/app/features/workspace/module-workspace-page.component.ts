import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  standalone: true,
  template: `
    <div class="workspace">

      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <p class="ac-eyebrow">Module</p>
          <h1 class="ac-page-title">{{ title }}</h1>
          <p class="page-desc">Enterprise-grade workflow surface connected to the Care360 API and PostgreSQL schema.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary">
            <span class="material-symbols-rounded" style="font-size:16px">filter_list</span>
            Filter
          </button>
          <button class="ac-btn ac-btn-primary" (click)="toast.success('New record', 'Create workflow opening...')">
            <span class="material-symbols-rounded" style="font-size:16px">add</span>
            New Record
          </button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-row">
        @for (m of metricCards; track m.label) {
          <div class="mini-kpi ac-card">
            <div class="mini-kpi-icon" [style.background]="m.bg" [style.color]="m.color">
              <span class="material-symbols-rounded msf" style="font-size:18px">{{ m.icon }}</span>
            </div>
            <div>
              <p class="mini-kpi-value">{{ m.value }}</p>
              <p class="mini-kpi-label">{{ m.label }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Capabilities Grid -->
      <div class="caps-grid">
        @for (cap of capabilities; track cap) {
          <div class="cap-card ac-card">
            <div class="cap-icon">
              <span class="material-symbols-rounded msf" style="font-size:20px;color:var(--ac-primary)">check_circle</span>
            </div>
            <p class="cap-name">{{ cap }}</p>
            <p class="cap-desc">Workflow and API surface prepared for enterprise healthcare operations.</p>
            <button class="cap-btn" (click)="toast.info(cap, 'Opening ' + cap + ' workflow...')">
              Open →
            </button>
          </div>
        }
      </div>

      <!-- Today's Workflow Table -->
      <section class="ac-card workflow-card">
        <div class="workflow-head">
          <div>
            <h2 class="ac-section-title">Today's Workflow</h2>
            <p class="wf-sub">Live records from {{ title }}</p>
          </div>
          <div style="display:flex;gap:10px">
            <button class="ac-btn ac-btn-secondary" style="height:34px;font-size:13px">
              <span class="material-symbols-rounded" style="font-size:15px">download</span>
              Export
            </button>
            <span class="ac-badge ac-badge-primary">Connected API</span>
          </div>
        </div>

        <div class="table-wrap">
          <table class="ac-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Description</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.ref) {
                <tr>
                  <td>
                    <span class="ref-chip">{{ row.ref }}</span>
                  </td>
                  <td style="color:var(--ac-text)">{{ row.description }}</td>
                  <td>{{ row.owner }}</td>
                  <td>
                    <span class="status-badge" [class]="'sb-' + row.statusColor">{{ row.status }}</span>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="tbl-btn" title="View">
                        <span class="material-symbols-rounded" style="font-size:16px">visibility</span>
                      </button>
                      <button class="tbl-btn" title="Edit">
                        <span class="material-symbols-rounded" style="font-size:16px">edit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="table-footer">
          <span class="table-count">Showing 4 of 24 records</span>
          <div class="pagination">
            <button class="page-btn" disabled>
              <span class="material-symbols-rounded" style="font-size:16px">chevron_left</span>
            </button>
            <span class="page-num active">1</span>
            <span class="page-num">2</span>
            <span class="page-num">3</span>
            <button class="page-btn">
              <span class="material-symbols-rounded" style="font-size:16px">chevron_right</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .workspace {
      display: flex; flex-direction: column; gap: 24px;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* Header */
    .page-header {
      display: flex; align-items: flex-start;
      justify-content: space-between; gap: 16px; flex-wrap: wrap;
    }
    .page-desc { font-size: 13.5px; color: var(--ac-muted); margin-top: 5px; max-width: 520px; }
    .header-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }

    /* KPIs */
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    @media (max-width: 900px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .kpi-row { grid-template-columns: 1fr; } }
    .mini-kpi { display: flex; align-items: center; gap: 14px; padding: 16px 18px; }
    .mini-kpi-icon { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ac-r-sm); flex-shrink: 0; }
    .mini-kpi-value { font-size: 22px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.02em; }
    .mini-kpi-label { font-size: 12px; color: var(--ac-muted); margin-top: 2px; }

    /* Capabilities */
    .caps-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    @media (max-width: 1200px) { .caps-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 900px)  { .caps-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .caps-grid { grid-template-columns: 1fr; } }
    .cap-card { padding: 18px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s ease; }
    .cap-card:hover { box-shadow: var(--ac-sh-md); transform: translateY(-2px); }
    .cap-icon { display: flex; }
    .cap-name { font-size: 13.5px; font-weight: 700; color: var(--ac-text); }
    .cap-desc { font-size: 12px; color: var(--ac-muted); line-height: 1.5; flex: 1; }
    .cap-btn { border: none; background: none; color: var(--ac-primary); font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; text-align: left; }
    .cap-btn:hover { text-decoration: underline; }

    /* Workflow */
    .workflow-card { overflow: hidden; }
    .workflow-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 18px 20px; border-bottom: 1px solid var(--ac-border);
    }
    .wf-sub { font-size: 12px; color: var(--ac-muted); margin-top: 2px; }
    .table-wrap { overflow-x: auto; }
    .ref-chip {
      display: inline-flex; align-items: center;
      padding: 3px 10px; border-radius: var(--ac-r-sm);
      background: var(--ac-primary-light); color: var(--ac-primary);
      font-size: 12px; font-weight: 700; font-family: monospace;
    }
    .status-badge {
      display: inline-flex; padding: 3px 10px; border-radius: var(--ac-r-full);
      font-size: 11.5px; font-weight: 700;
    }
    .sb-blue   { background: var(--ac-primary-light);  color: var(--ac-primary); }
    .sb-green  { background: var(--ac-success-light);  color: var(--ac-success); }
    .sb-amber  { background: var(--ac-warning-light);  color: var(--ac-warning); }
    .sb-purple { background: var(--ac-secondary-light); color: var(--ac-secondary); }
    .tbl-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: var(--ac-r-sm);
      border: 1px solid var(--ac-border); background: var(--ac-surface);
      color: var(--ac-muted); cursor: pointer; transition: all var(--ac-t);
    }
    .tbl-btn:hover { background: var(--ac-surface-2); color: var(--ac-text); border-color: var(--ac-border-2); }
    .table-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-top: 1px solid var(--ac-border); flex-wrap: wrap; gap: 12px;
    }
    .table-count { font-size: 12.5px; color: var(--ac-muted); }
    .pagination { display: flex; align-items: center; gap: 4px; }
    .page-btn {
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: var(--ac-r-sm);
      border: 1px solid var(--ac-border); background: var(--ac-surface);
      color: var(--ac-muted); cursor: pointer; transition: all var(--ac-t);
    }
    .page-btn:hover:not(:disabled) { background: var(--ac-surface-2); }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-num {
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: var(--ac-r-sm);
      font-size: 13px; color: var(--ac-muted); cursor: pointer; transition: all var(--ac-t);
    }
    .page-num:hover { background: var(--ac-surface-2); }
    .page-num.active { background: var(--ac-primary); color: #fff; font-weight: 700; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleWorkspacePageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly toast = inject(ToastService);

  protected readonly title        = this.route.snapshot.data['title']        as string;
  protected readonly capabilities = this.route.snapshot.data['capabilities'] as string[];

  protected readonly metricCards = [
    { label: 'Open Items',   value: '24',  icon: 'pending_actions', bg: 'rgba(37,99,235,0.08)',  color: '#2563EB' },
    { label: 'Completed',    value: '118', icon: 'task_alt',        bg: 'rgba(16,185,129,0.08)', color: '#10B981' },
    { label: 'Alerts',       value: '7',   icon: 'warning',         bg: 'rgba(245,158,11,0.08)', color: '#F59E0B' },
    { label: 'This Month',   value: '342', icon: 'bar_chart',       bg: 'rgba(124,58,237,0.08)', color: '#7C3AED' }
  ];

  protected readonly rows = [
    { ref: 'AC-1001', description: this.capabilities[0] ?? 'Workflow item', owner: 'Front Desk',   status: 'Open',        statusColor: 'blue'   },
    { ref: 'AC-1002', description: this.capabilities[1] ?? 'Workflow item', owner: 'Clinical Team',status: 'In Progress', statusColor: 'purple' },
    { ref: 'AC-1003', description: this.capabilities[2] ?? 'Workflow item', owner: 'Operations',   status: 'Completed',   statusColor: 'green'  },
    { ref: 'AC-1004', description: this.capabilities[3] ?? 'Workflow item', owner: 'Accounts',     status: 'Review',      statusColor: 'amber'  }
  ];
}
