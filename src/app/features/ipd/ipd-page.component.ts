import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  CreateIpdAdmissionRequest,
  IpdAdmissionListItem,
  IpdBedStatus,
  IpdDashboard,
  IpdOption,
  IpdWardOccupancy
} from './ipd-management.models';
import { IpdManagementService } from './ipd-management.service';

type IpdTab = 'dashboard' | 'admissions' | 'beds' | 'patients' | 'care' | 'transfers' | 'billing' | 'discharge' | 'reports';

interface IpdTabItem {
  key: IpdTab;
  label: string;
  icon: string;
}

interface IpdKpiCard {
  label: string;
  value: string;
  meta: string;
  icon: string;
  tone: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcGridLoaderComponent],
  template: `
    <section class="ipd-page">
      <header class="page-header">
        <div>
          <p class="ac-eyebrow">Connected clinical journey</p>
          <h1 class="ac-page-title">IPD Workspace</h1>
          <p class="page-desc">Track admissions, beds, inpatient care, billing readiness, and discharge movement from one screen.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary" type="button" [disabled]="refreshing()" (click)="refresh()">
            <span class="material-symbols-rounded" [class.spin]="refreshing()">{{ refreshing() ? 'progress_activity' : 'refresh' }}</span>
            Refresh
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="openAdmissionPanel()">
            <span class="material-symbols-rounded">add_box</span>
            New Admission
          </button>
        </div>
      </header>

      @if (workspace(); as model) {
        <section class="kpi-strip">
          @for (card of kpiCards(); track card.label) {
            <article class="kpi-card" [style.--tone]="card.tone">
              <span class="material-symbols-rounded kpi-icon">{{ card.icon }}</span>
              <div>
                <strong>{{ card.value }}</strong>
                <span>{{ card.label }}</span>
                <small>{{ card.meta }}</small>
              </div>
            </article>
          }
        </section>

        <section class="journey-card">
          @for (step of journeySteps; track step.label; let index = $index) {
            <button type="button" class="journey-step" [class.active]="index === journeyIndex()" [class.done]="index < journeyIndex()" (click)="jumpToJourney(index)">
              <span class="journey-dot">
                @if (index < journeyIndex()) {
                  <span class="material-symbols-rounded">check</span>
                } @else {
                  {{ index + 1 }}
                }
              </span>
              <strong>{{ step.label }}</strong>
              <small>{{ step.meta }}</small>
            </button>
          }
        </section>

        <nav class="module-tabs" aria-label="IPD areas">
          @for (tab of tabs; track tab.key) {
            <button type="button" [class.active]="activeTab() === tab.key" (click)="setTab(tab.key)">
              <span class="material-symbols-rounded">{{ tab.icon }}</span>
              {{ tab.label }}
            </button>
          }
        </nav>

        @if (loading()) {
          <ac-grid-loader title="Loading IPD..." message="Preparing admissions, beds, and care status." />
        } @else {
          @switch (activeTab()) {
            @case ('dashboard') {
              <section class="dashboard-grid">
                <article class="panel occupancy-panel">
                  <div class="panel-head">
                    <div>
                      <p class="ac-eyebrow">Bed occupancy</p>
                      <h2>Ward capacity</h2>
                    </div>
                    <span class="soft-pill">{{ model.summary.occupancyPercent | number: '1.0-1' }}% hospital</span>
                  </div>
                  <div class="ward-list">
                    @for (ward of model.wards; track ward.wardId) {
                      <div class="ward-row">
                        <div class="ward-meta">
                          <strong>{{ ward.wardName }}</strong>
                          <span>{{ ward.occupiedBeds }}/{{ ward.totalBeds }} occupied</span>
                        </div>
                        <div class="bar-track">
                          <span class="bar-fill" [style.width.%]="ward.occupancyPercent"></span>
                        </div>
                        <b>{{ ward.occupancyPercent | number: '1.0-0' }}%</b>
                      </div>
                    } @empty {
                      <div class="empty-state">No wards configured yet.</div>
                    }
                  </div>
                </article>

                <article class="panel bed-mix-panel">
                  <div class="panel-head">
                    <div>
                      <p class="ac-eyebrow">Live mix</p>
                      <h2>Bed status</h2>
                    </div>
                    <span class="soft-pill">{{ model.summary.totalBeds }} beds</span>
                  </div>
                  <div class="donut-wrap">
                    <div class="donut" [style.--occupied]="occupancyArc()" [style.--available]="availableArc()">
                      <strong>{{ model.summary.totalBeds }}</strong>
                      <span>Total</span>
                    </div>
                    <div class="legend">
                      <span><i class="occupied"></i> Occupied <b>{{ model.summary.occupiedBeds }}</b></span>
                      <span><i class="available"></i> Available <b>{{ model.summary.availableBeds }}</b></span>
                    </div>
                  </div>
                </article>

                <article class="panel recent-panel">
                  <div class="panel-head">
                    <div>
                      <p class="ac-eyebrow">Recent admissions</p>
                      <h2>Latest IPD intake</h2>
                    </div>
                    <button class="link-btn" type="button" (click)="setTab('admissions')">View all</button>
                  </div>
                  <div class="mini-table">
                    @for (admission of model.recentAdmissions; track admission.admissionId) {
                      <button type="button" class="mini-row" (click)="selectAdmission(admission, 'care')">
                        <span>
                          <strong>{{ admission.patientName }}</strong>
                          <small>{{ admission.medicalRecordNo }}</small>
                        </span>
                        <span>{{ admission.wardName || 'Bed pending' }}</span>
                        <span>{{ admission.bedNo || '-' }}</span>
                        <b>{{ formatTime(admission.admittedAt) }}</b>
                      </button>
                    } @empty {
                      <div class="empty-state">No IPD admissions yet.</div>
                    }
                  </div>
                </article>

                <article class="panel attention-panel">
                  <div class="panel-head">
                    <div>
                      <p class="ac-eyebrow">Requires attention</p>
                      <h2>Operational watch</h2>
                    </div>
                    <span class="soft-pill">{{ model.attentionItems.length }} items</span>
                  </div>
                  <div class="attention-list">
                    @for (item of model.attentionItems; track item.key + item.title) {
                      <div class="attention-item" [class]="item.severity">
                        <span class="material-symbols-rounded">{{ item.icon }}</span>
                        <div>
                          <strong>{{ item.title }}</strong>
                          <small>{{ item.detail }}</small>
                        </div>
                      </div>
                    }
                  </div>
                </article>
              </section>
            }

            @case ('admissions') {
              <section class="panel">
                <div class="section-toolbar">
                  <div>
                    <p class="ac-eyebrow">Admission desk</p>
                    <h2>Admission decisions</h2>
                  </div>
                  <div class="inline-actions">
                    <button class="ac-btn ac-btn-secondary" type="button" (click)="saveAdmissionDraft()">
                      <span class="material-symbols-rounded">save</span>
                      Save Draft
                    </button>
                    <button class="ac-btn ac-btn-primary" type="button" (click)="openAdmissionPanel()">
                      <span class="material-symbols-rounded">add</span>
                      Admit Patient
                    </button>
                  </div>
                </div>
                @if (admissionPanelOpen()) {
                  <form class="admission-form" (ngSubmit)="createAdmission()">
                    <label>
                      <span>Patient *</span>
                      <ac-dropdown name="patientId" [(ngModel)]="admissionForm.patientId" [options]="patientOptions(model.patients)" />
                    </label>
                    <label>
                      <span>Doctor *</span>
                      <ac-dropdown name="doctorId" [(ngModel)]="admissionForm.doctorId" [options]="doctorOptions(model.doctors)" />
                    </label>
                    <label>
                      <span>Source</span>
                      <ac-dropdown name="source" [(ngModel)]="admissionForm.source" [options]="sourceOptions" />
                    </label>
                    <label>
                      <span>Priority</span>
                      <ac-dropdown name="priority" [(ngModel)]="admissionForm.priority" [options]="priorityOptions" />
                    </label>
                    <label>
                      <span>Bed allocation</span>
                      <ac-dropdown name="bedId" [(ngModel)]="admissionForm.bedId" [options]="availableBedOptions()" placeholder="Allocate later" [clearable]="true" />
                    </label>
                    <label class="wide-field">
                      <span>Admission decision note</span>
                      <textarea name="reason" [(ngModel)]="admissionForm.reason" rows="2" placeholder="Clinical reason, source handoff, or admission instruction"></textarea>
                    </label>
                    <div class="form-actions">
                      <button class="ac-btn ac-btn-secondary" type="button" (click)="admissionPanelOpen.set(false)">Cancel</button>
                      <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">
                        <span class="material-symbols-rounded">{{ saving() ? 'progress_activity' : 'check_circle' }}</span>
                        Create Admission
                      </button>
                    </div>
                  </form>
                }
                <div class="records-table">
                  <div class="table-head admissions-head">
                    <span>Patient</span><span>Doctor</span><span>Ward / Bed</span><span>Status</span><span>Action</span>
                  </div>
                  @for (admission of filteredAdmissions(); track admission.admissionId) {
                    <div class="table-row admissions-row">
                      <span><strong>{{ admission.patientName }}</strong><small>{{ admission.medicalRecordNo }} · day {{ admission.stayDays }}</small></span>
                      <span>{{ admission.doctorName }}</span>
                      <span>{{ admission.wardName || 'Allocation pending' }} <small>{{ admission.bedNo || '-' }}</small></span>
                      <span><b class="status-pill">{{ statusText(admission.statusCode) }}</b></span>
                      <span><button class="ac-btn ac-btn-secondary" type="button" (click)="selectAdmission(admission, 'care')">Open Care</button></span>
                    </div>
                  } @empty {
                    <div class="empty-state">No admissions match the current search.</div>
                  }
                </div>
              </section>
            }

            @case ('beds') {
              <section class="bed-layout">
                @for (group of bedGroups(); track group.wardName) {
                  <article class="panel ward-panel">
                    <div class="panel-head">
                      <div>
                        <p class="ac-eyebrow">{{ group.available }} available</p>
                        <h2>{{ group.wardName }}</h2>
                      </div>
                      <span class="soft-pill">{{ group.occupied }}/{{ group.total }} occupied</span>
                    </div>
                    <div class="bed-grid">
                      @for (bed of group.beds; track bed.bedId) {
                        <button type="button" class="bed-tile" [class]="bedStatusClass(bed)" (click)="chooseTransferBed(bed)">
                          <span class="material-symbols-rounded">bed</span>
                          <strong>{{ bed.bedNo }}</strong>
                          <small>{{ bed.currentPatientName || statusText(bed.statusCode) }}</small>
                        </button>
                      }
                    </div>
                  </article>
                } @empty {
                  <article class="panel"><div class="empty-state">No beds configured for IPD.</div></article>
                }
              </section>
            }

            @case ('patients') {
              <section class="panel">
                <div class="section-toolbar">
                  <div>
                    <p class="ac-eyebrow">Active patients</p>
                    <h2>Current inpatient stay</h2>
                  </div>
                  <div class="search-field compact-search">
                    <span class="material-symbols-rounded">search</span>
                    <input type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Search patient, MRN, doctor, bed" />
                  </div>
                </div>
                <div class="patient-grid">
                  @for (admission of filteredAdmissions(); track admission.admissionId) {
                    <article class="patient-card">
                      <div class="avatar">{{ initials(admission.patientName) }}</div>
                      <div>
                        <h3>{{ admission.patientName }}</h3>
                        <p>{{ admission.medicalRecordNo }} · {{ admission.doctorName }}</p>
                        <div class="info-pills">
                          <span>{{ admission.wardName || 'Ward pending' }}</span>
                          <span>{{ admission.bedNo || 'Bed pending' }}</span>
                          <span>Day {{ admission.stayDays }}</span>
                        </div>
                      </div>
                      <button class="ac-btn ac-btn-primary" type="button" (click)="selectAdmission(admission, 'care')">Open Care</button>
                    </article>
                  } @empty {
                    <div class="empty-state">No active inpatients found.</div>
                  }
                </div>
              </section>
            }

            @case ('care') {
              <section class="care-grid">
                <article class="panel">
                  @if (selectedAdmission(); as selected) {
                  <div class="panel-head">
                    <div>
                      <p class="ac-eyebrow">Clinical care</p>
                      <h2>{{ selected.patientName }}</h2>
                    </div>
                    <span class="soft-pill">{{ selected.bedNo || 'Bed pending' }}</span>
                  </div>
                  <div class="care-summary">
                    <span><b>Doctor</b>{{ selected.doctorName || '-' }}</span>
                    <span><b>MRN</b>{{ selected.medicalRecordNo || '-' }}</span>
                    <span><b>Stay</b>{{ selected.stayDays || 0 }} days</span>
                  </div>
                  } @else {
                    <div class="empty-state">Select an active inpatient to record care.</div>
                  }
                  <label class="note-field">
                    <span>Doctor round</span>
                    <textarea rows="5" [(ngModel)]="doctorRoundNote" name="doctorRoundNote" placeholder="Assessment, progress notes, plan, and orders"></textarea>
                  </label>
                  <label class="note-field">
                    <span>Nursing note</span>
                    <textarea rows="5" [(ngModel)]="nursingNote" name="nursingNote" placeholder="Vitals, intake/output, nursing care, and observations"></textarea>
                  </label>
                  <div class="inline-actions end">
                    <button class="ac-btn ac-btn-secondary" type="button" (click)="saveCareDraft()">
                      <span class="material-symbols-rounded">save</span>
                      Save Draft
                    </button>
                    <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="saveCareNotes()">
                      <span class="material-symbols-rounded">assignment_turned_in</span>
                      Save Care Notes
                    </button>
                  </div>
                </article>

                <article class="panel compact-panel">
                  <p class="ac-eyebrow">Care checklist</p>
                  <h2>Today</h2>
                  <div class="check-list">
                    <span><i class="material-symbols-rounded">monitor_heart</i> Vitals ready for nursing entry</span>
                    <span><i class="material-symbols-rounded">science</i> Lab and diagnostics can be ordered from investigations</span>
                    <span><i class="material-symbols-rounded">medication</i> Medication can be reconciled with pharmacy</span>
                    <span><i class="material-symbols-rounded">receipt_long</i> Charges should flow into billing before discharge</span>
                  </div>
                </article>
              </section>
            }

            @case ('transfers') {
              <section class="panel">
                @if (selectedAdmission(); as selected) {
                <div class="section-toolbar">
                  <div>
                    <p class="ac-eyebrow">Transfers</p>
                    <h2>Bed allocation and transfer</h2>
                  </div>
                  <span class="soft-pill">{{ selected.patientName }}</span>
                </div>
                <div class="transfer-box">
                  <div class="transfer-patient">
                    <strong>{{ selected.patientName }}</strong>
                    <span>{{ selected.wardName || 'No ward' }} · {{ selected.bedNo || 'No bed' }}</span>
                  </div>
                  <ac-dropdown name="transferBed" [(ngModel)]="transferBedId" [options]="availableBedOptions()" placeholder="Choose available bed" />
                  <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="allocateBed()">
                    <span class="material-symbols-rounded">swap_horiz</span>
                    Save Allocation
                  </button>
                </div>
                } @else {
                  <div class="empty-state">Select an active admission before allocating a bed.</div>
                }
              </section>
            }

            @case ('billing') {
              <section class="panel billing-panel">
                <div class="panel-head">
                  <div>
                    <p class="ac-eyebrow">Billing accumulation</p>
                    <h2>IPD charge readiness</h2>
                  </div>
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="exportActivePatients()">
                    <span class="material-symbols-rounded">download</span>
                    Export
                  </button>
                </div>
                <div class="billing-grid">
                  <span><b>{{ model.summary.currentAdmissions }}</b> active admission files</span>
                  <span><b>{{ model.summary.occupiedBeds }}</b> bed-day charge streams</span>
                  <span><b>{{ pendingBedCount() }}</b> records need bed allocation</span>
                  <span><b>{{ model.summary.dischargesToday }}</b> final bills to reconcile today</span>
                </div>
                <p class="helper-text">Finance integration can attach room rent, nursing care, procedures, lab orders, pharmacy issues, discounts, payments, and discharge clearance to each admission.</p>
              </section>
            }

            @case ('discharge') {
              <section class="panel">
                @if (selectedAdmission(); as selected) {
                <div class="section-toolbar">
                  <div>
                    <p class="ac-eyebrow">Discharge planning</p>
                    <h2>Final bill and discharge summary</h2>
                  </div>
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="printDischargeSummary()">
                    <span class="material-symbols-rounded">print</span>
                    Print
                  </button>
                </div>
                <div class="discharge-summary">
                  <aside>
                    <strong>{{ selected.patientName }}</strong>
                    <span>{{ selected.medicalRecordNo || '-' }}</span>
                    <span>{{ selected.wardName || 'Ward pending' }} · {{ selected.bedNo || 'Bed pending' }}</span>
                    <span>Doctor: {{ selected.doctorName || '-' }}</span>
                  </aside>
                  <label class="note-field">
                    <span>Discharge summary *</span>
                    <textarea rows="9" [(ngModel)]="dischargeSummary" name="dischargeSummary" placeholder="Diagnosis, treatment given, condition at discharge, medication advice, follow-up, and billing clearance"></textarea>
                  </label>
                </div>
                <div class="inline-actions end">
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="saveDischargeDraft()">
                    <span class="material-symbols-rounded">save</span>
                    Save Draft
                  </button>
                  <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="finalizeDischarge()">
                    <span class="material-symbols-rounded">task_alt</span>
                    Finalize Discharge
                  </button>
                </div>
                } @else {
                  <div class="empty-state">Select an inpatient before planning discharge.</div>
                }
              </section>
            }

            @case ('reports') {
              <section class="reports-grid">
                <article class="panel report-card">
                  <span class="material-symbols-rounded">bar_chart</span>
                  <h2>IPD Bed Report</h2>
                  <p>Occupancy, available beds, active admissions, and ward pressure.</p>
                  <button class="ac-btn ac-btn-primary" type="button" (click)="openReports('ipd-bed')">Open Report</button>
                </article>
                <article class="panel report-card">
                  <span class="material-symbols-rounded">pie_chart</span>
                  <h2>Operational Dashboard</h2>
                  <p>Hospital-level clinical movement across OPD, IPD, appointments, and revenue.</p>
                  <button class="ac-btn ac-btn-secondary" type="button" (click)="openReports('dashboard-overview')">Open Dashboard</button>
                </article>
              </section>
            }
          }
        }
      } @else if (loading()) {
        <ac-grid-loader title="Loading IPD..." message="Preparing admissions, beds, and care status." />
      } @else {
        <section class="panel">
          <div class="empty-state">Unable to load the IPD workspace. Try Refresh.</div>
        </section>
      }
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .ipd-page { padding: 24px 28px 32px; display: grid; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .page-desc { color: var(--ac-muted); font-size: 15px; margin-top: 2px; }
    .header-actions, .inline-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .inline-actions.end { justify-content: flex-end; margin-top: 14px; }
    .spin { animation: spin 900ms linear infinite; }

    .kpi-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .kpi-card {
      --tone: #2563EB;
      min-height: 86px;
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border: 1px solid color-mix(in srgb, var(--tone) 24%, var(--ac-border));
      border-radius: 12px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 7%, var(--ac-surface)), var(--ac-surface));
      box-shadow: var(--ac-sh-sm);
    }
    .kpi-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 12%, transparent);
    }
    .kpi-card strong { display: block; color: var(--ac-text); font-size: 25px; line-height: 1; }
    .kpi-card span:not(.kpi-icon) { display: block; margin-top: 4px; color: var(--ac-text-3); font-weight: 800; }
    .kpi-card small { color: var(--ac-muted); font-weight: 700; }

    .journey-card {
      display: grid;
      grid-template-columns: repeat(11, minmax(88px, 1fr));
      gap: 0;
      padding: 14px;
      overflow-x: auto;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      border-radius: 12px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .journey-step {
      position: relative;
      min-width: 88px;
      display: grid;
      justify-items: center;
      gap: 5px;
      color: var(--ac-muted);
      isolation: isolate;
    }
    .journey-step::before {
      content: '';
      position: absolute;
      top: 21px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--ac-border);
      z-index: -1;
    }
    .journey-step:first-child::before { left: 50%; }
    .journey-step:last-child::before { right: 50%; }
    .journey-step.done::before { background: color-mix(in srgb, var(--ac-success) 62%, var(--ac-border)); }
    .journey-dot {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      border: 2px solid var(--ac-border);
      background: var(--ac-surface);
      color: var(--ac-muted);
      font-weight: 900;
      box-shadow: 0 8px 18px rgba(15,23,42,.06);
    }
    .journey-step.done .journey-dot { background: var(--ac-success); border-color: var(--ac-success); color: #fff; }
    .journey-step.active .journey-dot { background: var(--ac-primary); border-color: var(--ac-primary); color: #fff; box-shadow: 0 10px 24px rgba(37,99,235,.28); }
    .journey-step strong { font-size: 12px; color: var(--ac-text); text-align: center; line-height: 1.15; }
    .journey-step small { font-size: 11px; color: var(--ac-muted); font-weight: 800; }
    .journey-step.done strong, .journey-step.done small { color: var(--ac-success-text); }
    .journey-step.active strong, .journey-step.active small { color: var(--ac-primary); }

    .module-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 8px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .module-tabs button {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 14px;
      border: 1px solid transparent;
      border-radius: 10px;
      color: var(--ac-muted);
      font-weight: 850;
      white-space: nowrap;
    }
    .module-tabs button.active {
      color: var(--ac-primary);
      border-color: color-mix(in srgb, var(--ac-primary) 32%, var(--ac-border));
      background: var(--ac-primary-light);
    }

    .dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr); gap: 16px; }
    .recent-panel, .attention-panel { min-height: 260px; }
    .occupancy-panel { min-height: 300px; }
    .panel {
      padding: 18px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
      min-width: 0;
    }
    .panel-head, .section-toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
    .panel h2, .section-toolbar h2 { font-size: 20px; line-height: 1.15; }
    .soft-pill {
      display: inline-flex;
      align-items: center;
      height: 30px;
      padding: 0 12px;
      border: 1px solid var(--ac-border);
      border-radius: 999px;
      color: var(--ac-muted);
      font-weight: 900;
      white-space: nowrap;
      background: var(--ac-surface);
    }

    .ward-list { display: grid; gap: 13px; }
    .ward-row { display: grid; grid-template-columns: minmax(160px, .65fr) minmax(180px, 1fr) 44px; align-items: center; gap: 12px; }
    .ward-meta strong, .ward-meta span { display: block; }
    .ward-meta span { color: var(--ac-muted); font-size: 12px; font-weight: 700; }
    .bar-track { height: 10px; border-radius: 999px; background: var(--ac-surface-2); overflow: hidden; }
    .bar-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--ac-primary), var(--ac-success)); }
    .ward-row b { text-align: right; }

    .donut-wrap { display: flex; align-items: center; justify-content: center; gap: 26px; min-height: 214px; }
    .donut {
      --occupied: 0deg;
      --available: 0deg;
      width: 148px;
      height: 148px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: conic-gradient(var(--ac-primary) 0deg var(--occupied), var(--ac-success) var(--occupied) calc(var(--occupied) + var(--available)), var(--ac-border) 0);
      position: relative;
      box-shadow: 0 18px 42px rgba(15,23,42,.1);
    }
    .donut::after {
      content: '';
      position: absolute;
      inset: 34px;
      border-radius: 50%;
      background: var(--ac-surface);
    }
    .donut strong, .donut span { position: relative; z-index: 1; display: block; text-align: center; }
    .donut strong { font-size: 26px; }
    .donut span { margin-top: 30px; color: var(--ac-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .legend { display: grid; gap: 12px; min-width: 145px; }
    .legend span { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 8px; font-weight: 800; color: var(--ac-text-3); }
    .legend i { width: 10px; height: 10px; border-radius: 50%; }
    .legend i.occupied { background: var(--ac-primary); }
    .legend i.available { background: var(--ac-success); }

    .mini-table { border: 1px solid var(--ac-border); border-radius: 10px; overflow: hidden; }
    .mini-row { width: 100%; display: grid; grid-template-columns: 1.25fr .75fr .45fr .45fr; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--ac-border); text-align: left; }
    .mini-row:last-child { border-bottom: 0; }
    .mini-row:hover { background: var(--ac-primary-light); }
    .mini-row strong, .mini-row small { display: block; }
    .mini-row small, .mini-row span { color: var(--ac-muted); font-weight: 700; }
    .mini-row b { color: var(--ac-text); }
    .link-btn { color: var(--ac-primary); font-weight: 900; }

    .attention-list { display: grid; gap: 10px; }
    .attention-item { display: flex; gap: 12px; align-items: center; min-height: 68px; padding: 12px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); }
    .attention-item .material-symbols-rounded { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; }
    .attention-item strong, .attention-item small { display: block; }
    .attention-item small { color: var(--ac-muted); font-weight: 700; }
    .attention-item.critical .material-symbols-rounded { color: var(--ac-error); background: var(--ac-error-light); }
    .attention-item.warning .material-symbols-rounded { color: var(--ac-warning); background: var(--ac-warning-light); }
    .attention-item.info .material-symbols-rounded { color: var(--ac-info); background: var(--ac-info-light); }
    .attention-item.success .material-symbols-rounded { color: var(--ac-success); background: var(--ac-success-light); }

    .admission-form {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      margin-bottom: 14px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-primary-light) 34%, var(--ac-surface));
    }
    label { display: grid; gap: 7px; color: var(--ac-text-3); font-size: 12px; font-weight: 900; }
    textarea, input {
      width: 100%;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      padding: 11px 12px;
      resize: vertical;
      font-weight: 700;
      outline: none;
    }
    textarea:focus, input:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 15%, transparent); }
    .wide-field { grid-column: span 3; }
    .form-actions { display: flex; justify-content: flex-end; align-items: end; gap: 10px; grid-column: span 2; }

    .records-table { border: 1px solid var(--ac-border); border-radius: 12px; overflow: hidden; }
    .table-head, .table-row { display: grid; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--ac-border); }
    .table-head { background: var(--ac-surface-2); color: var(--ac-muted); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .table-row:last-child { border-bottom: 0; }
    .table-row strong, .table-row small { display: block; }
    .table-row small { color: var(--ac-muted); font-weight: 700; }
    .admissions-head, .admissions-row { grid-template-columns: 1.25fr 1fr 1fr .65fr .65fr; }
    .status-pill { display: inline-flex; align-items: center; width: fit-content; border-radius: 999px; padding: 5px 10px; color: var(--ac-primary); background: var(--ac-primary-light); font-size: 12px; }

    .bed-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .bed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; }
    .bed-tile {
      min-height: 106px;
      display: grid;
      align-content: center;
      gap: 6px;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      text-align: left;
    }
    .bed-tile.available { border-color: color-mix(in srgb, var(--ac-success) 40%, var(--ac-border)); background: var(--ac-success-light); }
    .bed-tile.occupied { border-color: color-mix(in srgb, var(--ac-primary) 34%, var(--ac-border)); background: var(--ac-primary-light); }
    .bed-tile.maintenance { border-color: color-mix(in srgb, var(--ac-warning) 40%, var(--ac-border)); background: var(--ac-warning-light); }
    .bed-tile .material-symbols-rounded { color: var(--ac-primary); }
    .bed-tile small { color: var(--ac-muted); font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .patient-grid { display: grid; gap: 10px; }
    .patient-card { display: grid; grid-template-columns: 48px 1fr auto; gap: 14px; align-items: center; padding: 14px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface); }
    .avatar { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 12px; background: linear-gradient(135deg, var(--ac-primary), var(--ac-teal)); color: #fff; font-weight: 900; }
    .patient-card h3 { font-size: 17px; }
    .patient-card p { color: var(--ac-muted); font-weight: 700; }
    .info-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .info-pills span { padding: 4px 9px; border-radius: 999px; background: var(--ac-surface-2); color: var(--ac-text-3); font-size: 12px; font-weight: 800; }

    .care-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; }
    .care-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .care-summary span, .billing-grid span, .discharge-summary aside {
      display: grid;
      gap: 4px;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface-2);
      font-weight: 800;
    }
    .care-summary b { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; }
    .note-field { margin-top: 12px; }
    .compact-panel { align-self: start; }
    .check-list { display: grid; gap: 10px; margin-top: 14px; }
    .check-list span { display: flex; gap: 9px; align-items: center; color: var(--ac-text-3); font-weight: 800; }
    .check-list i { color: var(--ac-success); }

    .transfer-box { display: grid; grid-template-columns: 1fr minmax(260px, .6fr) auto; gap: 12px; align-items: end; }
    .transfer-patient { display: grid; gap: 4px; padding: 14px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface-2); }
    .transfer-patient span { color: var(--ac-muted); font-weight: 700; }

    .billing-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .billing-grid b { font-size: 28px; color: var(--ac-primary); }
    .helper-text { margin-top: 14px; color: var(--ac-muted); font-weight: 700; }

    .discharge-summary { display: grid; grid-template-columns: 280px 1fr; gap: 14px; align-items: start; }
    .discharge-summary aside strong { font-size: 20px; }
    .discharge-summary aside span { color: var(--ac-muted); font-weight: 800; }

    .reports-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .report-card { display: grid; gap: 10px; align-content: start; }
    .report-card > .material-symbols-rounded { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 10px; color: var(--ac-primary); background: var(--ac-primary-light); }
    .report-card p { color: var(--ac-muted); font-weight: 700; }

    .search-field {
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
    }
    .search-field input { border: 0; padding: 0; box-shadow: none; background: transparent; }
    .compact-search { width: min(420px, 100%); }
    .empty-state {
      min-height: 96px;
      display: grid;
      place-items: center;
      color: var(--ac-muted);
      border: 1px dashed var(--ac-border);
      border-radius: 10px;
      font-weight: 800;
      text-align: center;
      padding: 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 1280px) {
      .kpi-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .dashboard-grid, .care-grid, .bed-layout { grid-template-columns: 1fr; }
      .admission-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .wide-field, .form-actions { grid-column: span 2; }
      .transfer-box, .discharge-summary { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .ipd-page { padding: 16px; }
      .page-header, .panel-head, .section-toolbar { flex-direction: column; }
      .kpi-strip, .admission-form, .billing-grid, .reports-grid { grid-template-columns: 1fr; }
      .wide-field, .form-actions { grid-column: auto; }
      .admissions-head { display: none; }
      .admissions-row { grid-template-columns: 1fr; }
      .mini-row { grid-template-columns: 1fr; }
      .patient-card { grid-template-columns: 48px 1fr; }
      .patient-card .ac-btn { grid-column: span 2; }
      .care-summary { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IpdPageComponent implements OnInit {
  protected readonly workspace = signal<IpdDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<IpdTab>('dashboard');
  protected readonly searchQuery = signal('');
  protected readonly selectedAdmissionId = signal<string>('');
  protected readonly admissionPanelOpen = signal(false);

  protected readonly tabs: IpdTabItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'admissions', label: 'Admissions', icon: 'assignment_add' },
    { key: 'beds', label: 'Ward & Beds', icon: 'bed' },
    { key: 'patients', label: 'Active Patients', icon: 'personal_injury' },
    { key: 'care', label: 'Clinical Care', icon: 'stethoscope' },
    { key: 'transfers', label: 'Transfers', icon: 'swap_horiz' },
    { key: 'billing', label: 'Billing', icon: 'receipt_long' },
    { key: 'discharge', label: 'Discharge', icon: 'logout' },
    { key: 'reports', label: 'Reports', icon: 'bar_chart' }
  ];

  protected readonly journeySteps = [
    { label: 'Patient', meta: 'Registry', tab: 'admissions' as IpdTab },
    { label: 'Source', meta: 'OPD/Emergency', tab: 'admissions' as IpdTab },
    { label: 'Decision', meta: 'Admission', tab: 'admissions' as IpdTab },
    { label: 'Admission', meta: 'Created', tab: 'patients' as IpdTab },
    { label: 'Bed', meta: 'Allocated', tab: 'beds' as IpdTab },
    { label: 'Stay', meta: 'Active', tab: 'patients' as IpdTab },
    { label: 'Care', meta: 'Rounds', tab: 'care' as IpdTab },
    { label: 'Orders', meta: 'Lab/Pharmacy', tab: 'care' as IpdTab },
    { label: 'Billing', meta: 'Accumulated', tab: 'billing' as IpdTab },
    { label: 'Discharge', meta: 'Planned', tab: 'discharge' as IpdTab },
    { label: 'History', meta: 'Saved', tab: 'reports' as IpdTab }
  ];

  protected readonly sourceOptions: DropdownOption<string>[] = [
    { label: 'OPD handoff', value: 'OPD' },
    { label: 'Emergency', value: 'EMERGENCY' },
    { label: 'Direct admission', value: 'DIRECT' }
  ];
  protected readonly priorityOptions: DropdownOption<string>[] = [
    { label: 'Normal', value: 'NORMAL' },
    { label: 'Urgent', value: 'URGENT' },
    { label: 'Critical', value: 'CRITICAL' }
  ];

  protected admissionForm: CreateIpdAdmissionRequest = createAdmissionForm();
  protected transferBedId = '';
  protected doctorRoundNote = '';
  protected nursingNote = '';
  protected dischargeSummary = '';

  protected readonly kpiCards = computed<IpdKpiCard[]>(() => {
    const summary = this.workspace()?.summary ?? emptySummary();
    return [
      { label: 'Current Admissions', value: formatNumber(summary.currentAdmissions), meta: 'Active inpatient stays', icon: 'personal_injury', tone: '#2563EB' },
      { label: 'Available Beds', value: formatNumber(summary.availableBeds), meta: `${formatNumber(summary.totalBeds)} total beds`, icon: 'bed', tone: '#10B981' },
      { label: 'Occupied Beds', value: formatNumber(summary.occupiedBeds), meta: `${formatPercent(summary.occupancyPercent)} occupancy`, icon: 'hotel', tone: '#0891B2' },
      { label: 'Admissions Today', value: formatNumber(summary.admissionsToday), meta: 'New IPD intake', icon: 'assignment_add', tone: '#7C3AED' },
      { label: 'Discharges Today', value: formatNumber(summary.dischargesToday), meta: 'Completed stay', icon: 'task_alt', tone: '#F59E0B' }
    ];
  });

  protected readonly filteredAdmissions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.workspace()?.activePatients ?? [];
    if (!query) {
      return items;
    }

    return items.filter(item => [
      item.patientName,
      item.medicalRecordNo,
      item.doctorName,
      item.wardName,
      item.bedNo,
      item.statusCode
    ].some(value => value.toLowerCase().includes(query)));
  });

  protected readonly selectedAdmission = computed(() => {
    const id = this.selectedAdmissionId();
    const items = this.workspace()?.activePatients ?? [];
    return items.find(item => item.admissionId === id) ?? items[0] ?? null;
  });

  protected readonly availableBedOptions = computed<DropdownOption<string>[]>(() => {
    const beds = this.workspace()?.beds ?? [];
    return [
      { label: 'Allocate later', value: '' },
      ...beds
        .filter(bed => bed.statusCode.toUpperCase() === 'AVAILABLE')
        .map(bed => ({ label: `${bed.wardName} · ${bed.bedNo}`, value: bed.bedId }))
    ];
  });

  protected readonly bedGroups = computed(() => {
    const groups = new Map<string, IpdBedStatus[]>();
    for (const bed of this.workspace()?.beds ?? []) {
      groups.set(bed.wardName, [...(groups.get(bed.wardName) ?? []), bed]);
    }

    return Array.from(groups.entries()).map(([wardName, beds]) => ({
      wardName,
      beds,
      total: beds.length,
      available: beds.filter(bed => bed.statusCode.toUpperCase() === 'AVAILABLE').length,
      occupied: beds.filter(bed => ['OCCUPIED', 'ALLOCATED'].includes(bed.statusCode.toUpperCase())).length
    }));
  });

  private readonly service = inject(IpdManagementService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  async ngOnInit(): Promise<void> {
    this.restoreDrafts();
    await this.load();
    this.applyQueryHandoff();
  }

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    await this.load(false);
    this.refreshing.set(false);
    this.toast.success('IPD refreshed', 'Latest admissions and bed status loaded.');
  }

  protected setTab(tab: IpdTab): void {
    this.activeTab.set(tab);
    this.persistView();
  }

  protected jumpToJourney(index: number): void {
    this.setTab(this.journeySteps[index]?.tab ?? 'dashboard');
  }

  protected journeyIndex(): number {
    const current = this.activeTab();
    if (current === 'dashboard') {
      return 5;
    }

    const index = this.journeySteps.findIndex(step => step.tab === current);
    return Math.max(index, 0);
  }

  protected openAdmissionPanel(): void {
    this.activeTab.set('admissions');
    this.admissionPanelOpen.set(true);
  }

  protected patientOptions(items: IpdOption[]): DropdownOption<string>[] {
    return [{ label: 'Select patient', value: '' }, ...items.map(item => ({ label: `${item.label} · ${item.meta}`, value: item.value }))];
  }

  protected doctorOptions(items: IpdOption[]): DropdownOption<string>[] {
    return [{ label: 'Select doctor', value: '' }, ...items.map(item => ({ label: item.meta ? `${item.label} · ${item.meta}` : item.label, value: item.value }))];
  }

  protected selectAdmission(admission: IpdAdmissionListItem, tab: IpdTab): void {
    this.selectedAdmissionId.set(admission.admissionId);
    this.transferBedId = '';
    this.loadAdmissionDraft(admission.admissionId);
    this.setTab(tab);
  }

  protected async createAdmission(): Promise<void> {
    if (!this.admissionForm.patientId || !this.admissionForm.doctorId) {
      this.toast.warning('Admission details required', 'Select patient and doctor before creating admission.');
      return;
    }

    this.saving.set(true);
    const response = await this.service.createAdmission({
      ...this.admissionForm,
      bedId: this.admissionForm.bedId || null,
      admittedAt: new Date().toISOString()
    });
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to create admission', getApiErrorMessage(response, 'IPD admission API failed'));
      return;
    }

    localStorage.removeItem(admissionDraftKey);
    this.admissionForm = createAdmissionForm();
    this.admissionPanelOpen.set(false);
    await this.load(false);
    this.selectedAdmissionId.set(response.data.admissionId);
    this.setTab('beds');
    this.toast.success('Admission created', 'Patient is now in the IPD workflow.');
  }

  protected saveAdmissionDraft(): void {
    localStorage.setItem(admissionDraftKey, JSON.stringify(this.admissionForm));
    this.toast.success('Admission draft saved', 'You can continue from IPD admissions.');
  }

  protected saveCareDraft(): void {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose an active IPD patient before saving care notes.');
      return;
    }

    this.saveAdmissionCareDraft(admission.admissionId);
    this.toast.success('Care draft saved', 'Doctor round and nursing note are saved in this browser.');
  }

  protected async saveCareNotes(): Promise<void> {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose an active IPD patient before saving care notes.');
      return;
    }

    const doctorNote = this.doctorRoundNote.trim();
    const nurseNote = this.nursingNote.trim();
    if (!doctorNote && !nurseNote) {
      this.toast.warning('Care note required', 'Add doctor round or nursing note details first.');
      return;
    }

    this.saving.set(true);
    const responses = await Promise.all([
      doctorNote ? this.service.addDoctorRound(admission.admissionId, doctorNote) : Promise.resolve(null),
      nurseNote ? this.service.addNursingNote(admission.admissionId, nurseNote) : Promise.resolve(null)
    ]);
    this.saving.set(false);

    const failed = responses.find(response => response && !response.success);
    if (failed) {
      this.toast.error('Unable to save care notes', getApiErrorMessage(failed, 'IPD care API failed'));
      return;
    }

    this.doctorRoundNote = '';
    this.nursingNote = '';
    localStorage.removeItem(careDraftKey(admission.admissionId));
    this.toast.success('Care notes saved', 'Doctor and nursing updates are attached to the admission.');
  }

  protected chooseTransferBed(bed: IpdBedStatus): void {
    if (bed.statusCode.toUpperCase() !== 'AVAILABLE') {
      this.toast.info('Bed occupied', bed.currentPatientName || statusText(bed.statusCode));
      return;
    }

    this.transferBedId = bed.bedId;
    this.setTab('transfers');
  }

  protected async allocateBed(): Promise<void> {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an admission', 'Choose an active patient before allocating a bed.');
      return;
    }

    if (!this.transferBedId) {
      this.toast.warning('Select a bed', 'Choose an available ward bed before saving allocation.');
      return;
    }

    this.saving.set(true);
    const response = await this.service.allocateBed(admission.admissionId, this.transferBedId);
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to allocate bed', getApiErrorMessage(response, 'IPD bed allocation API failed'));
      return;
    }

    await this.load(false);
    this.transferBedId = '';
    this.toast.success('Bed allocation saved', `${response.data.wardName} ${response.data.bedNo} is now allocated.`);
  }

  protected saveDischargeDraft(): void {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose a patient before saving discharge draft.');
      return;
    }

    localStorage.setItem(dischargeDraftKey(admission.admissionId), this.dischargeSummary);
    this.toast.success('Discharge draft saved', 'Summary is saved in this browser.');
  }

  protected async finalizeDischarge(): Promise<void> {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose a patient before finalizing discharge.');
      return;
    }

    if (!this.dischargeSummary.trim()) {
      this.toast.warning('Discharge summary required', 'Enter the discharge summary before finalizing.');
      return;
    }

    this.saving.set(true);
    const response = await this.service.discharge(admission.admissionId, this.dischargeSummary.trim());
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to discharge patient', getApiErrorMessage(response, 'IPD discharge API failed'));
      return;
    }

    localStorage.removeItem(dischargeDraftKey(admission.admissionId));
    await this.load(false);
    this.setTab('dashboard');
    this.toast.success('Patient discharged', 'Bed released and discharge summary saved.');
  }

  protected printDischargeSummary(): void {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose a patient before printing.');
      return;
    }

    openPrintWindow(`
      <h1>IPD Discharge Summary</h1>
      <p><b>Patient:</b> ${escapeHtml(admission.patientName)} (${escapeHtml(admission.medicalRecordNo)})</p>
      <p><b>Doctor:</b> ${escapeHtml(admission.doctorName)}</p>
      <p><b>Ward/Bed:</b> ${escapeHtml(admission.wardName || 'Pending')} / ${escapeHtml(admission.bedNo || 'Pending')}</p>
      <hr>
      <pre>${escapeHtml(this.dischargeSummary || 'Draft summary not entered.')}</pre>
    `);
  }

  protected exportActivePatients(): void {
    const rows = this.workspace()?.activePatients ?? [];
    if (rows.length === 0) {
      this.toast.warning('No IPD records', 'There are no active patients to export.');
      return;
    }

    const csv = [
      ['Patient', 'MRN', 'Doctor', 'Ward', 'Bed', 'Status', 'Stay Days'].join(','),
      ...rows.map(row => [row.patientName, row.medicalRecordNo, row.doctorName, row.wardName, row.bedNo, statusText(row.statusCode), row.stayDays]
        .map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ipd-active-patients-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toast.success('Export ready', 'Active IPD patients CSV downloaded.');
  }

  protected openReports(reportKey: string): void {
    void this.router.navigate(['/reports'], { queryParams: { report: reportKey } });
  }

  protected occupancyArc(): string {
    const summary = this.workspace()?.summary ?? emptySummary();
    if (summary.totalBeds <= 0) {
      return '0deg';
    }

    return `${Math.round((summary.occupiedBeds / summary.totalBeds) * 360)}deg`;
  }

  protected availableArc(): string {
    const summary = this.workspace()?.summary ?? emptySummary();
    if (summary.totalBeds <= 0) {
      return '0deg';
    }

    return `${Math.round((summary.availableBeds / summary.totalBeds) * 360)}deg`;
  }

  protected pendingBedCount(): number {
    return (this.workspace()?.activePatients ?? []).filter(item => !item.bedNo).length;
  }

  protected formatTime(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  protected statusText(value: string): string {
    return statusText(value);
  }

  protected bedStatusClass(bed: IpdBedStatus): string {
    const value = bed.statusCode.toUpperCase();
    if (value === 'AVAILABLE') {
      return 'available';
    }

    if (value === 'MAINTENANCE' || value === 'CLEANING') {
      return 'maintenance';
    }

    return 'occupied';
  }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'IP';
  }

  private async load(showLoader = true): Promise<void> {
    if (showLoader) {
      this.loading.set(true);
    }

    const response = await this.service.dashboard();
    if (showLoader) {
      this.loading.set(false);
    }

    if (!response.success || !response.data) {
      this.toast.error('Unable to load IPD', getApiErrorMessage(response, 'IPD dashboard API failed'));
      return;
    }

    this.workspace.set(response.data);
    if (!this.selectedAdmissionId() && response.data.activePatients.length > 0) {
      this.selectedAdmissionId.set(response.data.activePatients[0].admissionId);
      this.loadAdmissionDraft(response.data.activePatients[0].admissionId);
    }
  }

  private applyQueryHandoff(): void {
    const patientGuid = this.route.snapshot.queryParamMap.get('patientGuid');
    const action = this.route.snapshot.queryParamMap.get('action');
    const savedTab = localStorage.getItem(viewStateKey) as IpdTab | null;

    if (action === 'admit' && patientGuid) {
      this.admissionForm.patientId = patientGuid;
      this.openAdmissionPanel();
      return;
    }

    if (savedTab && this.tabs.some(tab => tab.key === savedTab)) {
      this.activeTab.set(savedTab);
    }
  }

  private restoreDrafts(): void {
    const admissionDraft = localStorage.getItem(admissionDraftKey);
    if (admissionDraft) {
      try {
        this.admissionForm = { ...createAdmissionForm(), ...JSON.parse(admissionDraft) };
      } catch {
        localStorage.removeItem(admissionDraftKey);
      }
    }
  }

  private loadAdmissionDraft(admissionId: string): void {
    const careDraft = localStorage.getItem(careDraftKey(admissionId));
    if (careDraft) {
      try {
        const parsed = JSON.parse(careDraft) as { doctorRoundNote?: string; nursingNote?: string };
        this.doctorRoundNote = parsed.doctorRoundNote ?? '';
        this.nursingNote = parsed.nursingNote ?? '';
      } catch {
        localStorage.removeItem(careDraftKey(admissionId));
      }
    } else {
      this.doctorRoundNote = '';
      this.nursingNote = '';
    }

    this.dischargeSummary = localStorage.getItem(dischargeDraftKey(admissionId)) ?? '';
  }

  private saveAdmissionCareDraft(admissionId: string): void {
    localStorage.setItem(careDraftKey(admissionId), JSON.stringify({
      doctorRoundNote: this.doctorRoundNote,
      nursingNote: this.nursingNote
    }));
  }

  private persistView(): void {
    localStorage.setItem(viewStateKey, this.activeTab());
  }
}

function createAdmissionForm(): CreateIpdAdmissionRequest {
  return {
    patientId: '',
    doctorId: '',
    bedId: null,
    source: 'OPD',
    priority: 'NORMAL',
    reason: '',
    admittedAt: null
  };
}

function emptySummary() {
  return {
    currentAdmissions: 0,
    availableBeds: 0,
    occupiedBeds: 0,
    totalBeds: 0,
    occupancyPercent: 0,
    admissionsToday: 0,
    dischargesToday: 0
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value || 0)}%`;
}

function statusText(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function openPrintWindow(body: string): void {
  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) {
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>IPD Document</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; padding: 32px; color: #0F172A; }
          h1 { margin: 0 0 18px; }
          p { margin: 8px 0; }
          pre { white-space: pre-wrap; font: inherit; line-height: 1.6; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function escapeHtml(value: string): string {
  const element = document.createElement('div');
  element.textContent = value;
  return element.innerHTML;
}

const viewStateKey = 'care360.ipd.activeTab';
const admissionDraftKey = 'care360.ipd.admissionDraft';
const careDraftKey = (admissionId: string) => `care360.ipd.${admissionId}.careDraft`;
const dischargeDraftKey = (admissionId: string) => `care360.ipd.${admissionId}.dischargeDraft`;
