import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="dashboard">

      <!-- ── Welcome Banner ── -->
      <div class="welcome-bar">
        <div class="welcome-left">
          <p class="ac-eyebrow">{{ todayDate }}</p>
          <h1 class="ac-page-title">{{ greeting }}, Dr. John 👋</h1>
          <p class="welcome-sub">Here's what's happening at City General Hospital today.</p>
        </div>
        <div class="welcome-actions">
          <button class="ac-btn ac-btn-secondary" (click)="toast.info('Coming soon', 'Reports module is being prepared.')">
            <span class="material-symbols-rounded" style="font-size:16px">analytics</span>
            View Reports
          </button>
          <button class="ac-btn ac-btn-primary" routerLink="/appointments" (click)="toast.success('Redirecting', 'Opening appointment scheduler.')">
            <span class="material-symbols-rounded" style="font-size:16px">add</span>
            New Appointment
          </button>
        </div>
      </div>

      <!-- ── KPI Cards ── -->
      <div class="kpi-grid">
        @for (card of kpiCards; track card.label) {
          <div class="kpi-card ac-card" [style.--accent]="card.color">
            <div class="kpi-top">
              <div class="kpi-icon" [style.background]="card.bg" [style.color]="card.color">
                <span class="material-symbols-rounded msf" style="font-size:22px">{{ card.icon }}</span>
              </div>
              <div class="kpi-trend" [class.up]="card.trendUp" [class.down]="!card.trendUp">
                <span class="material-symbols-rounded" style="font-size:14px">
                  {{ card.trendUp ? 'trending_up' : 'trending_down' }}
                </span>
                {{ card.growth }}
              </div>
            </div>
            <p class="kpi-value">{{ card.value }}</p>
            <p class="kpi-label">{{ card.label }}</p>
            <p class="kpi-sub">{{ card.sub }}</p>
          </div>
        }
      </div>

      <!-- ── Grid: Queue + Quick Actions ── -->
      <div class="mid-grid">

        <!-- Live Queue -->
        <section class="ac-card queue-card">
          <div class="card-head">
            <div>
              <h2 class="ac-section-title">Live Queue Board</h2>
              <p class="card-sub">OPD today</p>
            </div>
            <span class="live-badge">
              <span class="live-dot"></span>
              Realtime
            </span>
          </div>
          <div class="queue-list">
            @for (item of queue; track item.no) {
              <div class="queue-item">
                <div class="queue-no">{{ item.no }}</div>
                <div class="queue-info">
                  <p class="queue-name">{{ item.patient }}</p>
                  <p class="queue-doctor">{{ item.doctor }}</p>
                </div>
                <span class="queue-badge" [class]="'qb-' + item.statusColor">{{ item.status }}</span>
              </div>
            }
          </div>
        </section>

        <!-- Quick Actions -->
        <section class="ac-card actions-card">
          <div class="card-head">
            <div>
              <h2 class="ac-section-title">Quick Actions</h2>
              <p class="card-sub">Frequently used workflows</p>
            </div>
          </div>
          <div class="actions-grid">
            @for (action of quickActions; track action.label) {
              <button class="action-btn" [style.--color]="action.color" [style.--bg]="action.bg"
                      (click)="toast.success(action.label, 'Opening workflow...')">
                <div class="action-icon">
                  <span class="material-symbols-rounded msf" style="font-size:24px">{{ action.icon }}</span>
                </div>
                <span class="action-label">{{ action.label }}</span>
              </button>
            }
          </div>
        </section>
      </div>

      <!-- ── Grid: Revenue + Activity ── -->
      <div class="lower-grid">

        <!-- Revenue Breakdown -->
        <section class="ac-card revenue-card">
          <div class="card-head">
            <div>
              <h2 class="ac-section-title">Revenue Flow</h2>
              <p class="card-sub">Today's collections</p>
            </div>
            <span class="ac-badge ac-badge-success">₹ 2.4L</span>
          </div>
          <div class="revenue-bars">
            @for (r of revenue; track r.label) {
              <div class="rev-row">
                <span class="rev-label">{{ r.label }}</span>
                <div class="rev-track">
                  <div class="rev-fill" [style.width.%]="r.pct" [style.background]="r.color"></div>
                </div>
                <span class="rev-amount">{{ r.amount }}</span>
              </div>
            }
          </div>
        </section>

        <!-- Activity Feed -->
        <section class="ac-card activity-card">
          <div class="card-head">
            <div>
              <h2 class="ac-section-title">Activity Feed</h2>
              <p class="card-sub">Recent events</p>
            </div>
            <button class="ac-btn ac-btn-ghost" style="height:30px;font-size:12px">View all</button>
          </div>
          <div class="activity-list">
            @for (a of activity; track a.id) {
              <div class="activity-item">
                <div class="activity-icon" [style.background]="a.bg" [style.color]="a.color">
                  <span class="material-symbols-rounded msf" style="font-size:16px">{{ a.icon }}</span>
                </div>
                <div class="activity-body">
                  <p class="activity-text">{{ a.text }}</p>
                  <p class="activity-time">{{ a.time }}</p>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Operational Alerts -->
        <section class="ac-card alerts-card">
          <div class="card-head">
            <div>
              <h2 class="ac-section-title">Alerts</h2>
              <p class="card-sub">Needs attention</p>
            </div>
            <span class="ac-badge ac-badge-error">3 critical</span>
          </div>
          <div class="alerts-list">
            @for (alert of alerts; track alert.title) {
              <div class="alert-item" [class]="'alert-' + alert.type">
                <span class="material-symbols-rounded alert-icon msf" style="font-size:18px">{{ alert.icon }}</span>
                <div class="alert-body">
                  <p class="alert-title">{{ alert.title }}</p>
                  <p class="alert-desc">{{ alert.desc }}</p>
                </div>
                <span class="alert-badge" [class]="'ab-' + alert.type">{{ alert.level }}</span>
              </div>
            }
          </div>
        </section>
      </div>

    </div>
  `,
  styles: `
    .dashboard {
      display: flex;
      flex-direction: column;
      gap: 24px;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Welcome ── */
    .welcome-bar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .welcome-sub {
      margin-top: 4px;
      font-size: 13.5px;
      color: var(--ac-muted);
    }
    .welcome-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    /* ── KPI Grid ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 16px;
    }
    @media (max-width: 1280px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px)  { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .kpi-grid { grid-template-columns: 1fr; } }

    .kpi-card {
      padding: 18px;
      transition: all 0.2s ease;
      cursor: default;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 3px;
      background: var(--accent);
      border-radius: 0 0 var(--ac-r) var(--ac-r);
    }
    .kpi-card:hover {
      box-shadow: var(--ac-sh-md);
      transform: translateY(-2px);
    }
    .kpi-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .kpi-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--ac-r-sm);
    }
    .kpi-trend {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 11.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--ac-r-full);
    }
    .kpi-trend.up   { background: var(--ac-success-light); color: var(--ac-success); }
    .kpi-trend.down { background: var(--ac-error-light);   color: var(--ac-error); }
    .kpi-value {
      font-size: 26px;
      font-weight: 800;
      color: var(--ac-text);
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .kpi-label {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--ac-text-3);
      margin-top: 4px;
    }
    .kpi-sub {
      font-size: 11px;
      color: var(--ac-muted);
      margin-top: 3px;
    }

    /* ── Mid Grid ── */
    .mid-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 20px;
    }
    @media (max-width: 900px) { .mid-grid { grid-template-columns: 1fr; } }

    .card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .card-sub {
      font-size: 12px;
      color: var(--ac-muted);
      margin-top: 3px;
    }

    /* Live badge */
    .live-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--ac-r-full);
      background: var(--ac-success-light);
      color: var(--ac-success);
      font-size: 11.5px;
      font-weight: 700;
    }
    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ac-success);
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    /* Queue */
    .queue-card, .actions-card { padding: 20px; }
    .queue-list { display: flex; flex-direction: column; gap: 8px; }
    .queue-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--ac-r-sm);
      border: 1px solid var(--ac-border);
      background: var(--ac-surface-2);
      transition: all var(--ac-t);
    }
    .queue-item:hover { border-color: var(--ac-primary); background: var(--ac-primary-light); }
    .queue-no {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--ac-r-sm);
      background: var(--ac-primary-lighter);
      color: var(--ac-primary);
      font-size: 13px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .queue-info { flex: 1; min-width: 0; }
    .queue-name  { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .queue-doctor{ font-size: 11.5px; color: var(--ac-muted); }
    .queue-badge {
      padding: 3px 9px;
      border-radius: var(--ac-r-full);
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .qb-green  { background: var(--ac-success-light); color: var(--ac-success); }
    .qb-blue   { background: var(--ac-primary-light);  color: var(--ac-primary); }
    .qb-amber  { background: var(--ac-warning-light);  color: var(--ac-warning); }
    .qb-purple { background: var(--ac-secondary-light); color: var(--ac-secondary); }

    /* Quick Actions */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 10px;
      border-radius: var(--ac-r);
      border: 1px solid var(--ac-border);
      background: var(--ac-surface-2);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .action-btn:hover {
      background: var(--bg);
      border-color: var(--color);
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      transform: translateY(-2px);
    }
    .action-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--ac-r);
      background: var(--bg);
      color: var(--color);
    }
    .action-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--ac-text-3);
      text-align: center;
    }

    /* ── Lower Grid ── */
    .lower-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 1100px) { .lower-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 768px)  { .lower-grid { grid-template-columns: 1fr; } }

    .revenue-card, .activity-card, .alerts-card { padding: 20px; }

    /* Revenue */
    .revenue-bars { display: flex; flex-direction: column; gap: 14px; }
    .rev-row { display: grid; grid-template-columns: 80px 1fr 60px; align-items: center; gap: 10px; }
    .rev-label { font-size: 12px; color: var(--ac-muted); }
    .rev-track {
      height: 8px;
      background: var(--ac-surface-2);
      border-radius: var(--ac-r-full);
      overflow: hidden;
    }
    .rev-fill {
      height: 100%;
      border-radius: var(--ac-r-full);
      transition: width 0.8s cubic-bezier(0.4,0,0.2,1);
    }
    .rev-amount { font-size: 12.5px; font-weight: 700; color: var(--ac-text-3); text-align: right; }

    /* Activity */
    .activity-list { display: flex; flex-direction: column; gap: 12px; }
    .activity-item { display: flex; align-items: flex-start; gap: 10px; }
    .activity-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--ac-r-sm);
      flex-shrink: 0;
    }
    .activity-body { flex: 1; min-width: 0; }
    .activity-text { font-size: 12.5px; color: var(--ac-text-3); line-height: 1.4; }
    .activity-time { font-size: 11px; color: var(--ac-muted); margin-top: 2px; }

    /* Alerts */
    .alerts-list { display: flex; flex-direction: column; gap: 10px; }
    .alert-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px;
      border-radius: var(--ac-r-sm);
      border-left: 3px solid;
    }
    .alert-error  { background: var(--ac-error-light);   border-color: var(--ac-error); }
    .alert-warning{ background: var(--ac-warning-light); border-color: var(--ac-warning); }
    .alert-info   { background: var(--ac-info-light);    border-color: var(--ac-info); }
    .alert-icon { margin-top: 1px; flex-shrink: 0; }
    .alert-error .alert-icon   { color: var(--ac-error); }
    .alert-warning .alert-icon { color: var(--ac-warning); }
    .alert-info .alert-icon    { color: var(--ac-info); }
    .alert-body { flex: 1; min-width: 0; }
    .alert-title { font-size: 13px; font-weight: 600; color: var(--ac-text); }
    .alert-desc  { font-size: 11.5px; color: var(--ac-muted); margin-top: 2px; }
    .alert-badge {
      padding: 2px 8px;
      border-radius: var(--ac-r-full);
      font-size: 10px;
      font-weight: 800;
      flex-shrink: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .ab-error   { background: var(--ac-error);   color: #fff; }
    .ab-warning { background: var(--ac-warning); color: #fff; }
    .ab-info    { background: var(--ac-info);    color: #fff; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  protected readonly toast = inject(ToastService);

  protected readonly greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  protected readonly todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  protected readonly kpiCards = [
    { label: "Today's Appointments", value: '86',    sub: '14 remaining today', icon: 'event',       color: '#2563EB', bg: 'rgba(37,99,235,0.1)',  growth: '+12%', trendUp: true  },
    { label: 'Active Patients',       value: '342',   sub: '24 in consultation',  icon: 'people',      color: '#10B981', bg: 'rgba(16,185,129,0.1)', growth: '+5%',  trendUp: true  },
    { label: 'Revenue Today',         value: '₹2.4L', sub: '₹18.2L this month',  icon: 'payments',    color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', growth: '+8%',  trendUp: true  },
    { label: 'Available Beds',        value: '47',    sub: '12 beds occupied',    icon: 'king_bed',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', growth: '-3',   trendUp: false },
    { label: 'Lab Pending',           value: '13',    sub: '4 reports overdue',   icon: 'biotech',     color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  growth: '+2',   trendUp: false },
    { label: 'Pharmacy Alerts',       value: '7',     sub: 'Low stock warnings',  icon: 'medication',  color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', growth: '+3',   trendUp: false }
  ];

  protected readonly queue = [
    { no: 'P01', patient: 'Aditya Mehta',    doctor: 'Dr. Priya Singh',  status: 'In Consultation', statusColor: 'blue'   },
    { no: 'P02', patient: 'Sunita Rao',      doctor: 'Dr. Rahul Gupta',  status: 'Waiting',         statusColor: 'amber'  },
    { no: 'P03', patient: 'Mohan Patil',     doctor: 'Dr. Kavita Nair',  status: 'Completed',       statusColor: 'green'  },
    { no: 'P04', patient: 'Neha Joshi',      doctor: 'Dr. Arjun Verma',  status: 'Waiting',         statusColor: 'amber'  },
    { no: 'P05', patient: 'Ravi Kulkarni',   doctor: 'Dr. Priya Singh',  status: 'Vitals Done',     statusColor: 'purple' }
  ];

  protected readonly quickActions = [
    { icon: 'person_add',     label: 'New Patient',     color: '#2563EB', bg: 'rgba(37,99,235,0.08)'   },
    { icon: 'event_available',label: 'Appointment',     color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
    { icon: 'hotel',          label: 'Admit Patient',   color: '#7C3AED', bg: 'rgba(124,58,237,0.08)'  },
    { icon: 'receipt_long',   label: 'Generate Bill',   color: '#F59E0B', bg: 'rgba(245,158,11,0.08)'  },
    { icon: 'edit_note',      label: 'Prescription',    color: '#EF4444', bg: 'rgba(239,68,68,0.08)'   },
    { icon: 'science',        label: 'Lab Request',     color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)'  }
  ];

  protected readonly revenue = [
    { label: 'OPD',       pct: 75, amount: '₹82K',   color: '#2563EB' },
    { label: 'IPD',       pct: 52, amount: '₹56K',   color: '#7C3AED' },
    { label: 'Lab',       pct: 38, amount: '₹41K',   color: '#10B981' },
    { label: 'Pharmacy',  pct: 44, amount: '₹48K',   color: '#F59E0B' },
    { label: 'Radiology', pct: 20, amount: '₹22K',   color: '#0EA5E9' }
  ];

  protected readonly activity = [
    { id: 1, icon: 'person_add',   text: 'New patient Rahul Sharma registered (MRN-1094)',  time: '2 min ago',  bg: 'rgba(37,99,235,0.1)',  color: '#2563EB' },
    { id: 2, icon: 'receipt',      text: 'Invoice #INV-0412 generated — ₹4,200',            time: '18 min ago', bg: 'rgba(16,185,129,0.1)', color: '#10B981' },
    { id: 3, icon: 'science',      text: 'CBC Lab report ready for patient P-1089',         time: '35 min ago', bg: 'rgba(124,58,237,0.1)', color: '#7C3AED' },
    { id: 4, icon: 'medication',   text: 'Pharmacy stock updated: 40 medicines restocked',  time: '1 hr ago',   bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' },
    { id: 5, icon: 'hotel',        text: 'Patient Sunita Rao admitted to Ward-3, Bed-B12',  time: '2 hr ago',   bg: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }
  ];

  protected readonly alerts = [
    { icon: 'medication_liquid', title: 'Pharmacy low stock',    desc: '7 medicines reached reorder level — immediate action needed.',      type: 'error',   level: 'Critical' },
    { icon: 'warning',           title: '5 Insurance claims',     desc: 'Claims pending document verification. Deadline: tomorrow 5 PM.',   type: 'warning', level: 'Warning'  },
    { icon: 'bed',               title: 'ICU near capacity',      desc: 'Only 2 ICU beds available. Consider bed management plan.',         type: 'info',    level: 'Info'     }
  ];
}
