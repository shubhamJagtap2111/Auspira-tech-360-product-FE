import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="patients">

      <!-- Page Header -->
      <div class="page-header">
        <div>
          <p class="ac-eyebrow">Clinical</p>
          <h1 class="ac-page-title">Patient Registry</h1>
          <p class="page-desc">Tenant-isolated patient master with history, documents, allergies, insurance, and billing context.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary">
            <span class="material-symbols-rounded" style="font-size:16px">download</span>
            Export
          </button>
          <button class="ac-btn ac-btn-primary" (click)="toast.success('New patient', 'Opening registration form...')">
            <span class="material-symbols-rounded" style="font-size:16px">person_add</span>
            Register Patient
          </button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        @for (s of stats; track s.label) {
          <div class="stat-card ac-card">
            <div class="stat-icon" [style.background]="s.bg" [style.color]="s.color">
              <span class="material-symbols-rounded msf" style="font-size:18px">{{ s.icon }}</span>
            </div>
            <div>
              <p class="stat-value">{{ s.value }}</p>
              <p class="stat-label">{{ s.label }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Toolbar -->
      <div class="toolbar ac-card">
        <div class="search-field">
          <span class="material-symbols-rounded search-icon" style="font-size:18px">search</span>
          <input class="toolbar-input" type="text" [(ngModel)]="searchQuery"
                 placeholder="Search by name, MRN, or mobile..." />
          @if (searchQuery) {
            <button class="clear-btn" (click)="searchQuery = ''">
              <span class="material-symbols-rounded" style="font-size:16px">close</span>
            </button>
          }
        </div>
        <select class="toolbar-select" [(ngModel)]="genderFilter">
          <option value="">All Genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <select class="toolbar-select" [(ngModel)]="statusFilter">
          <option value="">All Statuses</option>
          <option value="Checked In">Checked In</option>
          <option value="Waiting">Waiting</option>
          <option value="Completed">Completed</option>
          <option value="Scheduled">Scheduled</option>
        </select>
        <div class="toolbar-count">
          <span>{{ filteredPatients().length }} patients</span>
        </div>
      </div>

      <!-- Table -->
      <div class="ac-card table-card">
        @if (filteredPatients().length > 0) {
          <table class="ac-table">
            <thead>
              <tr>
                <th>MRN</th>
                <th>Patient</th>
                <th>Mobile</th>
                <th>Gender</th>
                <th>Last Visit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (p of filteredPatients(); track p.mrn) {
                <tr>
                  <td>
                    <span class="mrn-chip">{{ p.mrn }}</span>
                  </td>
                  <td>
                    <div class="patient-cell">
                      <div class="patient-avatar" [style.background]="p.avatarBg">{{ p.initials }}</div>
                      <div>
                        <p class="patient-name">{{ p.name }}</p>
                        <p class="patient-meta">{{ p.age }} yrs · {{ p.blood }}</p>
                      </div>
                    </div>
                  </td>
                  <td style="color:var(--ac-text-3)">{{ p.mobile }}</td>
                  <td>
                    <span class="gender-badge" [class]="'gb-' + p.genderColor">{{ p.gender }}</span>
                  </td>
                  <td style="color:var(--ac-muted);font-size:13px">{{ p.lastVisit }}</td>
                  <td>
                    <span class="status-badge" [class]="'sb-' + p.statusColor">{{ p.status }}</span>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="tbl-btn" title="View profile"
                              (click)="toast.info(p.name, 'Opening patient record...')">
                        <span class="material-symbols-rounded" style="font-size:16px">visibility</span>
                      </button>
                      <button class="tbl-btn" title="Edit">
                        <span class="material-symbols-rounded" style="font-size:16px">edit</span>
                      </button>
                      <button class="tbl-btn" title="Schedule appointment">
                        <span class="material-symbols-rounded" style="font-size:16px">event</span>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Pagination -->
          <div class="table-footer">
            <span class="table-count">Showing {{ filteredPatients().length }} of {{ patients.length }} patients</span>
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

        } @else {
          <div class="empty-state">
            <div class="empty-icon">
              <span class="material-symbols-rounded msf" style="font-size:40px;color:var(--ac-muted-2)">person_search</span>
            </div>
            <h3 class="empty-title">No patients found</h3>
            <p class="empty-desc">Try adjusting your search or filters to find what you're looking for.</p>
            <button class="ac-btn ac-btn-primary" (click)="clearFilters()">
              <span class="material-symbols-rounded" style="font-size:16px">refresh</span>
              Clear Filters
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .patients { display: flex; flex-direction: column; gap: 20px; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .page-desc { font-size: 13.5px; color: var(--ac-muted); margin-top: 5px; max-width: 520px; }
    .header-actions { display: flex; gap: 10px; flex-shrink: 0; }

    /* Stats */
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    @media (max-width: 900px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
    .stat-card { display: flex; align-items: center; gap: 14px; padding: 16px; }
    .stat-icon { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: var(--ac-r-sm); flex-shrink: 0; }
    .stat-value { font-size: 20px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.01em; }
    .stat-label { font-size: 12px; color: var(--ac-muted); margin-top: 1px; }

    /* Toolbar */
    .toolbar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; flex-wrap: wrap; }
    .search-field { position: relative; display: flex; align-items: center; flex: 1; min-width: 200px; }
    .search-icon { position: absolute; left: 12px; color: var(--ac-muted); pointer-events: none; }
    .toolbar-input {
      width: 100%; height: 38px; padding: 0 36px;
      border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm);
      background: var(--ac-surface-2); color: var(--ac-text);
      font-size: 13.5px; font-family: inherit; outline: none; transition: all var(--ac-t);
    }
    .toolbar-input:focus { border-color: var(--ac-primary); background: var(--ac-surface); box-shadow: 0 0 0 3px rgba(37,99,235,0.08); }
    .toolbar-input::placeholder { color: var(--ac-muted-2); }
    .clear-btn { position: absolute; right: 10px; color: var(--ac-muted); cursor: pointer; display: flex; align-items: center; }
    .toolbar-select {
      height: 38px; padding: 0 10px; min-width: 150px;
      border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm);
      background: var(--ac-surface-2); color: var(--ac-text);
      font-size: 13.5px; font-family: inherit; outline: none;
      cursor: pointer; transition: all var(--ac-t);
    }
    .toolbar-select:focus { border-color: var(--ac-primary); }
    .toolbar-count { font-size: 12.5px; color: var(--ac-muted); padding: 0 4px; white-space: nowrap; }

    /* Table */
    .table-card { overflow: hidden; }
    .mrn-chip {
      font-family: monospace; font-size: 12px; font-weight: 700;
      padding: 3px 9px; border-radius: var(--ac-r-sm);
      background: var(--ac-primary-light); color: var(--ac-primary);
    }
    .patient-cell { display: flex; align-items: center; gap: 10px; }
    .patient-avatar {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: var(--ac-r-full);
      font-size: 12px; font-weight: 800; color: #fff; flex-shrink: 0;
    }
    .patient-name { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .patient-meta { font-size: 11.5px; color: var(--ac-muted); margin-top: 1px; }
    .gender-badge {
      display: inline-flex; padding: 3px 9px; border-radius: var(--ac-r-full);
      font-size: 11.5px; font-weight: 600;
    }
    .gb-blue   { background: var(--ac-primary-light);  color: var(--ac-primary); }
    .gb-pink   { background: rgba(236,72,153,0.1);      color: #DB2777; }
    .gb-purple { background: var(--ac-secondary-light); color: var(--ac-secondary); }
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
    .tbl-btn:hover { background: var(--ac-surface-2); color: var(--ac-text); }
    .table-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-top: 1px solid var(--ac-border); flex-wrap: wrap; gap: 10px;
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
      font-size: 13px; color: var(--ac-muted); cursor: pointer;
    }
    .page-num:hover { background: var(--ac-surface-2); }
    .page-num.active { background: var(--ac-primary); color: #fff; font-weight: 700; }

    /* Empty State */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 60px 24px; text-align: center;
    }
    .empty-icon {
      display: flex; align-items: center; justify-content: center;
      width: 72px; height: 72px; border-radius: 18px; background: var(--ac-surface-2);
    }
    .empty-title { font-size: 16px; font-weight: 700; color: var(--ac-text); }
    .empty-desc  { font-size: 13.5px; color: var(--ac-muted); max-width: 320px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientListPageComponent {
  protected readonly i18n  = inject(I18nService);
  protected readonly toast = inject(ToastService);

  protected searchQuery  = '';
  protected genderFilter = '';
  protected statusFilter = '';

  protected readonly patients = [
    { mrn: 'P-1089', name: 'Aditya Mehta',    initials: 'AM', age: 34, blood: 'O+',  mobile: '+91 98765 00001', gender: 'Male',   genderColor: 'blue',   lastVisit: '09 Jun 2025', status: 'Checked In', statusColor: 'blue',   avatarBg: '#2563EB' },
    { mrn: 'P-1090', name: 'Sunita Rao',       initials: 'SR', age: 28, blood: 'A+',  mobile: '+91 98765 00002', gender: 'Female', genderColor: 'pink',   lastVisit: '08 Jun 2025', status: 'Waiting',    statusColor: 'amber',  avatarBg: '#DB2777' },
    { mrn: 'P-1091', name: 'Mohan Patil',      initials: 'MP', age: 52, blood: 'B-',  mobile: '+91 98765 00003', gender: 'Male',   genderColor: 'blue',   lastVisit: '07 Jun 2025', status: 'Completed',  statusColor: 'green',  avatarBg: '#7C3AED' },
    { mrn: 'P-1092', name: 'Neha Joshi',       initials: 'NJ', age: 41, blood: 'AB+', mobile: '+91 98765 00004', gender: 'Female', genderColor: 'pink',   lastVisit: '06 Jun 2025', status: 'Scheduled',  statusColor: 'purple', avatarBg: '#10B981' },
    { mrn: 'P-1093', name: 'Ravi Kulkarni',    initials: 'RK', age: 29, blood: 'O-',  mobile: '+91 98765 00005', gender: 'Male',   genderColor: 'blue',   lastVisit: '05 Jun 2025', status: 'Checked In', statusColor: 'blue',   avatarBg: '#F59E0B' },
    { mrn: 'P-1094', name: 'Priya Deshmukh',   initials: 'PD', age: 36, blood: 'A-',  mobile: '+91 98765 00006', gender: 'Female', genderColor: 'pink',   lastVisit: '04 Jun 2025', status: 'Waiting',    statusColor: 'amber',  avatarBg: '#EF4444' },
    { mrn: 'P-1095', name: 'Rahul Sharma',     initials: 'RS', age: 23, blood: 'B+',  mobile: '+91 98765 00007', gender: 'Male',   genderColor: 'blue',   lastVisit: '03 Jun 2025', status: 'Completed',  statusColor: 'green',  avatarBg: '#0EA5E9' }
  ];

  protected readonly filteredPatients = computed(() => {
    return this.patients.filter(p => {
      const q = this.searchQuery.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.mrn.toLowerCase().includes(q) || p.mobile.includes(q);
      const matchGender = !this.genderFilter || p.gender === this.genderFilter;
      const matchStatus = !this.statusFilter || p.status === this.statusFilter;
      return matchSearch && matchGender && matchStatus;
    });
  });

  protected readonly stats = [
    { label: 'Total Patients',   value: '1,284', icon: 'people',       bg: 'rgba(37,99,235,0.08)',  color: '#2563EB' },
    { label: 'Checked In Today', value: '24',    icon: 'how_to_reg',   bg: 'rgba(16,185,129,0.08)', color: '#10B981' },
    { label: 'New This Month',   value: '143',   icon: 'person_add',   bg: 'rgba(124,58,237,0.08)', color: '#7C3AED' },
    { label: 'Pending Review',   value: '7',     icon: 'pending',      bg: 'rgba(245,158,11,0.08)', color: '#F59E0B' }
  ];

  protected clearFilters(): void {
    this.searchQuery  = '';
    this.genderFilter = '';
    this.statusFilter = '';
  }
}
