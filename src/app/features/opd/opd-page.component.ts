import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BranchContextOption, BranchContextService } from '../../core/context/branch-context.service';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AppointmentCheckInForm, AppointmentForm, AppointmentQueueRecord, AppointmentRecord, appointmentPriorityOptions, appointmentTypeOptions } from '../appointments/appointment-management.models';
import { AppointmentManagementService } from '../appointments/appointment-management.service';
import { DoctorSummary } from '../doctors/doctor-management.models';
import { DoctorManagementService } from '../doctors/doctor-management.service';
import { PatientSummary } from '../patients/patient-management.models';
import { PatientManagementService } from '../patients/patient-management.service';
import {
  OpdClinicalForm,
  OpdComplaintForm,
  OpdConsultationRecord,
  OpdDiagnosisForm,
  OpdEncounterForm,
  OpdEncounterSection,
  OpdFollowUpRecord,
  OpdLabTestRecord,
  OpdMedicineRecord,
  OpdPrescriptionItemForm,
  OpdProcedureForm,
  OpdStats,
  OpdTab,
  OpdVisitVm
} from './opd-management.models';
import { OpdManagementService } from './opd-management.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcGridLoaderComponent],
  template: `
    <section class="opd-page">
      <header class="page-header">
        <div>
          <p class="ac-eyebrow">Clinical operations</p>
          <h1 class="ac-page-title">OPD Workspace</h1>
          <p class="page-desc">Manage today's queue, check-ins, active consultations, completed visits, and OPD encounters from one workspace.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary" type="button" (click)="reload()">
            <span class="material-symbols-rounded">refresh</span>
            Refresh
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="goToAppointments()">
            <span class="material-symbols-rounded">event_available</span>
            Appointments
          </button>
        </div>
      </header>

      <div class="stats-row">
        @for (card of statCards(); track card.label) {
          <button type="button" class="stat-card ac-card" (click)="openStatCard(card.tab)">
            <span class="stat-icon material-symbols-rounded" [style.background]="card.bg" [style.color]="card.color">{{ card.icon }}</span>
            <div>
              <strong>{{ card.value }}</strong>
              <span>{{ card.label }}</span>
            </div>
          </button>
        }
      </div>

      <section class="opd-shell ac-card">
        <div class="opd-tabs">
          @for (tab of tabs; track tab.id) {
            <button type="button" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
              <span class="material-symbols-rounded">{{ tab.icon }}</span>
              <span class="tab-label">{{ tab.label }}</span>
              @if (tabCount(tab.id); as count) {
                <span class="tab-count">{{ count }}</span>
              }
            </button>
          }
        </div>

        <div class="toolbar">
          <div class="search-field">
            <span class="material-symbols-rounded">search</span>
            <input type="text" name="opdSearch" [(ngModel)]="searchQuery" placeholder="Search token, patient, MRN, doctor..." />
          </div>
          <ac-dropdown name="doctorFilter" [(ngModel)]="doctorFilter" [options]="doctorFilterOptions()" />
          <button class="icon-btn" type="button" title="Clear filters" (click)="clearFilters()">
            <span class="material-symbols-rounded">filter_alt_off</span>
          </button>
        </div>

        @if (loading()) {
          <ac-grid-loader title="Loading OPD workspace..." message="Preparing queue, check-ins, consultations, and lab context." />
        } @else {
          @switch (activeTab()) {
            @case ('dashboard') {
              <section class="opd-command-grid">
                <article class="panel command-panel doctor-queue-panel">
                  <div class="command-head">
                    <div>
                      <p class="ac-eyebrow">Live OPD command</p>
                      <h2>{{ doctorQueueSummary().doctorName }}</h2>
                      <small>{{ formatNumberValue(totalOperationalVisits()) }} visits in the current workspace</small>
                    </div>
                    <span class="command-score">{{ completionPercent() }}%</span>
                  </div>

                  <div class="progress-track" aria-label="OPD completion progress">
                    <span [style.width.%]="completionPercent()"></span>
                  </div>

                  <div class="doctor-metrics">
                    <button type="button" (click)="activeTab.set('queue')">
                      <small>Waiting</small>
                      <strong>{{ doctorQueueSummary().waiting }}</strong>
                    </button>
                    <button type="button" (click)="activeTab.set('active')">
                      <small>Current</small>
                      <strong>{{ doctorQueueSummary().current }}</strong>
                    </button>
                    <button type="button" (click)="activeTab.set('completed')">
                      <small>Completed</small>
                      <strong>{{ doctorQueueSummary().completed }}</strong>
                    </button>
                  </div>
                </article>

                <article class="panel next-patient-panel">
                  <div class="panel-head compact">
                    <span class="material-symbols-rounded">groups</span>
                    <div>
                      <p class="ac-eyebrow">Next action</p>
                      <h2>Ready patient</h2>
                    </div>
                  </div>
                  @if (nextWaitingVisit(); as visit) {
                    <button type="button" class="next-patient-card" (click)="startEncounter(visit)">
                      <span class="token-pill">{{ visit.tokenNumber }}</span>
                      <strong>{{ visit.patientName }}</strong>
                      <small>{{ visit.doctorName }} · Queue #{{ visit.queueNo || '-' }} · {{ visit.arrivalTime || '-' }}</small>
                      <span class="next-action"><span class="material-symbols-rounded">play_arrow</span>Start consultation</span>
                    </button>
                  } @else if (activeConsultations().length) {
                    @if (activeConsultations()[0]; as visit) {
                      <button type="button" class="next-patient-card active" (click)="selectVisit(visit, 'encounter')">
                        <span class="token-pill consultation">{{ visit.tokenNumber }}</span>
                        <strong>{{ visit.patientName }}</strong>
                        <small>{{ visit.doctorName }} · Consultation in progress</small>
                        <span class="next-action"><span class="material-symbols-rounded">clinical_notes</span>Continue encounter</span>
                      </button>
                    }
                  } @else {
                    <div class="empty-state compact">No patient needs action right now.</div>
                  }
                </article>

                <article class="panel dashboard-lane-panel">
                  <div class="panel-head compact">
                    <span class="material-symbols-rounded">route</span>
                    <div>
                      <p class="ac-eyebrow">Queue flow</p>
                      <h2>Patient movement</h2>
                    </div>
                  </div>
                  <div class="queue-lanes">
                    <button type="button" class="queue-lane waiting" (click)="activeTab.set('queue')">
                      <small>Waiting</small>
                      <strong>{{ stats().waiting }}</strong>
                    </button>
                    <button type="button" class="queue-lane active" (click)="activeTab.set('active')">
                      <small>Active</small>
                      <strong>{{ stats().inConsultation }}</strong>
                    </button>
                    <button type="button" class="queue-lane complete" (click)="activeTab.set('completed')">
                      <small>Done</small>
                      <strong>{{ stats().completed }}</strong>
                    </button>
                  </div>
                </article>

                <article class="panel dashboard-list-panel">
                  <div class="panel-head compact">
                    <span class="material-symbols-rounded">queue</span>
                    <div>
                      <p class="ac-eyebrow">Today's Queue</p>
                      <h2>Waiting for doctor</h2>
                    </div>
                  </div>
                  <div class="compact-list dashboard-visit-list">
                    @for (visit of waitingQueue().slice(0, 4); track visit.appointment.id) {
                      <button type="button" class="visit-row" (click)="selectVisit(visit, 'encounter')">
                        <span class="token-pill">{{ visit.tokenNumber }}</span>
                        <strong>{{ visit.patientName }}</strong>
                        <small>{{ visit.doctorName }} · {{ visit.arrivalTime || '-' }}</small>
                      </button>
                    } @empty {
                      <p class="empty-copy">No checked-in patients waiting.</p>
                    }
                  </div>
                </article>

                <article class="panel dashboard-list-panel">
                  <div class="panel-head compact">
                    <span class="material-symbols-rounded">clinical_notes</span>
                    <div>
                      <p class="ac-eyebrow">Active Consultations</p>
                      <h2>In progress</h2>
                    </div>
                  </div>
                  <div class="compact-list dashboard-visit-list">
                    @for (visit of activeConsultations().slice(0, 4); track visit.appointment.id) {
                      <button type="button" class="visit-row" (click)="selectVisit(visit, 'encounter')">
                        <span class="token-pill consultation">{{ visit.tokenNumber }}</span>
                        <strong>{{ visit.patientName }}</strong>
                        <small>{{ visit.doctorName }} · {{ visit.departmentName }}</small>
                      </button>
                    } @empty {
                      <p class="empty-copy">No active consultations.</p>
                    }
                  </div>
                </article>

                <article class="panel dashboard-list-panel">
                  <div class="panel-head compact">
                    <span class="material-symbols-rounded">task_alt</span>
                    <div>
                      <p class="ac-eyebrow">Completed</p>
                      <h2>Recently completed</h2>
                    </div>
                  </div>
                  <div class="compact-list dashboard-visit-list">
                    @for (visit of recentCompletedVisits(); track visit.appointment.id) {
                      <button type="button" class="visit-row completed" (click)="selectVisit(visit, 'encounter')">
                        <span class="token-pill done">{{ visit.tokenNumber }}</span>
                        <strong>{{ visit.patientName }}</strong>
                        <small>{{ visit.doctorName }} · {{ visit.appointmentTime }}</small>
                      </button>
                    } @empty {
                      <p class="empty-copy">No completed visits yet.</p>
                    }
                  </div>
                </article>
              </section>
            }

            @case ('queue') {
              <section class="queue-workspace">
                @if (transferVisit(); as visit) {
                  <div class="transfer-panel">
                    <div>
                      <p class="ac-eyebrow">Transfer Doctor</p>
                      <strong>{{ visit.patientName }}</strong>
                      <small>{{ visit.tokenNumber }} · currently with {{ visit.doctorName }}</small>
                    </div>
                    <ac-dropdown name="transferDoctor" [(ngModel)]="transferDoctorId" [options]="transferDoctorOptions()" />
                    <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving() || !transferDoctorId" (click)="confirmTransferDoctor()">
                      <span class="material-symbols-rounded">sync_alt</span>
                      Transfer
                    </button>
                    <button class="ac-btn ac-btn-secondary" type="button" (click)="cancelTransferDoctor()">Cancel</button>
                  </div>
                }

                <div class="queue-table">
                  <div class="queue-table-head">
                    <span>Token</span>
                    <span>Patient</span>
                    <span>Doctor</span>
                    <span>Appointment Time</span>
                    <span>Check-In Time</span>
                    <span>Priority</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  @for (visit of queueVisits(); track visit.appointment.id) {
                    <div class="queue-table-row">
                      <span><strong>{{ visit.tokenNumber }}</strong><small>#{{ visit.queueNo || '-' }}</small></span>
                      <span><strong>{{ visit.patientName }}</strong><small>{{ visit.patientMrn }}</small></span>
                      <span><strong>{{ visit.doctorName }}</strong><small>{{ visit.departmentName }}</small></span>
                      <span>{{ visit.appointmentTime }}</span>
                      <span>{{ visit.arrivalTime || '-' }}</span>
                      <span>{{ visit.priorityCode }}</span>
                      <span><span class="queue-status" [ngClass]="queueStatusClass(visit)">{{ queueStatusLabel(visit) }}</span></span>
                      <span>
                        <div class="queue-row-actions">
                          <button class="tbl-btn primary" type="button" title="Start Consultation" [disabled]="!canUseQueueActions(visit)" (click)="startEncounter(visit)">
                            <span class="material-symbols-rounded">play_arrow</span>
                          </button>
                          <button class="tbl-btn" type="button" title="Skip" [disabled]="!canUseQueueActions(visit)" (click)="skipVisit(visit)">
                            <span class="material-symbols-rounded">skip_next</span>
                          </button>
                          <button class="tbl-btn danger" type="button" title="Mark No Show" [disabled]="!canUseQueueActions(visit)" (click)="markNoShow(visit)">
                            <span class="material-symbols-rounded">event_busy</span>
                          </button>
                          <button class="tbl-btn" type="button" title="Transfer Doctor" [disabled]="!canTransferDoctor(visit)" (click)="openTransferDoctor(visit)">
                            <span class="material-symbols-rounded">sync_alt</span>
                          </button>
                        </div>
                      </span>
                    </div>
                  } @empty {
                    <div class="empty-state">No patients in today's OPD queue.</div>
                  }
                </div>
              </section>
            }

            @case ('check-in') {
              <section class="visit-table">
                <div class="table-head">
                  <span>Appointment</span>
                  <span>Patient</span>
                  <span>Doctor</span>
                  <span>Time</span>
                  <span>Action</span>
                </div>
                @for (visit of pendingCheckIns(); track visit.appointment.id) {
                  <div class="table-row">
                    <span><strong>{{ visit.appointmentNo }}</strong><small>{{ visit.branchName }}</small></span>
                    <span><strong>{{ visit.patientName }}</strong><small>{{ visit.patientMrn }}</small></span>
                    <span><strong>{{ visit.doctorName }}</strong><small>{{ visit.departmentName }}</small></span>
                    <span>{{ visit.appointmentTime }}</span>
                    <span>
                      <button class="ac-btn ac-btn-primary" type="button" (click)="quickCheckIn(visit)">
                        <span class="material-symbols-rounded">how_to_reg</span>
                        Check-In
                      </button>
                    </span>
                  </div>
                } @empty {
                  <div class="empty-state">No scheduled or confirmed appointments pending check-in today.</div>
                }
              </section>
            }

            @case ('active') {
              <ng-container *ngTemplateOutlet="visitList; context: { visits: activeConsultations(), action: 'Continue Encounter' }" />
            }

            @case ('completed') {
              <ng-container *ngTemplateOutlet="visitList; context: { visits: completedVisits(), action: 'Review Visit' }" />
            }

            @case ('encounter') {
              <section class="encounter-layout">
                <aside class="encounter-list">
                  <h2>OPD Encounter</h2>
                  @for (visit of encounterCandidates(); track visit.appointment.id) {
                    <button type="button" [class.active]="selectedVisit()?.appointment?.id === visit.appointment.id" (click)="selectVisit(visit, 'encounter')">
                      <strong>{{ visit.patientName }}</strong>
                      <small>{{ visit.tokenNumber }} · {{ visit.doctorName }}</small>
                    </button>
                  } @empty {
                    <p class="empty-copy">No checked-in or active visits.</p>
                  }
                </aside>

                <article class="encounter-card">
                  @if (selectedVisit(); as visit) {
                    <div class="encounter-head">
                      <div>
                        <p class="ac-eyebrow">OPD Encounter</p>
                        <h2>{{ visit.patientName }}</h2>
                        <span>{{ visit.patientMrn }} · {{ visit.doctorName }} · {{ visit.tokenNumber }}</span>
                      </div>
                      <span class="status-badge">{{ encounterStatusLabel(visit) }}</span>
                    </div>

                    <div class="summary-strip">
                      <span><small>Appointment</small><strong>{{ visit.appointmentNo }}</strong></span>
                      <span><small>Clinical Record</small><strong>{{ encounterRecordNo(visit) }}</strong></span>
                      <span><small>Queue</small><strong>#{{ visit.queueNo || '-' }}</strong></span>
                      <span><small>Arrival</small><strong>{{ visit.arrivalTime || '-' }}</strong></span>
                      <span><small>Priority</small><strong>{{ visit.priorityCode }}</strong></span>
                    </div>

                    <div class="encounter-workspace">
                      <aside class="patient-snapshot">
                        <div class="snapshot-head">
                          <span class="material-symbols-rounded">badge</span>
                          <div>
                            <p class="ac-eyebrow">Always Visible</p>
                            <h3>Patient Snapshot</h3>
                          </div>
                        </div>
                        <div class="snapshot-grid">
                          <span><small>MRN</small><strong>{{ visit.patientMrn }}</strong></span>
                          <span><small>Name</small><strong>{{ visit.patientName }}</strong></span>
                          <span><small>Age / Gender</small><strong>{{ patientAgeGender(visit) }}</strong></span>
                          <span><small>Blood Group</small><strong>{{ visit.patient?.bloodGroupName || '-' }}</strong></span>
                          <span><small>Allergies</small><strong>{{ visit.patient?.knownAllergies || 'None recorded' }}</strong></span>
                          <span><small>Medical Conditions</small><strong>{{ visit.patient?.knownConditions || 'None recorded' }}</strong></span>
                          <span><small>Previous Visits</small><strong>{{ previousVisitCount(visit) }}</strong></span>
                          <span><small>Current Medications</small><strong>{{ currentMedicationSummary() }}</strong></span>
                        </div>
                      </aside>

                      <section class="clinical-board">
                        <nav class="encounter-section-tabs" aria-label="OPD encounter sections">
                          @for (section of encounterSections; track section.id) {
                            <button type="button" [class.active]="activeEncounterSection() === section.id" (click)="activeEncounterSection.set(section.id)">
                              <span class="material-symbols-rounded">{{ section.icon }}</span>
                              {{ section.label }}
                            </button>
                          }
                        </nav>

                        <div class="section-panel">
                          @switch (activeEncounterSection()) {
                            @case ('snapshot') {
                              <div class="section-title">
                                <h3>Patient Snapshot</h3>
                                <p>Registry and care context for this OPD encounter.</p>
                              </div>
                              <div class="snapshot-detail-grid">
                                <span><small>MRN</small><strong>{{ visit.patientMrn }}</strong></span>
                                <span><small>Name</small><strong>{{ visit.patientName }}</strong></span>
                                <span><small>Age</small><strong>{{ visit.patient?.age ?? '-' }}</strong></span>
                                <span><small>Gender</small><strong>{{ visit.patient?.genderName || '-' }}</strong></span>
                                <span><small>Blood Group</small><strong>{{ visit.patient?.bloodGroupName || '-' }}</strong></span>
                                <span><small>Allergies</small><strong>{{ visit.patient?.knownAllergies || 'None recorded' }}</strong></span>
                                <span><small>Medical Conditions</small><strong>{{ visit.patient?.knownConditions || 'None recorded' }}</strong></span>
                                <span><small>Previous Visits</small><strong>{{ previousVisitCount(visit) }}</strong></span>
                              </div>
                            }
                            @case ('vitals') {
                              <div class="section-title">
                                <h3>Vitals</h3>
                                <p>BMI is calculated automatically from height and weight.</p>
                              </div>
                              <div class="clinical-grid">
                                <label class="field"><span>Temperature</span><input name="temperature" [(ngModel)]="clinicalForm().vitals.temperature" placeholder="98.6 F" /></label>
                                <label class="field"><span>Blood Pressure</span><input name="bloodPressure" [(ngModel)]="clinicalForm().vitals.bloodPressure" placeholder="120/80" /></label>
                                <label class="field"><span>Pulse Rate</span><input name="pulseRate" [(ngModel)]="clinicalForm().vitals.pulseRate" placeholder="72 bpm" /></label>
                                <label class="field"><span>Respiratory Rate</span><input name="respiratoryRate" [(ngModel)]="clinicalForm().vitals.respiratoryRate" placeholder="16 / min" /></label>
                                <label class="field"><span>SpO2</span><input name="spo2" [(ngModel)]="clinicalForm().vitals.spo2" placeholder="98%" /></label>
                                <label class="field"><span>Height</span><input name="height" [(ngModel)]="clinicalForm().vitals.height" placeholder="cm" /></label>
                                <label class="field"><span>Weight</span><input name="weight" [(ngModel)]="clinicalForm().vitals.weight" placeholder="kg" /></label>
                                <span class="metric-tile"><small>BMI</small><strong>{{ bmiValue() || '-' }}</strong></span>
                              </div>
                            }
                            @case ('consultation') {
                              <div class="consultation-stack">
                                <section>
                                  <div class="section-title">
                                    <h3>Consultation</h3>
                                    <p>Capture chief complaints, clinical history, and examination findings in one place.</p>
                                  </div>
                                  <div class="clinical-grid">
                                    <label class="field"><span>Complaint</span><input name="complaint" [(ngModel)]="clinicalForm().complaintDraft.complaint" placeholder="Body pain" /></label>
                                    <label class="field"><span>Duration</span><input name="complaintDuration" [(ngModel)]="clinicalForm().complaintDraft.duration" placeholder="2 days" /></label>
                                    <label class="field"><span>Severity</span><ac-dropdown name="complaintSeverity" [(ngModel)]="clinicalForm().complaintDraft.severity" [options]="complaintSeverityOptions" /></label>
                                    <label class="field wide"><span>Notes</span><input name="complaintNotes" [(ngModel)]="clinicalForm().complaintDraft.notes" placeholder="Associated symptoms or trigger" /></label>
                                  </div>
                                  <button class="ac-btn ac-btn-secondary" type="button" (click)="addComplaint()"><span class="material-symbols-rounded">add</span>Add Complaint</button>
                                  <div class="chip-list">
                                    @for (item of clinicalForm().complaints; track $index) {
                                      <span>{{ item.complaint }} · {{ item.severity }} <button type="button" (click)="removeComplaint($index)">Remove</button></span>
                                    }
                                  </div>
                                </section>

                                <section>
                                  <div class="section-title"><h3>Clinical History</h3><p>Present illness and relevant medical background.</p></div>
                                  <div class="clinical-grid single">
                                    <label class="field"><span>Present Illness</span><textarea rows="3" name="presentIllness" [(ngModel)]="clinicalForm().history.presentIllness"></textarea></label>
                                    <label class="field"><span>Past History</span><textarea rows="3" name="pastHistory" [(ngModel)]="clinicalForm().history.pastHistory"></textarea></label>
                                    <label class="field"><span>Family History</span><textarea rows="3" name="familyHistory" [(ngModel)]="clinicalForm().history.familyHistory"></textarea></label>
                                    <label class="field"><span>Surgical History</span><textarea rows="3" name="surgicalHistory" [(ngModel)]="clinicalForm().history.surgicalHistory"></textarea></label>
                                  </div>
                                </section>

                                <section>
                                  <div class="section-title"><h3>Examination</h3><p>General, system, and observational findings.</p></div>
                                  <div class="clinical-grid single">
                                    <label class="field"><span>General Examination</span><textarea rows="3" name="generalExamination" [(ngModel)]="clinicalForm().examination.generalExamination"></textarea></label>
                                    <label class="field"><span>System Examination</span><textarea rows="3" name="systemExamination" [(ngModel)]="clinicalForm().examination.systemExamination"></textarea></label>
                                    <label class="field"><span>Observations</span><textarea rows="3" name="observations" [(ngModel)]="clinicalForm().examination.observations"></textarea></label>
                                  </div>
                                </section>
                              </div>
                            }
                            @case ('diagnosis') {
                              <div class="section-title"><h3>Diagnosis</h3><p>Primary and secondary diagnoses are supported.</p></div>
                              <div class="clinical-grid">
                                <label class="field"><span>ICD Code</span><input name="diagnosisCode" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisCode" placeholder="M25.512" /></label>
                                <label class="field"><span>Diagnosis</span><input name="diagnosisName" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisName" placeholder="Shoulder Pain" /></label>
                                <div class="field">
                                  <span>Type</span>
                                  <div class="radio-segment">
                                    <label><input type="radio" name="diagnosisType" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisType" value="PRIMARY" /> Primary</label>
                                    <label><input type="radio" name="diagnosisType" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisType" value="SECONDARY" /> Secondary</label>
                                  </div>
                                </div>
                                <label class="field wide"><span>Notes</span><input name="diagnosisNotes" [(ngModel)]="clinicalForm().diagnosisDraft.notes" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" (click)="addDiagnosis()"><span class="material-symbols-rounded">add</span>Add Diagnosis</button>
                              <div class="record-list">
                                @for (item of clinicalForm().diagnoses; track $index) {
                                  <span><strong>{{ item.diagnosisName }}</strong><small>{{ item.diagnosisCode || '-' }} · {{ item.diagnosisType }}</small><button type="button" (click)="removeDiagnosis($index)">Remove</button></span>
                                }
                              </div>
                            }
                            @case ('prescription') {
                              <div class="section-title"><h3>Prescription</h3><p>Medicine instructions are linked to this OPD encounter.</p></div>
                              @if (prescriptionHeader(); as header) {
                                <section class="prescription-header-card">
                                  <div class="prescription-header-title">
                                    <span class="material-symbols-rounded">receipt_long</span>
                                    <div>
                                      <p class="ac-eyebrow">Auto-populated Header</p>
                                      <h3>{{ header.prescriptionNo }}</h3>
                                    </div>
                                  </div>

                                  <div class="prescription-header-grid">
                                    <article>
                                      <h4>Patient Information</h4>
                                      <span><small>Patient Name</small><strong>{{ header.patientName }}</strong></span>
                                      <span><small>MRN</small><strong>{{ header.patientMrn }}</strong></span>
                                      <span><small>Age</small><strong>{{ header.age }}</strong></span>
                                      <span><small>Gender</small><strong>{{ header.gender }}</strong></span>
                                      <span><small>Blood Group</small><strong>{{ header.bloodGroup }}</strong></span>
                                      <span><small>Mobile Number</small><strong>{{ header.mobileNo }}</strong></span>
                                      <span><small>Address</small><strong>{{ header.patientAddress }}</strong></span>
                                    </article>

                                    <article>
                                      <h4>Doctor Information</h4>
                                      <span><small>Doctor Name</small><strong>{{ header.doctorName }}</strong></span>
                                      <span><small>Specialization</small><strong>{{ header.specialization }}</strong></span>
                                      <span><small>Registration Number</small><strong>{{ header.registrationNo }}</strong></span>
                                      <span><small>Department</small><strong>{{ header.departmentName }}</strong></span>
                                      <span><small>Hospital Name</small><strong>{{ header.hospitalName }}</strong></span>
                                      <span><small>Hospital Address</small><strong>{{ header.hospitalAddress }}</strong></span>
                                      <span><small>Hospital Contact</small><strong>{{ header.hospitalContact }}</strong></span>
                                    </article>

                                    <article>
                                      <h4>Encounter Information</h4>
                                      <span><small>Prescription Number</small><strong>{{ header.prescriptionNo }}</strong></span>
                                      <span><small>Prescription Date & Time</small><strong>{{ header.prescriptionDateTime }}</strong></span>
                                      <span><small>Appointment ID</small><strong>{{ header.appointmentNo }}</strong></span>
                                      <span><small>OPD Encounter ID</small><strong>{{ header.opdEncounterNo }}</strong></span>
                                      <span><small>Visit Type</small><strong>{{ header.visitType }}</strong></span>
                                    </article>
                                  </div>
                                </section>
                              }
                              @if (prescriptionLocked()) {
                                <div class="prescription-lock-banner">
                                  <span class="material-symbols-rounded">verified</span>
                                  <div>
                                    <strong>Prescription {{ prescriptionStatusLabel() }}</strong>
                                    <p>Create a revised prescription before changing issued medical instructions.</p>
                                  </div>
                                </div>
                              }
                              <section class="prescription-template-panel" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="template-panel-head">
                                  <div class="template-panel-title">
                                    <span class="material-symbols-rounded">auto_awesome</span>
                                    <div>
                                      <p class="ac-eyebrow">Prescription Templates</p>
                                      <h3>Apply common treatment set</h3>
                                      <p>Use saved medicine, advice, and follow-up templates to reduce consultation time.</p>
                                    </div>
                                  </div>
                                  <div class="template-apply-row">
                                    <ac-dropdown
                                      name="prescriptionTemplate"
                                      [(ngModel)]="selectedPrescriptionTemplateId"
                                      [options]="prescriptionTemplateOptions()"
                                    />
                                    <button class="ac-btn ac-btn-primary" type="button" [disabled]="!selectedPrescriptionTemplateId" (click)="applyPrescriptionTemplate()">
                                      <span class="material-symbols-rounded">post_add</span>
                                      Apply Template
                                    </button>
                                    <button class="ac-btn ac-btn-secondary" type="button" [disabled]="!canSavePrescriptionTemplate()" (click)="openSavePrescriptionTemplate()">
                                      <span class="material-symbols-rounded">bookmark_add</span>
                                      Save Current
                                    </button>
                                  </div>
                                </div>
                                <div class="template-card-grid">
                                  @for (template of prescriptionTemplates(); track template.id) {
                                    <button
                                      type="button"
                                      class="template-card"
                                      [class.active]="selectedPrescriptionTemplateId === template.id"
                                      (click)="applyPrescriptionTemplate(template.id)"
                                    >
                                      <strong>{{ template.name }}</strong>
                                      <small>{{ template.description }}</small>
                                      <span>{{ template.medicines.length }} medicines · {{ template.advice.length }} advice · Follow-up {{ template.followUpAfterDays }} days</span>
                                    </button>
                                  }
                                </div>
                              </section>
                              <section class="prescription-vitals-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="mini-section-title">
                                  <div>
                                    <h4>Vitals</h4>
                                    <p>Include vitals only when the doctor wants them printed on this prescription.</p>
                                  </div>
                                  <label class="include-toggle">
                                    <input type="checkbox" name="includeVitalsInPrescription" [(ngModel)]="clinicalForm().includeVitalsInPrescription" />
                                    Include Vitals in Prescription
                                  </label>
                                </div>
                                <div class="prescription-vitals-grid">
                                  <span><small>Blood Pressure</small><strong>{{ clinicalForm().vitals.bloodPressure || '-' }}</strong></span>
                                  <span><small>Pulse Rate</small><strong>{{ clinicalForm().vitals.pulseRate || '-' }}</strong></span>
                                  <span><small>Temperature</small><strong>{{ clinicalForm().vitals.temperature || '-' }}</strong></span>
                                  <span><small>SpO2</small><strong>{{ clinicalForm().vitals.spo2 || '-' }}</strong></span>
                                  <span><small>Weight</small><strong>{{ clinicalForm().vitals.weight || '-' }}</strong></span>
                                  <span><small>Height</small><strong>{{ clinicalForm().vitals.height || '-' }}</strong></span>
                                  <span><small>BMI</small><strong>{{ bmiValue() || '-' }}</strong></span>
                                </div>
                              </section>
                              <section class="clinical-info-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="section-title">
                                  <h3>Clinical Information</h3>
                                  <p>Symptoms, chief complaints, and diagnoses that should appear with this prescription.</p>
                                </div>

                                <div class="clinical-info-block">
                                  <div class="mini-section-title">
                                    <h4>Symptoms / Chief Complaints</h4>
                                    <span>{{ clinicalForm().complaints.length }} added</span>
                                  </div>
                                  <div class="quick-complaints">
                                    @for (complaint of complaintTemplates; track complaint) {
                                      <button type="button" (click)="useComplaintTemplate(complaint)">{{ complaint }}</button>
                                    }
                                  </div>
                                  <div class="clinical-grid">
                                    <label class="field"><span>Complaint</span><input name="rxComplaint" [(ngModel)]="clinicalForm().complaintDraft.complaint" placeholder="Weakness" /></label>
                                    <label class="field"><span>Duration</span><input name="rxComplaintDuration" [(ngModel)]="clinicalForm().complaintDraft.duration" placeholder="2 days" /></label>
                                    <label class="field"><span>Severity</span><ac-dropdown name="rxComplaintSeverity" [(ngModel)]="clinicalForm().complaintDraft.severity" [options]="complaintSeverityOptions" /></label>
                                    <label class="field wide"><span>Notes</span><input name="rxComplaintNotes" [(ngModel)]="clinicalForm().complaintDraft.notes" placeholder="Associated symptoms or trigger" /></label>
                                  </div>
                                  <button class="ac-btn ac-btn-secondary" type="button" (click)="addComplaint()"><span class="material-symbols-rounded">add</span>Add Complaint</button>
                                  <div class="chip-list">
                                    @for (item of clinicalForm().complaints; track $index) {
                                      <span>{{ item.complaint }} · {{ item.severity }} <button type="button" (click)="removeComplaint($index)">Remove</button></span>
                                    }
                                  </div>
                                </div>

                                <div class="clinical-info-block">
                                  <div class="mini-section-title">
                                    <h4>Diagnosis</h4>
                                    <span>Multiple diagnoses supported</span>
                                  </div>
                                  <div class="clinical-grid">
                                    <label class="field"><span>Diagnosis</span><input name="rxDiagnosisName" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisName" placeholder="Shoulder Pain" /></label>
                                    <label class="field"><span>ICD Code</span><input name="rxDiagnosisCode" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisCode" placeholder="M25.512" /></label>
                                    <div class="field">
                                      <span>Type</span>
                                      <div class="radio-segment">
                                        <label><input type="radio" name="rxDiagnosisType" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisType" value="PRIMARY" /> Primary</label>
                                        <label><input type="radio" name="rxDiagnosisType" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisType" value="SECONDARY" /> Secondary</label>
                                      </div>
                                    </div>
                                    <label class="field wide"><span>Notes</span><input name="rxDiagnosisNotes" [(ngModel)]="clinicalForm().diagnosisDraft.notes" /></label>
                                  </div>
                                  <button class="ac-btn ac-btn-secondary" type="button" (click)="addDiagnosis()"><span class="material-symbols-rounded">add</span>Add Diagnosis</button>
                                  <div class="record-list">
                                    @for (item of clinicalForm().diagnoses; track $index) {
                                      <span><strong>{{ item.diagnosisName }}</strong><small>{{ item.diagnosisCode || '-' }} · {{ item.diagnosisType }}</small><button type="button" (click)="removeDiagnosis($index)">Remove</button></span>
                                    }
                                  </div>
                                </div>
                              </section>
                              <section class="medicine-composer" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="section-title">
                                  <h3>Medicine / Prescription</h3>
                                  <p>Add each medicine as a separate row with strength, form, dosage, frequency, route, duration, quantity, and instructions.</p>
                                </div>
                                <div class="clinical-grid medicine-grid">
                                  <div class="field medicine-search-field">
                                    <span>Medicine Name *</span>
                                    <input
                                      name="medicine"
                                      [ngModel]="clinicalForm().prescriptionDraft.medicine"
                                      (ngModelChange)="updateMedicineSearch($event)"
                                      placeholder="Search Medicine..."
                                      autocomplete="off"
                                    />
                                    @if (medicineSearchResults().length > 0) {
                                      <div class="medicine-suggestions">
                                        @for (medicine of medicineSearchResults(); track medicine.key) {
                                          <button type="button" (click)="selectMedicineSuggestion(medicine)">
                                            <strong>{{ medicine.label }}</strong>
                                            <small>{{ medicine.name }} · {{ medicine.strength || '-' }} · {{ medicine.form || '-' }}</small>
                                          </button>
                                        }
                                      </div>
                                    }
                                  </div>
                                  <label class="field"><span>Strength</span><input name="medicineStrength" [(ngModel)]="clinicalForm().prescriptionDraft.strength" placeholder="500 mg" /></label>
                                  <label class="field"><span>Dosage Form</span><input name="dosageForm" [(ngModel)]="clinicalForm().prescriptionDraft.dosageForm" placeholder="Tablet" /></label>
                                  <label class="field"><span>Dosage</span><input name="dosage" [(ngModel)]="clinicalForm().prescriptionDraft.dosage" placeholder="1 Tablet" /></label>
                                  <label class="field">
                                    <span>Frequency</span>
                                    <ac-dropdown
                                      name="frequencyPreset"
                                      [ngModel]="frequencySelection()"
                                      (ngModelChange)="updateFrequencySelection($event)"
                                      [options]="frequencyOptions"
                                    />
                                  </label>
                                  <label class="field"><span>Route</span><input name="route" [(ngModel)]="clinicalForm().prescriptionDraft.route" placeholder="Oral" /></label>
                                  <label class="field"><span>Duration</span><input name="duration" [(ngModel)]="clinicalForm().prescriptionDraft.duration" placeholder="5 Days" /></label>
                                  <label class="field"><span>Quantity</span><input name="quantity" [(ngModel)]="clinicalForm().prescriptionDraft.quantity" placeholder="10" /></label>
                                  @if (customFrequencyMode()) {
                                    <label class="field"><span>Custom Frequency</span><input name="customFrequency" [(ngModel)]="clinicalForm().prescriptionDraft.frequency" placeholder="Enter custom frequency" /></label>
                                  }
                                  <label class="field wide"><span>Instructions</span><input name="instructions" [(ngModel)]="clinicalForm().prescriptionDraft.instructions" placeholder="After Food" /></label>
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addPrescriptionItem()"><span class="material-symbols-rounded">add</span>Add Medicine</button>
                              </section>
                              <div class="medicine-table" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="medicine-table-head">
                                  <span>#</span>
                                  <span>Medicine</span>
                                  <span>Strength</span>
                                  <span>Form</span>
                                  <span>Frequency</span>
                                  <span>Route</span>
                                  <span>Duration</span>
                                  <span>Instructions</span>
                                  <span></span>
                                </div>
                                @for (item of clinicalForm().prescriptions; track $index) {
                                  <div class="medicine-table-row">
                                    <span>{{ $index + 1 }}</span>
                                    <span><strong>{{ item.medicine }}</strong><small>{{ item.dosage || item.quantity || '-' }}</small></span>
                                    <span>{{ item.strength || '-' }}</span>
                                    <span>{{ item.dosageForm || '-' }}</span>
                                    <span>{{ item.frequency || '-' }}</span>
                                    <span>{{ item.route || '-' }}</span>
                                    <span>{{ item.duration || '-' }}</span>
                                    <span>{{ item.instructions || '-' }}</span>
                                    <span><button type="button" (click)="removePrescriptionItem($index)">Remove</button></span>
                                  </div>
                                } @empty {
                                  <div class="empty-state compact">No medicines added yet.</div>
                                }
                              </div>
                              <section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="mini-section-title">
                                  <div>
                                    <h4>Investigations</h4>
                                    <p>Tests and imaging to show on the printed prescription.</p>
                                  </div>
                                  <label class="include-toggle"><input type="checkbox" name="includeInvestigations" [(ngModel)]="clinicalForm().includeInvestigationsInPrescription" /> Include in Prescription</label>
                                </div>
                                <div class="quick-complaints">
                                  @for (investigation of investigationTemplates; track investigation) {
                                    <button type="button" (click)="addInvestigation(investigation)">{{ investigation }}</button>
                                  }
                                </div>
                                <div class="clinical-grid single">
                                  <label class="field"><span>Investigation</span><input name="investigationDraft" [(ngModel)]="clinicalForm().investigationDraft" placeholder="CBC, Blood Sugar, X-Ray..." /></label>
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addInvestigation()"><span class="material-symbols-rounded">add</span>Add Investigation</button>
                                <div class="chip-list">
                                  @for (item of clinicalForm().prescriptionInvestigations; track $index) {
                                    <span>{{ item }} <button type="button" (click)="removeInvestigation($index)">Remove</button></span>
                                  }
                                </div>
                              </section>
                              <section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="mini-section-title">
                                  <div>
                                    <h4>Procedures</h4>
                                    <p>Procedures advised or performed during this visit.</p>
                                  </div>
                                  <span>{{ clinicalForm().procedures.length }} added</span>
                                </div>
                                <div class="quick-complaints">
                                  @for (procedure of procedureTemplates; track procedure) {
                                    <button type="button" (click)="useProcedureTemplate(procedure)">{{ procedure }}</button>
                                  }
                                </div>
                                <div class="clinical-grid">
                                  <label class="field"><span>Procedure</span><input name="rxProcedure" [(ngModel)]="clinicalForm().procedureDraft.procedure" placeholder="Physiotherapy" /></label>
                                  <label class="field"><span>Charge</span><input name="rxProcedureCharge" [(ngModel)]="clinicalForm().procedureDraft.charge" placeholder="500" /></label>
                                  <label class="field wide"><span>Notes</span><input name="rxProcedureNotes" [(ngModel)]="clinicalForm().procedureDraft.notes" /></label>
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addProcedure()"><span class="material-symbols-rounded">add</span>Add Procedure</button>
                                <div class="record-list">
                                  @for (item of clinicalForm().procedures; track $index) {
                                    <span><strong>{{ item.procedure }}</strong><small>{{ item.charge ? currency(toAmount(item.charge)) : 'No charge' }} · {{ item.notes || '-' }}</small><button type="button" (click)="removeProcedure($index)">Remove</button></span>
                                  }
                                </div>
                              </section>
                              <section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="mini-section-title">
                                  <div>
                                    <h4>Advice</h4>
                                    <p>Free text or predefined instructions for the patient.</p>
                                  </div>
                                  <span>{{ clinicalForm().adviceList.length }} added</span>
                                </div>
                                <div class="quick-complaints">
                                  @for (advice of adviceTemplates; track advice) {
                                    <button type="button" (click)="addAdvice(advice)">{{ advice }}</button>
                                  }
                                </div>
                                <div class="clinical-grid single">
                                  <label class="field"><span>Advice</span><input name="adviceDraft" [(ngModel)]="clinicalForm().adviceDraft" placeholder="Take adequate rest." /></label>
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addAdvice()"><span class="material-symbols-rounded">add</span>Add Advice</button>
                                <div class="chip-list">
                                  @for (item of clinicalForm().adviceList; track $index) {
                                    <span>{{ item }} <button type="button" (click)="removeAdvice($index)">Remove</button></span>
                                  }
                                </div>
                              </section>
                              <section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="mini-section-title">
                                  <div>
                                    <h4>Diet Advice</h4>
                                    <p>Diet instructions to print separately from medicines.</p>
                                  </div>
                                  <span>{{ clinicalForm().dietAdviceList.length }} added</span>
                                </div>
                                <div class="clinical-grid">
                                  <label class="field">
                                    <span>Diet Advice</span>
                                    <ac-dropdown name="dietAdvice" [ngModel]="dietAdviceSelection()" (ngModelChange)="updateDietAdviceSelection($event)" [options]="dietAdviceOptions" />
                                  </label>
                                  @if (customDietAdviceMode()) {
                                    <label class="field wide"><span>Custom Advice</span><input name="customDietAdvice" [(ngModel)]="clinicalForm().dietAdviceDraft" placeholder="Enter diet advice" /></label>
                                  }
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addDietAdvice()"><span class="material-symbols-rounded">add</span>Add Diet Advice</button>
                                <div class="chip-list">
                                  @for (item of clinicalForm().dietAdviceList; track $index) {
                                    <span>{{ item }} <button type="button" (click)="removeDietAdvice($index)">Remove</button></span>
                                  }
                                </div>
                              </section>
                              <section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="mini-section-title">
                                  <div>
                                    <h4>Follow-up</h4>
                                    <p>Calculate next visit date and capture the reason.</p>
                                  </div>
                                  <span>{{ clinicalForm().followUp.followUpDate || 'No date' }}</span>
                                </div>
                                <div class="clinical-grid">
                                  <label class="field"><span>Follow-up After</span><input name="rxFollowUpAfter" [ngModel]="clinicalForm().followUp.followUpAfterDays" (ngModelChange)="updateFollowUpAfterDays($event)" placeholder="7" /></label>
                                  <label class="field"><span>Next Visit Date</span><input type="date" name="rxFollowUpDate" [(ngModel)]="clinicalForm().followUp.followUpDate" /></label>
                                  <label class="field"><span>Reason</span><ac-dropdown name="rxFollowUpReason" [(ngModel)]="clinicalForm().followUp.reason" [options]="followUpReasonOptions" /></label>
                                  <label class="field wide"><span>Notes</span><input name="rxFollowUpNotes" [(ngModel)]="clinicalForm().followUp.notes" placeholder="Review / Test Results / Follow-up" /></label>
                                </div>
                              </section>
                              @if (visit.consultation) {
                                <section class="prescription-action-bar" [class.generated]="prescriptionIssued()" [class.finalized]="prescriptionLocked()">
                                  <div class="prescription-action-status">
                                    <div>
                                      <p class="ac-eyebrow">Prescription Actions</p>
                                      <strong>Prescription Status: <span class="status-dot"></span>{{ prescriptionStatusLabel() }}</strong>
                                    </div>
                                    <span>{{ prescriptionPreview()?.prescriptionNo || 'RX pending' }} · Revision {{ prescriptionRevisionNo() }} · {{ clinicalForm().prescriptions.length }} {{ clinicalForm().prescriptions.length === 1 ? 'medicine' : 'medicines' }} added</span>
                                  </div>

                                  <div class="prescription-action-grid">
                                    <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving() || prescriptionLocked()" (click)="savePrescriptionDraft()">
                                      <span class="material-symbols-rounded">save</span>
                                      Save Draft
                                    </button>
                                    <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="previewPrescription()">
                                      <span class="material-symbols-rounded">preview</span>
                                      Preview
                                    </button>
                                    <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving() || prescriptionLocked()" (click)="generatePrescription()">
                                      <span class="material-symbols-rounded">receipt_long</span>
                                      Generate Prescription
                                    </button>
                                    <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving() || prescriptionLocked()" (click)="finalizePrescription()">
                                      <span class="material-symbols-rounded">verified</span>
                                      Finalize
                                    </button>
                                    @if (prescriptionLocked()) {
                                      <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="createRevisedPrescription()">
                                        <span class="material-symbols-rounded">edit_note</span>
                                        Create Revised Prescription
                                      </button>
                                    }
                                    <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="printPrescription()">
                                      <span class="material-symbols-rounded">print</span>
                                      Print Prescription
                                    </button>
                                    <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="downloadPrescription()">
                                      <span class="material-symbols-rounded">download</span>
                                      Download PDF
                                    </button>
                                    <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="sharePrescription()">
                                      <span class="material-symbols-rounded">ios_share</span>
                                      Share to Patient
                                    </button>
                                    <button class="ac-btn ac-btn-primary complete-action" type="button" [disabled]="saving()" (click)="completeVisit()">
                                      <span class="material-symbols-rounded">task_alt</span>
                                      Complete Consultation
                                    </button>
                                  </div>
                                </section>
                              } @else {
                                <div class="empty-state compact">Start the OPD consultation before generating a prescription.</div>
                              }
                            }
                            @case ('lab-orders') {
                              <div class="lab-order-composer">
                                <div class="section-title lab-order-title">
                                  <span class="material-symbols-rounded">biotech</span>
                                  <div>
                                    <h3>Lab Orders</h3>
                                    <p>Submitted tests create a laboratory queue order.</p>
                                  </div>
                                </div>
                                <div class="clinical-grid lab-order-grid">
                                  <label class="field"><span>Test Category</span><input name="testCategory" [(ngModel)]="clinicalForm().labOrderDraft.testCategory" placeholder="Hematology" /></label>
                                  <label class="field"><span>Test</span><ac-dropdown name="labTest" [(ngModel)]="clinicalForm().labOrderDraft.testId" [options]="labTestOptions()" /></label>
                                  <label class="field"><span>Priority</span><ac-dropdown name="labPriority" [(ngModel)]="clinicalForm().labOrderDraft.priority" [options]="labPriorityOptions" /></label>
                                  <label class="field wide"><span>Notes</span><input name="labNotes" [(ngModel)]="clinicalForm().labOrderDraft.notes" placeholder="Special instructions for laboratory team" /></label>
                                </div>
                                <div class="lab-order-actions">
                                  <button class="ac-btn ac-btn-secondary" type="button" (click)="addLabOrderDraft()"><span class="material-symbols-rounded">add</span>Add Test</button>
                                  <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="createLabOrder(visit)"><span class="material-symbols-rounded">biotech</span>Create Lab Order</button>
                                </div>
                              </div>
                              <div class="record-list">
                                @for (item of clinicalForm().labOrders; track $index) {
                                  <span><strong>{{ labTestName(item.testId) }}</strong><small>{{ item.testCategory || '-' }} · {{ item.priority }}</small><button type="button" (click)="removeLabOrder($index)">Remove</button></span>
                                }
                              </div>
                            }
                            @case ('procedures') {
                              <div class="section-title"><h3>Procedures</h3><p>Procedures are added to notes and billing services.</p></div>
                              <div class="clinical-grid">
                                <label class="field"><span>Procedure</span><input name="procedure" [(ngModel)]="clinicalForm().procedureDraft.procedure" placeholder="Dressing" /></label>
                                <label class="field"><span>Charge</span><input name="procedureCharge" [(ngModel)]="clinicalForm().procedureDraft.charge" placeholder="500" /></label>
                                <label class="field wide"><span>Notes</span><input name="procedureNotes" [(ngModel)]="clinicalForm().procedureDraft.notes" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" (click)="addProcedure()"><span class="material-symbols-rounded">add</span>Add Procedure</button>
                              <div class="record-list">
                                @for (item of clinicalForm().procedures; track $index) {
                                  <span><strong>{{ item.procedure }}</strong><small>{{ currency(toAmount(item.charge)) }} · {{ item.notes || '-' }}</small><button type="button" (click)="removeProcedure($index)">Remove</button></span>
                                }
                              </div>
                            }
                            @case ('notes') {
                              <div class="section-title"><h3>Clinical Notes</h3><p>Free-form clinical summary for this encounter.</p></div>
                              <label class="field"><span>Clinical Notes</span><textarea rows="9" name="clinicalNotes" [(ngModel)]="clinicalForm().clinicalNotes" placeholder="Capture summary, advice, counseling, and follow-up plan."></textarea></label>
                            }
                            @case ('follow-up') {
                              <div class="section-title"><h3>Follow-up</h3><p>Create a follow-up task or appointment automatically.</p></div>
                              <div class="clinical-grid">
                                <label class="check-field"><input type="checkbox" name="followUpRequired" [(ngModel)]="clinicalForm().followUp.followUpRequired" /> Follow-up Required</label>
                                <label class="field"><span>Follow-up Date</span><input type="date" name="followUpDate" [(ngModel)]="clinicalForm().followUp.followUpDate" /></label>
                                <label class="field"><span>Preferred Doctor</span><ac-dropdown name="preferredDoctor" [(ngModel)]="clinicalForm().followUp.preferredDoctorId" [options]="preferredDoctorOptions()" /></label>
                                <label class="check-field"><input type="checkbox" name="createFollowUpAppointment" [(ngModel)]="clinicalForm().followUp.createAppointment" /> Create Follow-Up Appointment Automatically</label>
                                <label class="field wide"><span>Notes</span><input name="followUpNotes" [(ngModel)]="clinicalForm().followUp.notes" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="createFollowUp(visit)"><span class="material-symbols-rounded">event_repeat</span>Create Follow-Up</button>
                            }
                          }
                        </div>
                      </section>
                    </div>

                    <div class="encounter-actions">
                      @if (!visit.consultation) {
                        <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="startEncounter(visit)">
                          <span class="material-symbols-rounded">stethoscope</span>
                          Start OPD Consultation
                        </button>
                      }
                    </div>
                  } @else {
                    <div class="empty-state">Select a checked-in patient to begin the OPD encounter.</div>
                  }
                </article>
              </section>
            }
          }
        }
      </section>

      @if (prescriptionPreviewOpen()) {
        @if (prescriptionPreview(); as prescription) {
          <div class="prescription-backdrop" (click)="closePrescriptionPreview()">
            <section class="prescription-modal" (click)="$event.stopPropagation()" aria-label="Prescription preview">
              <header class="prescription-modal-head">
                <div>
                  <p class="ac-eyebrow">Generated Prescription</p>
                  <h2>{{ prescription.patientName }}</h2>
                  <span>{{ prescription.patientMrn }} · {{ prescription.ageGender }} · {{ prescription.generatedAt }}</span>
                </div>
                <button class="modal-close" type="button" aria-label="Close prescription preview" (click)="closePrescriptionPreview()">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </header>

              <div class="prescription-paper rx-sheet">
                <header class="rx-sheet-head">
                  <div class="rx-logo-mark">
                    <span class="material-symbols-rounded">ecg_heart</span>
                  </div>
                  <div>
                    <p class="rx-label">Hospital Logo</p>
                    <h2>{{ prescription.hospitalName }}</h2>
                    <span>{{ prescription.branchName }}</span>
                  </div>
                  <aside>
                    <strong>{{ prescription.prescriptionNo }}</strong>
                    <small>{{ prescription.statusLabel }} · Revision {{ prescription.revisionNo }}</small>
                  </aside>
                </header>

                <section class="rx-doctor-block">
                  <h3>{{ prescription.doctorName }}</h3>
                  <p>{{ prescription.doctorQualification }} | Registration No. {{ prescription.doctorRegistrationNo }}</p>
                  <span>{{ prescription.departmentName }}</span>
                </section>

                <section class="rx-patient-block">
                  <div><small>Patient</small><strong>{{ prescription.patientName }}</strong></div>
                  <div><small>Date</small><strong>{{ prescription.generatedAt }}</strong></div>
                  <div><small>Age / Gender</small><strong>{{ prescription.ageGender }}</strong></div>
                  <div><small>MRN</small><strong>{{ prescription.patientMrn }}</strong></div>
                  <p><strong>Vitals:</strong> {{ prescription.vitalSummary }}</p>
                  <p><strong>Symptoms:</strong> {{ prescription.symptomSummary }}</p>
                  <p><strong>Diagnosis:</strong> {{ prescription.diagnosisSummary }}</p>
                </section>

                <section class="rx-medicine-block">
                  <h3>Rx</h3>
                  <ol>
                    @for (medicine of prescription.medicines; track $index) {
                      <li>
                        <strong>{{ prescriptionMedicineName(medicine) }}</strong>
                        <span>{{ prescriptionMedicineInstruction(medicine) }}</span>
                      </li>
                    } @empty {
                      <li><strong>No medicines captured.</strong></li>
                    }
                  </ol>
                </section>

                <section class="rx-advice-grid">
                  @if (prescription.investigations.length) {
                    <article>
                      <h3>Investigations</h3>
                      <ul>
                        @for (item of prescription.investigations; track $index) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </article>
                  }
                  @if (prescription.procedures.length) {
                    <article>
                      <h3>Procedures</h3>
                      <ul>
                        @for (item of prescription.procedures; track $index) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </article>
                  }
                  <article>
                    <h3>Advice</h3>
                    <ul>
                      @for (item of prescription.advice.length ? prescription.advice : [prescription.notes || 'Follow medical advice and return if symptoms worsen.']; track $index) {
                        <li>{{ item }}</li>
                      }
                    </ul>
                  </article>
                  @if (prescription.dietAdvice.length) {
                    <article>
                      <h3>Diet Advice</h3>
                      <ul>
                        @for (item of prescription.dietAdvice; track $index) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </article>
                  }
                  @if (prescription.followUp.length) {
                    <article class="wide">
                      <h3>Follow-up</h3>
                      <p>{{ prescription.followUpSummary }}</p>
                    </article>
                  }
                </section>

                <footer class="rx-sheet-foot">
                  <div class="rx-qr">
                    <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                  </div>
                  <div>
                    <strong>Scan to access digital prescription</strong>
                    <small>{{ prescription.opdEncounterNo }} · {{ prescription.appointmentNo }}</small>
                  </div>
                  <div class="rx-signature">
                    <strong>Doctor Signature</strong>
                    <span>{{ prescription.doctorName }}</span>
                  </div>
                </footer>
                <p class="rx-disclaimer">Disclaimer: This prescription is generated from the Care360 OPD encounter and should be used only under the advice of the issuing doctor.</p>
              </div>

              <footer class="prescription-modal-actions">
                <button class="ac-btn ac-btn-secondary" type="button" (click)="sharePrescription()">
                  <span class="material-symbols-rounded">ios_share</span>
                  Share to Patient
                </button>
                <button class="ac-btn ac-btn-secondary" type="button" (click)="downloadPrescription()">
                  <span class="material-symbols-rounded">download</span>
                  Download PDF
                </button>
                <button class="ac-btn ac-btn-primary" type="button" (click)="printPrescription(false)">
                  <span class="material-symbols-rounded">print</span>
                  Print Prescription
                </button>
              </footer>
            </section>
          </div>
        }
      }

      @if (saveTemplateOpen()) {
        <div class="prescription-backdrop" (click)="closeSavePrescriptionTemplate()">
          <section class="print-options-modal" (click)="$event.stopPropagation()" aria-label="Save prescription template">
            <header>
              <div>
                <p class="ac-eyebrow">Prescription Templates</p>
                <h2>Save Current Prescription</h2>
              </div>
              <button class="modal-close" type="button" aria-label="Close save template" (click)="closeSavePrescriptionTemplate()">
                <span class="material-symbols-rounded">close</span>
              </button>
            </header>

            <div class="template-save-form">
              <label class="field">
                <span>Template Name *</span>
                <input name="templateName" [(ngModel)]="saveTemplateDraft.name" placeholder="Fever - Adult" />
              </label>
              <label class="field">
                <span>Description</span>
                <input name="templateDescription" [(ngModel)]="saveTemplateDraft.description" placeholder="Common medicines, advice, and follow-up plan" />
              </label>
            </div>

            <footer>
              <button class="ac-btn ac-btn-secondary" type="button" (click)="closeSavePrescriptionTemplate()">Cancel</button>
              <button class="ac-btn ac-btn-primary" type="button" (click)="saveCurrentPrescriptionTemplate()">
                <span class="material-symbols-rounded">save</span>
                Save Template
              </button>
            </footer>
          </section>
        </div>
      }

      @if (printOptionsOpen()) {
        <div class="prescription-backdrop" (click)="closePrintOptions()">
          <section class="print-options-modal" (click)="$event.stopPropagation()" aria-label="Print prescription options">
            <header>
              <div>
                <p class="ac-eyebrow">Print Prescription</p>
                <h2>Prescription Format</h2>
              </div>
              <button class="modal-close" type="button" aria-label="Close print options" (click)="closePrintOptions()">
                <span class="material-symbols-rounded">close</span>
              </button>
            </header>

            <div class="print-format-options">
              <label><input type="radio" name="printFormat" [(ngModel)]="printOptions.format" value="A4" /> Standard A4</label>
              <label><input type="radio" name="printFormat" [(ngModel)]="printOptions.format" value="A5" /> A5</label>
              <label><input type="radio" name="printFormat" [(ngModel)]="printOptions.format" value="THERMAL" /> Thermal / Compact</label>
            </div>

            <div class="print-include-grid">
              <label><input type="checkbox" name="printHospitalHeader" [(ngModel)]="printOptions.includeHospitalHeader" /> Hospital Header</label>
              <label><input type="checkbox" name="printDoctorSignature" [(ngModel)]="printOptions.includeDoctorSignature" /> Doctor Signature</label>
              <label><input type="checkbox" name="printQrCode" [(ngModel)]="printOptions.includeQrCode" /> QR Code</label>
              <label><input type="checkbox" name="printVitals" [(ngModel)]="printOptions.includeVitals" /> Vitals</label>
              <label><input type="checkbox" name="printDiagnosis" [(ngModel)]="printOptions.includeDiagnosis" /> Diagnosis</label>
              <label><input type="checkbox" name="printAdvice" [(ngModel)]="printOptions.includeAdvice" /> Advice</label>
              <label><input type="checkbox" name="printFollowUp" [(ngModel)]="printOptions.includeFollowUp" /> Follow-up</label>
            </div>

            <footer>
              <button class="ac-btn ac-btn-secondary" type="button" (click)="closePrintOptions()">Cancel</button>
              <button class="ac-btn ac-btn-primary" type="button" (click)="confirmPrintPrescription()">
                <span class="material-symbols-rounded">print</span>
                Print
              </button>
            </footer>
          </section>
        </div>
      }

      <ng-template #visitList let-visits="visits" let-action="action">
        <section class="visit-table">
          <div class="table-head">
            <span>Token</span>
            <span>Patient</span>
            <span>Doctor</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          @for (visit of visits; track visit.appointment.id) {
            <div class="table-row">
              <span><strong>{{ visit.tokenNumber }}</strong><small>#{{ visit.queueNo || '-' }}</small></span>
              <span><strong>{{ visit.patientName }}</strong><small>{{ visit.patientMrn }}</small></span>
              <span><strong>{{ visit.doctorName }}</strong><small>{{ visit.departmentName }}</small></span>
              <span>{{ visit.consultationStatus }}</span>
              <span>
                <button class="ac-btn ac-btn-secondary" type="button" (click)="selectVisit(visit, 'encounter')">
                  <span class="material-symbols-rounded">clinical_notes</span>
                  {{ action }}
                </button>
              </span>
            </div>
          } @empty {
            <div class="empty-state">No visits found here.</div>
          }
        </section>
      </ng-template>
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .opd-page { width: 100%; max-width: 100%; min-width: 0; display: grid; gap: 10px; overflow-x: hidden; }
    .page-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .page-desc { margin: 3px 0 0; max-width: 760px; color: var(--ac-muted); font-size: 13px; }
    .header-actions, .queue-actions, .encounter-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .stats-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
    .stat-card { min-height: 56px; display: flex; gap: 9px; align-items: center; padding: 8px 10px; border: 1px solid var(--ac-border); color: inherit; text-align: left; cursor: pointer; }
    .stat-card:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(15, 23, 42, .07); }
    .stat-icon { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; font-size: 17px; }
    .stat-card strong { display: block; color: var(--ac-text); font-size: 19px; line-height: 1; }
    .stat-card span:last-child { display: block; margin-top: 2px; color: var(--ac-muted); font-size: 11.5px; font-weight: 750; }
    .opd-shell { min-width: 0; display: grid; gap: 8px; padding: 8px; overflow: hidden; }
    .opd-tabs { min-width: 0; display: flex; flex-wrap: wrap; gap: 5px; padding: 4px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-subtle); }
    .opd-tabs button { min-height: 32px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 8px; padding: 0 9px; white-space: nowrap; background: transparent; color: var(--ac-muted); font: inherit; font-size: 12.5px; font-weight: 850; cursor: pointer; }
    .opd-tabs button.active { background: var(--ac-surface); color: var(--ac-primary); box-shadow: 0 6px 14px rgba(15, 23, 42, .07); }
    .opd-tabs .material-symbols-rounded { font-size: 18px; }
    .tab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .tab-count { min-width: 22px; min-height: 20px; display: inline-grid; place-items: center; padding: 2px 6px; border-radius: 999px; background: var(--ac-surface); color: var(--ac-muted); font-size: 11px; font-weight: 900; line-height: 1; box-shadow: inset 0 0 0 1px var(--ac-border); }
    .opd-tabs button.active .tab-count { background: var(--ac-primary-light); color: var(--ac-primary); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border)); }
    .toolbar { min-width: 0; display: grid; grid-template-columns: minmax(220px, 1fr) minmax(170px, 230px) 36px; gap: 8px; align-items: center; }
    .search-field { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px; border: 1px solid var(--ac-border); border-radius: 9px; background: var(--ac-surface); color: var(--ac-muted); }
    .search-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ac-text); font: inherit; font-weight: 750; }
    .icon-btn { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 9px; background: var(--ac-surface); color: var(--ac-muted); cursor: pointer; }
    .empty-state { min-height: 240px; display: grid; place-items: center; align-content: center; gap: 10px; color: var(--ac-muted); text-align: center; }
    .empty-state.compact { min-height: 56px; border: 1px dashed var(--ac-border); border-radius: 10px; background: var(--ac-subtle); font-weight: 850; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .opd-command-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 8px; }
    .opd-command-grid { align-items: start; }
    .command-panel { grid-column: 1 / -1; min-width: 0; display: grid; grid-template-columns: minmax(0, .9fr) minmax(360px, 1fr); gap: 10px 14px; align-items: center; overflow: hidden; }
    .command-head { min-width: 0; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .command-head > div { min-width: 0; }
    .command-head h2 { margin: 0; color: var(--ac-text); font-size: 21px; line-height: 1.16; }
    .command-head small { display: block; margin-top: 3px; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .command-score { flex: 0 0 auto; min-height: 28px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: 1px solid color-mix(in srgb, var(--ac-primary) 20%, var(--ac-border)); border-radius: 999px; background: var(--ac-surface); color: var(--ac-primary); font-size: 16px; font-weight: 950; line-height: 1; box-shadow: 0 8px 16px rgba(15, 23, 42, .06); }
    .command-score::after { content: 'complete'; color: var(--ac-muted); font-size: 10px; font-weight: 900; letter-spacing: .03em; text-transform: uppercase; }
    .progress-track { grid-column: 1 / -1; height: 8px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--ac-primary) 12%, var(--ac-border)); }
    .progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2563eb, #10b981); transition: width .24s ease; }
    .panel, .encounter-card, .encounter-list, .queue-card { min-width: 0; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); box-shadow: 0 10px 24px rgba(15, 23, 42, .04); }
    .panel { padding: 12px; }
    .panel-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .panel-head > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: var(--ac-primary-light); color: var(--ac-primary); }
    .panel h2, .encounter-list h2, .encounter-card h2 { margin: 0; color: var(--ac-text); }
    .panel-head small { display: block; margin-top: 3px; color: var(--ac-muted); font-weight: 800; }
    .doctor-queue-panel { background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 7%, var(--ac-surface)), var(--ac-surface)); }
    .doctor-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .doctor-metrics span, .doctor-metrics button { min-height: 58px; display: grid; align-content: center; gap: 3px; padding: 9px 10px; border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border)); border-radius: 9px; background: var(--ac-surface); color: inherit; text-align: left; cursor: pointer; }
    .doctor-metrics button:hover { border-color: color-mix(in srgb, var(--ac-primary) 42%, var(--ac-border)); box-shadow: 0 8px 18px rgba(15, 23, 42, .06); transform: translateY(-1px); }
    .doctor-metrics small { color: var(--ac-muted); font-weight: 900; text-transform: uppercase; font-size: 10.5px; letter-spacing: .04em; }
    .doctor-metrics strong { color: var(--ac-text); font-size: 22px; line-height: 1; }
    .panel-head.compact { margin-bottom: 8px; }
    .panel-head.compact > span { width: 32px; height: 32px; border-radius: 8px; }
    .panel-head.compact h2 { font-size: 18px; line-height: 1.15; }
    .next-patient-panel, .dashboard-lane-panel, .dashboard-list-panel { min-height: 0; }
    .next-patient-panel, .dashboard-lane-panel { grid-column: span 6; }
    .dashboard-list-panel { grid-column: span 4; }
    .next-patient-card {
      width: 100%;
      min-height: 92px;
      display: grid;
      gap: 5px;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 26%, var(--ac-border));
      border-radius: 10px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 7%, var(--ac-surface)), color-mix(in srgb, #10b981 5%, var(--ac-surface)));
      color: var(--ac-text);
      text-align: left;
      cursor: pointer;
      box-shadow: 0 10px 22px rgba(15, 23, 42, .04);
    }
    .next-patient-card:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--ac-primary) 46%, var(--ac-border)); }
    .next-patient-card strong { font-size: 16px; overflow-wrap: anywhere; }
    .next-patient-card small { color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .next-patient-card.active { background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--ac-surface)), var(--ac-surface)); }
    .next-action { width: fit-content; min-height: 28px; display: inline-flex; align-items: center; gap: 5px; margin-top: 2px; padding: 5px 9px; border-radius: 999px; background: var(--ac-primary); color: white; font-size: 11.5px; font-weight: 900; }
    .next-action .material-symbols-rounded { font-size: 16px; }
    .queue-lanes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .queue-lane {
      min-height: 72px;
      display: grid;
      align-content: center;
      gap: 5px;
      padding: 10px 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-subtle);
      color: var(--ac-text);
      text-align: left;
      cursor: pointer;
    }
    .queue-lane:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15, 23, 42, .06); }
    .queue-lane small { color: var(--ac-muted); font-size: 10.5px; font-weight: 950; letter-spacing: .05em; text-transform: uppercase; }
    .queue-lane strong { font-size: 24px; line-height: 1; }
    .queue-lane.waiting { background: #eff6ff; border-color: #bfdbfe; }
    .queue-lane.active { background: #f0fdfa; border-color: #99f6e4; }
    .queue-lane.complete { background: #ecfdf5; border-color: #bbf7d0; }
    .dashboard-visit-list { max-height: 220px; overflow: auto; padding-right: 2px; }
    .compact-list, .queue-workspace { display: grid; gap: 8px; }
    .visit-row, .encounter-list button { width: 100%; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; align-items: center; border: 1px solid var(--ac-border); border-radius: 9px; padding: 8px 9px; background: color-mix(in srgb, var(--ac-surface) 88%, transparent); color: var(--ac-text); text-align: left; cursor: pointer; }
    .visit-row:hover, .encounter-list button:hover, .encounter-list button.active { border-color: color-mix(in srgb, var(--ac-primary) 38%, var(--ac-border)); box-shadow: 0 8px 18px color-mix(in srgb, var(--ac-primary) 8%, transparent); }
    .visit-row strong, .encounter-list button strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .visit-row small, .encounter-list button small { grid-column: 2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
    .token-pill { width: fit-content; border-radius: 999px; padding: 3px 8px; background: #eff6ff; color: #1d4ed8; font-size: 10.5px; font-weight: 900; }
    .token-pill.consultation { background: #f0fdfa; color: #0f766e; }
    .token-pill.done { background: #ecfdf5; color: #047857; }
    .visit-row small, .encounter-list small, .queue-copy p, .queue-copy span, .summary-strip small, .table-row small, .empty-copy { color: var(--ac-muted); }
    .transfer-panel { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(220px, 320px) auto auto; gap: 10px; align-items: center; padding: 13px; border: 1px solid color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border)); border-radius: 12px; background: color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)); }
    .transfer-panel strong, .transfer-panel small { display: block; }
    .transfer-panel strong { color: var(--ac-text); }
    .transfer-panel small { margin-top: 3px; color: var(--ac-muted); }
    .queue-table { display: grid; border: 1px solid var(--ac-border); border-radius: 12px; overflow-x: auto; }
    .queue-table-head, .queue-table-row { display: grid; grid-template-columns: minmax(92px, .65fr) minmax(170px, 1.2fr) minmax(160px, 1.1fr) minmax(120px, .75fr) minmax(120px, .75fr) minmax(100px, .65fr) minmax(120px, .75fr) minmax(170px, auto); gap: 10px; align-items: center; min-width: 1180px; padding: 12px 14px; }
    .queue-table-head { background: var(--ac-subtle); color: var(--ac-muted); font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: .04em; }
    .queue-table-row { border-top: 1px solid var(--ac-border); background: var(--ac-surface); }
    .queue-table-row > span { min-width: 0; }
    .queue-table-row strong, .queue-table-row small { display: block; overflow-wrap: anywhere; }
    .queue-table-row small { margin-top: 3px; color: var(--ac-muted); font-size: 11.5px; }
    .queue-row-actions { display: flex; align-items: center; gap: 6px; }
    .tbl-btn { width: 32px; height: 32px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-muted); cursor: pointer; }
    .tbl-btn:hover { color: var(--ac-primary); border-color: color-mix(in srgb, var(--ac-primary) 36%, var(--ac-border)); }
    .tbl-btn.primary { color: var(--ac-primary); background: color-mix(in srgb, var(--ac-primary) 7%, var(--ac-surface)); }
    .tbl-btn.danger:hover { color: #dc2626; border-color: #fca5a5; }
    .tbl-btn:disabled { opacity: .45; cursor: not-allowed; }
    .queue-status { display: inline-flex; min-height: 26px; align-items: center; border-radius: 999px; padding: 4px 10px; background: var(--ac-subtle); color: var(--ac-muted); font-size: 11.5px; font-weight: 900; white-space: nowrap; }
    .queue-status.waiting { background: #eff6ff; color: #1d4ed8; }
    .queue-status.skipped { background: #fffbeb; color: #b45309; }
    .queue-status.active { background: #f0fdfa; color: #0f766e; }
    .visit-table { display: grid; border: 1px solid var(--ac-border); border-radius: 12px; overflow: hidden; }
    .table-head, .table-row { display: grid; grid-template-columns: 1fr 1.25fr 1.2fr .75fr auto; gap: 10px; align-items: center; padding: 12px 14px; }
    .table-head { background: var(--ac-subtle); color: var(--ac-muted); font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: .04em; }
    .table-row { border-top: 1px solid var(--ac-border); background: var(--ac-surface); }
    .table-row > span { min-width: 0; }
    .table-row strong, .table-row small { display: block; overflow-wrap: anywhere; }
    .encounter-layout { min-width: 0; display: grid; grid-template-columns: minmax(220px, 260px) minmax(0, 1fr); gap: 12px; align-items: start; }
    .encounter-list { display: grid; gap: 8px; padding: 12px; max-height: 620px; overflow: auto; }
    .encounter-list h2 { font-size: 19px; }
    .encounter-list strong, .encounter-list small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .encounter-card { container-type: inline-size; padding: 14px; min-height: 420px; overflow: hidden; }
    .encounter-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
    .encounter-head span { color: var(--ac-muted); }
    .encounter-head h2 { font-size: 25px; line-height: 1.12; overflow-wrap: anywhere; }
    .status-badge { display: inline-flex; min-height: 28px; align-items: center; border-radius: 999px; padding: 4px 10px; background: #f0fdfa; color: #0f766e; font-size: 12px; font-weight: 900; }
    .summary-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 14px; }
    .summary-strip span { min-width: 0; display: grid; gap: 4px; padding: 10px 11px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-subtle); }
    .summary-strip strong { min-width: 0; color: var(--ac-text); overflow-wrap: anywhere; }
    .encounter-workspace { min-width: 0; display: grid; grid-template-columns: minmax(210px, 240px) minmax(0, 1fr); gap: 12px; align-items: start; }
    .patient-snapshot { min-width: 0; position: sticky; top: 10px; display: grid; gap: 10px; padding: 12px; border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border)); border-radius: 12px; background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), var(--ac-surface)); }
    .snapshot-head { display: flex; gap: 10px; align-items: center; }
    .snapshot-head > span { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; background: var(--ac-primary-light); color: var(--ac-primary); }
    .snapshot-head h3, .section-title h3 { margin: 0; color: var(--ac-text); }
    .snapshot-grid, .snapshot-detail-grid { display: grid; gap: 8px; }
    .snapshot-grid span, .snapshot-detail-grid span, .metric-tile { display: grid; gap: 3px; min-width: 0; padding: 9px 10px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); }
    .snapshot-grid small, .snapshot-detail-grid small, .metric-tile small { color: var(--ac-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .03em; }
    .snapshot-grid strong, .snapshot-detail-grid strong, .metric-tile strong { color: var(--ac-text); overflow-wrap: anywhere; }
    .snapshot-detail-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .clinical-board { width: 100%; min-width: 0; max-width: 100%; display: grid; gap: 10px; overflow: hidden; }
    .encounter-section-tabs { min-width: 0; display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-subtle); }
    .encounter-section-tabs button { min-height: 36px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 9px; padding: 0 10px; white-space: nowrap; background: transparent; color: var(--ac-muted); font: inherit; font-size: 12px; font-weight: 900; cursor: pointer; }
    .encounter-section-tabs button.active { background: var(--ac-surface); color: var(--ac-primary); box-shadow: 0 10px 22px rgba(15, 23, 42, .08); }
    .encounter-section-tabs .material-symbols-rounded { font-size: 19px; }
    .section-panel { min-width: 0; min-height: 360px; padding: 14px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface); overflow: hidden; }
    .section-title { margin-bottom: 12px; }
    .section-title p { margin: 4px 0 0; color: var(--ac-muted); }
    .consultation-stack { display: grid; gap: 18px; }
    .consultation-stack > section { padding: 14px; border: 1px solid color-mix(in srgb, var(--ac-primary) 12%, var(--ac-border)); border-radius: 12px; background: color-mix(in srgb, var(--ac-subtle) 56%, var(--ac-surface)); }
    .consultation-stack > section:first-child { background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), var(--ac-surface)); }
    .prescription-header-card {
      min-width: 0;
      display: grid;
      gap: 14px;
      margin-bottom: 14px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 20%, var(--ac-border));
      border-radius: 14px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), color-mix(in srgb, #10b981 4%, var(--ac-surface)));
      box-shadow: 0 14px 30px rgba(15, 23, 42, .05);
    }
    .prescription-header-title {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 11px;
      padding-bottom: 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--ac-primary) 14%, var(--ac-border));
    }
    .prescription-header-title > span {
      flex: 0 0 auto;
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--ac-primary-light);
      color: var(--ac-primary);
    }
    .prescription-header-title h3, .prescription-header-grid h4 { margin: 0; color: var(--ac-text); }
    .prescription-header-title h3 { overflow-wrap: anywhere; }
    .prescription-header-grid {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 10px;
    }
    .prescription-header-grid article {
      min-width: 0;
      display: grid;
      gap: 8px;
      align-content: start;
      padding: 10px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-surface) 92%, white);
    }
    .prescription-header-grid h4 {
      padding-bottom: 8px;
      border-bottom: 1px solid var(--ac-border);
      font-size: 13px;
    }
    .prescription-header-grid span {
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 8px 0;
      border-bottom: 1px dashed color-mix(in srgb, var(--ac-border) 72%, transparent);
    }
    .prescription-header-grid span:last-child { border-bottom: 0; }
    .prescription-header-grid small {
      color: var(--ac-muted);
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .prescription-header-grid strong {
      color: var(--ac-text);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    .clinical-info-card {
      min-width: 0;
      display: grid;
      gap: 14px;
      margin-bottom: 14px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 16%, var(--ac-border));
      border-radius: 14px;
      background: color-mix(in srgb, var(--ac-subtle) 60%, var(--ac-surface));
    }
    .clinical-info-block {
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
    }
    .mini-section-title {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
    }
    .mini-section-title h4 { margin: 0; color: var(--ac-text); }
    .mini-section-title p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; font-weight: 750; }
    .mini-section-title span { color: var(--ac-muted); font-size: 12px; font-weight: 900; }
    .quick-complaints {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .quick-complaints button {
      min-height: 32px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 22%, var(--ac-border));
      border-radius: 999px;
      padding: 0 11px;
      background: color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface));
      color: var(--ac-primary);
      font: inherit;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .quick-complaints button:hover { background: var(--ac-primary-light); }
    .prescription-vitals-card {
      min-width: 0;
      display: grid;
      gap: 12px;
      margin-bottom: 14px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, #10b981 20%, var(--ac-border));
      border-radius: 14px;
      background: linear-gradient(135deg, color-mix(in srgb, #10b981 5%, var(--ac-surface)), var(--ac-surface));
    }
    .prescription-vitals-card .mini-section-title p {
      margin: 3px 0 0;
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 750;
    }
    .include-toggle {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 11px;
      border: 1px solid color-mix(in srgb, #10b981 24%, var(--ac-border));
      border-radius: 999px;
      background: var(--ac-surface);
      color: var(--ac-text);
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
    }
    .include-toggle input { accent-color: #10b981; }
    .prescription-vitals-grid {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
    }
    .prescription-vitals-grid span {
      min-width: 0;
      display: grid;
      gap: 3px;
      padding: 10px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
    }
    .prescription-vitals-grid small {
      color: var(--ac-muted);
      font-size: 10.5px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .prescription-vitals-grid strong {
      color: var(--ac-text);
      overflow-wrap: anywhere;
    }
    .clinical-grid { min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px; }
    .clinical-grid.single { grid-template-columns: 1fr; }
    .clinical-grid.medicine-grid { grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); }
    .field, .check-field { min-width: 0; display: grid; gap: 7px; color: var(--ac-muted); font-weight: 850; }
    .field.wide { grid-column: span 2; }
    .field input, .field select { width: 100%; min-height: 42px; border: 1px solid var(--ac-border); border-radius: 10px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text); font: inherit; font-weight: 760; outline: 0; }
    .field input:focus, .field select:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent); }
    .radio-segment {
      min-height: 38px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
      padding: 3px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-subtle);
    }
    .radio-segment label {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 0;
      border-radius: 8px;
      padding: 5px 8px;
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .radio-segment label::before {
      content: '';
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      border: 1.5px solid color-mix(in srgb, var(--ac-muted) 68%, var(--ac-border));
      border-radius: 999px;
      background: var(--ac-surface);
      box-shadow: inset 0 0 0 3px var(--ac-surface);
    }
    .radio-segment label:has(input:checked) {
      background: var(--ac-surface);
      color: var(--ac-primary);
      box-shadow: 0 8px 18px rgba(15, 23, 42, .07);
    }
    .radio-segment label:has(input:checked)::before {
      border-color: var(--ac-primary);
      background: var(--ac-primary);
    }
    .radio-segment input {
      position: absolute;
      width: 1px;
      height: 1px;
      min-height: 1px;
      margin: 0;
      padding: 0;
      opacity: 0;
      pointer-events: none;
    }
    .lab-order-composer {
      display: grid;
      gap: 14px;
      margin-bottom: 12px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      border-radius: 14px;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), color-mix(in srgb, #10b981 4%, var(--ac-surface)));
      box-shadow: 0 14px 30px rgba(15, 23, 42, .05);
    }
    .lab-order-title {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 0;
    }
    .lab-order-title > span {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: var(--ac-primary-light);
      color: var(--ac-primary);
      box-shadow: 0 12px 24px color-mix(in srgb, var(--ac-primary) 12%, transparent);
    }
    .lab-order-grid {
      margin-bottom: 0;
    }
    .lab-order-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-start;
    }
    .medicine-composer {
      min-width: 0;
      display: grid;
      gap: 12px;
      margin-bottom: 14px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      border-radius: 14px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), var(--ac-surface));
    }
    .medicine-composer .clinical-grid { margin-bottom: 0; }
    .prescription-extra-card {
      min-width: 0;
      display: grid;
      gap: 12px;
      margin-bottom: 14px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 16%, var(--ac-border));
      border-radius: 14px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 4%, var(--ac-surface)), var(--ac-surface));
      box-shadow: 0 12px 26px rgba(15, 23, 42, .04);
    }
    .prescription-extra-card .mini-section-title,
    .prescription-vitals-card .mini-section-title {
      align-items: flex-start;
    }
    .prescription-lock-banner {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 14px;
      padding: 12px 14px;
      border: 1px solid color-mix(in srgb, #10b981 28%, var(--ac-border));
      border-radius: 14px;
      background: color-mix(in srgb, #10b981 8%, var(--ac-surface));
      color: var(--ac-text);
    }
    .prescription-lock-banner > span {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: var(--ac-surface);
      color: #059669;
      box-shadow: 0 10px 22px rgba(15, 23, 42, .06);
    }
    .prescription-lock-banner strong { display: block; margin-bottom: 3px; font-weight: 950; }
    .prescription-lock-banner p { margin: 0; color: var(--ac-muted); font-size: 12.5px; font-weight: 800; }
    .prescription-template-panel {
      min-width: 0;
      display: grid;
      gap: 14px;
      margin-bottom: 14px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 22%, var(--ac-border));
      border-radius: 16px;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 6%, var(--ac-surface)), color-mix(in srgb, #10b981 5%, var(--ac-surface)));
      box-shadow: 0 16px 34px rgba(15, 23, 42, .06);
    }
    .template-panel-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .template-panel-title {
      min-width: 0;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .template-panel-title > span {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--ac-primary-light);
      color: var(--ac-primary);
      box-shadow: 0 12px 24px color-mix(in srgb, var(--ac-primary) 12%, transparent);
    }
    .template-panel-title h3 {
      margin: 1px 0 4px;
      color: var(--ac-text);
      font-size: 19px;
    }
    .template-panel-title p:not(.ac-eyebrow) {
      margin: 0;
      color: var(--ac-muted);
      font-size: 13px;
      font-weight: 800;
      line-height: 1.45;
    }
    .template-apply-row {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) auto auto;
      gap: 10px;
      align-items: center;
    }
    .template-apply-row ac-dropdown { min-width: 260px; }
    .template-apply-row .ac-btn { min-width: 150px; }
    .template-save-form {
      display: grid;
      gap: 14px;
      padding: 18px 24px;
    }
    .template-card-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .template-card {
      min-width: 0;
      display: grid;
      gap: 5px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 16%, var(--ac-border));
      border-radius: 13px;
      background: color-mix(in srgb, var(--ac-surface) 90%, white);
      color: var(--ac-text);
      text-align: left;
      cursor: pointer;
      transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease, background .16s ease;
    }
    .template-card:hover,
    .template-card.active {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--ac-primary) 42%, var(--ac-border));
      background: var(--ac-surface);
      box-shadow: 0 14px 30px rgba(15, 23, 42, .08);
    }
    .template-card strong {
      color: var(--ac-text);
      font-size: 13.5px;
      font-weight: 950;
    }
    .template-card small {
      min-height: 34px;
      color: var(--ac-muted);
      font-weight: 800;
      line-height: 1.35;
    }
    .template-card span {
      color: var(--ac-primary);
      font-size: 11.5px;
      font-weight: 950;
    }
    .prescription-edit-locked {
      opacity: .66;
      pointer-events: none;
      user-select: none;
    }
    .medicine-search-field {
      position: relative;
    }
    .medicine-suggestions {
      position: absolute;
      z-index: 30;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      display: grid;
      gap: 5px;
      max-height: 260px;
      overflow: auto;
      padding: 7px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      border-radius: 14px;
      background: var(--ac-surface);
      box-shadow: 0 18px 42px rgba(15, 23, 42, .16);
    }
    .medicine-suggestions button {
      width: 100%;
      display: grid;
      gap: 3px;
      padding: 10px 12px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--ac-text);
      text-align: left;
      cursor: pointer;
      transition: background .16s ease, border-color .16s ease, transform .16s ease;
    }
    .medicine-suggestions button:hover {
      border-color: color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      background: color-mix(in srgb, var(--ac-primary) 8%, var(--ac-surface));
      transform: translateY(-1px);
    }
    .medicine-suggestions strong {
      font-size: 13px;
      font-weight: 900;
      color: var(--ac-text);
    }
    .medicine-suggestions small {
      color: var(--ac-muted);
      font-size: 11.5px;
      font-weight: 800;
    }
    .medicine-table {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      display: grid;
      margin-bottom: 14px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      overflow-x: auto;
      background: var(--ac-surface);
    }
    .medicine-table-head, .medicine-table-row {
      display: grid;
      grid-template-columns: 38px minmax(145px, 1.3fr) minmax(88px, .8fr) minmax(80px, .7fr) minmax(112px, .9fr) minmax(78px, .7fr) minmax(88px, .75fr) minmax(118px, 1fr) 72px;
      gap: 8px;
      min-width: 880px;
      padding: 10px;
      align-items: center;
    }
    .medicine-table-head {
      background: var(--ac-subtle);
      color: var(--ac-muted);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    .medicine-table-row {
      border-top: 1px solid var(--ac-border);
      color: var(--ac-text);
      font-size: 12.5px;
      font-weight: 800;
    }
    .medicine-table-row strong, .medicine-table-row small { display: block; min-width: 0; overflow-wrap: anywhere; }
    .medicine-table-row small { margin-top: 2px; color: var(--ac-muted); font-size: 11px; }
    .medicine-table-row button { border: 0; background: transparent; color: var(--ac-primary); font: inherit; font-size: 12px; font-weight: 900; cursor: pointer; }
    .check-field { min-height: 42px; grid-auto-flow: column; justify-content: start; align-items: center; padding: 10px 12px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-subtle); color: var(--ac-text); }
    .chip-list, .record-list { display: grid; gap: 8px; margin-top: 10px; }
    .chip-list span, .record-list span { display: flex; gap: 10px; align-items: center; justify-content: space-between; min-width: 0; padding: 10px 12px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-subtle); color: var(--ac-text); font-weight: 850; }
    .record-list strong, .record-list small { display: block; min-width: 0; overflow-wrap: anywhere; }
    .record-list small { margin-top: 3px; color: var(--ac-muted); font-size: 11.5px; }
    .chip-list button, .record-list button { border: 0; background: transparent; color: var(--ac-primary); font: inherit; font-size: 12px; font-weight: 900; cursor: pointer; }
    .notes-field { display: grid; gap: 8px; color: var(--ac-muted); font-weight: 850; }
    textarea { width: 100%; border: 1px solid var(--ac-border); border-radius: 10px; padding: 13px; background: var(--ac-surface); color: var(--ac-text); font: inherit; font-weight: 700; outline: 0; resize: vertical; }
    textarea:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent); }
    .encounter-actions { margin-top: 14px; justify-content: flex-end; }
    .prescription-action-bar {
      width: 100%;
      min-width: 0;
      display: grid;
      gap: 14px;
      padding: 16px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      border-radius: 14px;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 6%, var(--ac-surface)), color-mix(in srgb, #10b981 5%, var(--ac-surface)));
      box-shadow: 0 16px 34px rgba(15, 23, 42, .06);
    }
    .prescription-action-status {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--ac-primary) 14%, var(--ac-border));
    }
    .prescription-action-status strong {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ac-text);
      font-size: 16px;
    }
    .prescription-action-status > span {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border: 1px solid var(--ac-border);
      border-radius: 999px;
      background: var(--ac-surface);
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      display: inline-block;
      border-radius: 999px;
      background: #f59e0b;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, .13);
    }
    .prescription-action-bar.generated .status-dot {
      background: #10b981;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, .14);
    }
    .prescription-action-bar.finalized .status-dot {
      background: #2563eb;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, .14);
    }
    .prescription-action-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 8px;
    }
    .prescription-action-grid .ac-btn {
      width: 100%;
      min-height: 38px;
      padding-inline: 10px;
    }
    .prescription-action-grid .complete-action {
      justify-self: start;
      margin-top: 2px;
    }
    .prescription-backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(15, 23, 42, .42);
      backdrop-filter: blur(6px);
    }
    .prescription-modal {
      width: min(980px, 100%);
      max-height: min(90vh, 860px);
      overflow: auto;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 20%, var(--ac-border));
      border-radius: 18px;
      background: var(--ac-surface);
      box-shadow: 0 30px 90px rgba(15, 23, 42, .24);
    }
    .prescription-modal-head {
      position: relative;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding: 22px 24px;
      border-bottom: 1px solid var(--ac-border);
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 11%, var(--ac-surface)), color-mix(in srgb, #10b981 7%, var(--ac-surface)));
    }
    .prescription-modal-head h2 { margin: 2px 0 3px; color: var(--ac-text); }
    .prescription-modal-head span { color: var(--ac-muted); font-weight: 800; }
    .modal-close {
      width: 38px;
      height: 38px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: var(--ac-muted);
      background: var(--ac-surface);
      cursor: pointer;
    }
    .modal-close:hover { color: var(--ac-primary); background: var(--ac-primary-light); }
    .prescription-paper {
      margin: 20px 24px;
    }
    .rx-sheet {
      display: grid;
      gap: 0;
      padding: 0;
      border: 1px solid color-mix(in srgb, var(--ac-text) 18%, var(--ac-border));
      border-radius: 8px;
      background: var(--ac-surface);
      color: var(--ac-text);
      overflow: hidden;
      box-shadow: 0 18px 42px rgba(15, 23, 42, .08);
    }
    .rx-sheet-head {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 22px 24px;
      border-bottom: 1px solid var(--ac-border);
      text-align: center;
      background: linear-gradient(180deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), var(--ac-surface));
    }
    .rx-logo-mark {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 22%, var(--ac-border));
      border-radius: 16px;
      background: var(--ac-primary-light);
      color: var(--ac-primary);
      justify-self: start;
    }
    .rx-logo-mark span { font-size: 32px; }
    .rx-label {
      margin: 0 0 4px;
      color: var(--ac-muted);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .12em;
    }
    .rx-sheet-head h2 { margin: 0; color: var(--ac-text); font-size: 25px; }
    .rx-sheet-head span { color: var(--ac-muted); font-weight: 800; }
    .rx-sheet-head aside {
      display: grid;
      gap: 4px;
      justify-items: end;
      text-align: right;
    }
    .rx-sheet-head aside strong { color: var(--ac-primary); font-size: 14px; }
    .rx-sheet-head aside small { color: var(--ac-muted); font-weight: 900; }
    .rx-doctor-block {
      padding: 18px 24px;
      border-bottom: 1px solid var(--ac-border);
      text-align: center;
    }
    .rx-doctor-block h3 { margin: 0; color: var(--ac-text); font-size: 22px; }
    .rx-doctor-block p { margin: 6px 0 3px; color: var(--ac-text); font-weight: 850; }
    .rx-doctor-block span { color: var(--ac-muted); font-weight: 850; }
    .rx-patient-block {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 28px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--ac-border);
    }
    .rx-patient-block div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      border-bottom: 1px dashed color-mix(in srgb, var(--ac-muted) 24%, transparent);
      padding-bottom: 5px;
    }
    .rx-patient-block small { color: var(--ac-muted); font-weight: 900; }
    .rx-patient-block strong { color: var(--ac-text); text-align: right; overflow-wrap: anywhere; }
    .rx-patient-block p {
      grid-column: 1 / -1;
      margin: 2px 0 0;
      color: var(--ac-text);
      font-weight: 800;
      line-height: 1.5;
    }
    .rx-patient-block p strong { margin-right: 5px; color: var(--ac-muted); }
    .rx-medicine-block {
      padding: 22px 24px;
      border-bottom: 1px solid var(--ac-border);
      min-height: 210px;
    }
    .rx-medicine-block h3 {
      margin: 0 0 14px;
      color: var(--ac-text);
      font-family: Georgia, serif;
      font-size: 31px;
      font-style: italic;
    }
    .rx-medicine-block ol {
      display: grid;
      gap: 16px;
      margin: 0;
      padding-left: 24px;
    }
    .rx-medicine-block li { padding-left: 4px; }
    .rx-medicine-block li strong {
      display: block;
      color: var(--ac-text);
      font-size: 16px;
      font-weight: 950;
    }
    .rx-medicine-block li span {
      display: block;
      margin-top: 4px;
      color: var(--ac-muted);
      font-size: 14px;
      font-weight: 850;
    }
    .rx-advice-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      border-bottom: 1px solid var(--ac-border);
    }
    .rx-advice-grid article {
      min-width: 0;
      padding: 18px 24px;
      border-right: 1px solid var(--ac-border);
      border-bottom: 1px solid var(--ac-border);
    }
    .rx-advice-grid article:nth-child(even), .rx-advice-grid article:last-child { border-right: 0; }
    .rx-advice-grid article.wide { grid-column: 1 / -1; border-right: 0; }
    .rx-advice-grid h3 { margin: 0 0 9px; color: var(--ac-text); font-size: 16px; }
    .rx-advice-grid ul { margin: 0; padding-left: 18px; color: var(--ac-text); font-weight: 800; }
    .rx-advice-grid li { margin-bottom: 5px; }
    .rx-advice-grid p { margin: 0; color: var(--ac-text); font-weight: 850; }
    .rx-sheet-foot {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) minmax(180px, auto);
      gap: 14px;
      align-items: end;
      padding: 18px 24px;
      border-bottom: 1px solid var(--ac-border);
    }
    .rx-qr {
      width: 72px;
      height: 72px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 6px;
      border: 1px solid var(--ac-border);
      background: var(--ac-surface);
    }
    .rx-qr span { background: color-mix(in srgb, var(--ac-text) 78%, transparent); }
    .rx-sheet-foot strong { display: block; color: var(--ac-text); font-weight: 950; }
    .rx-sheet-foot small { color: var(--ac-muted); font-weight: 850; }
    .rx-signature {
      display: grid;
      gap: 8px;
      justify-items: end;
      text-align: right;
    }
    .rx-signature::before {
      content: '';
      width: 180px;
      border-top: 1px solid color-mix(in srgb, var(--ac-text) 45%, var(--ac-border));
    }
    .rx-signature span { color: var(--ac-muted); font-weight: 900; }
    .rx-disclaimer {
      margin: 0;
      padding: 12px 24px 16px;
      color: var(--ac-muted);
      font-size: 11.5px;
      font-weight: 750;
      line-height: 1.5;
    }
    .prescription-modal-actions {
      position: sticky;
      bottom: 0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid var(--ac-border);
      background: color-mix(in srgb, var(--ac-surface) 94%, white);
    }
    .print-options-modal {
      width: min(560px, 100%);
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 20%, var(--ac-border));
      border-radius: 18px;
      background: var(--ac-surface);
      box-shadow: 0 30px 90px rgba(15, 23, 42, .24);
    }
    .print-options-modal > header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding: 22px 24px;
      border-bottom: 1px solid var(--ac-border);
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 11%, var(--ac-surface)), color-mix(in srgb, #10b981 7%, var(--ac-surface)));
    }
    .print-options-modal h2 {
      margin: 2px 0 3px;
      color: var(--ac-text);
      font-size: 24px;
    }
    .print-options-modal .kicker {
      margin: 0;
      color: var(--ac-primary);
      font-size: 12px;
      font-weight: 950;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .print-options-modal h3 {
      margin: 0 0 10px;
      color: var(--ac-muted);
      font-size: 14px;
      font-weight: 950;
    }
    .print-options-section {
      padding: 18px 24px 0;
    }
    .print-format-options,
    .print-include-grid {
      display: grid;
      gap: 10px;
    }
    .print-format-options {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding: 18px 24px 0;
    }
    .print-include-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 14px 24px 18px;
    }
    .print-format-options label,
    .print-include-grid label {
      min-height: 46px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-primary) 3%, var(--ac-surface));
      color: var(--ac-text);
      font-weight: 900;
      cursor: pointer;
    }
    .print-format-options label:hover,
    .print-include-grid label:hover {
      border-color: color-mix(in srgb, var(--ac-primary) 35%, var(--ac-border));
      background: var(--ac-primary-light);
    }
    .print-format-options input,
    .print-include-grid input {
      width: 16px;
      height: 16px;
      accent-color: var(--ac-primary);
    }
    .print-options-modal footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 18px 24px;
      border-top: 1px solid var(--ac-border);
      background: color-mix(in srgb, var(--ac-surface) 94%, white);
    }
    @container (max-width: 1120px) {
      .encounter-workspace { grid-template-columns: 1fr; }
      .patient-snapshot { position: static; }
      .snapshot-grid { grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); }
      .clinical-board { overflow: visible; }
    }
    @media (max-width: 1480px) {
      .encounter-layout { grid-template-columns: minmax(200px, 240px) minmax(0, 1fr); }
      .encounter-list { padding: 10px; }
      .encounter-card { padding: 12px; }
      .encounter-head h2 { font-size: 23px; }
    }
    @media (max-width: 1180px) {
      .stats-row, .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .opd-command-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .command-panel, .next-patient-panel, .dashboard-lane-panel, .dashboard-list-panel { grid-column: auto; }
      .command-panel { grid-template-columns: 1fr; }
      .toolbar, .encounter-layout, .encounter-workspace { grid-template-columns: 1fr; }
      .patient-snapshot { position: static; }
      .transfer-panel { grid-template-columns: 1fr; }
      .table-head { display: none; }
      .table-row { grid-template-columns: 1fr; }
      .clinical-grid, .clinical-grid.medicine-grid, .snapshot-detail-grid, .prescription-header-grid, .prescription-vitals-grid { grid-template-columns: 1fr; }
      .template-panel-head, .template-card-grid { grid-template-columns: 1fr; }
      .rx-sheet-head, .rx-patient-block, .rx-advice-grid, .rx-sheet-foot { grid-template-columns: 1fr; }
      .rx-sheet-head, .rx-sheet-head aside, .rx-signature { justify-items: start; text-align: left; }
      .rx-advice-grid article { border-right: 0; }
      .field.wide { grid-column: auto; }
      .prescription-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .page-header, .header-actions { flex-direction: column; align-items: stretch; }
      .stats-row, .dashboard-grid, .opd-command-grid, .summary-strip, .doctor-metrics, .queue-lanes { grid-template-columns: 1fr; }
      .command-panel { grid-column: auto; }
      .command-head { display: grid; }
      .command-score { width: fit-content; min-width: 64px; }
      .opd-shell { padding: 10px; }
      .opd-tabs button, .encounter-section-tabs button { flex: 1 1 150px; justify-content: center; }
      .encounter-head { display: grid; }
      .status-badge { width: fit-content; }
      .section-panel, .prescription-header-card, .clinical-info-card, .prescription-vitals-card, .medicine-composer, .prescription-extra-card, .prescription-template-panel, .prescription-action-bar { padding: 12px; }
      .prescription-action-status { display: grid; }
      .prescription-action-status > span { width: fit-content; }
      .template-apply-row { grid-template-columns: 1fr; }
      .template-apply-row .ac-btn { width: 100%; }
      .prescription-action-grid { grid-template-columns: 1fr; }
      .prescription-action-grid .complete-action { justify-self: stretch; }
      .prescription-backdrop { padding: 12px; }
      .prescription-paper { margin: 14px; }
      .rx-sheet { padding: 0; }
      .rx-sheet-head, .rx-doctor-block, .rx-patient-block, .rx-medicine-block, .rx-advice-grid article, .rx-sheet-foot, .rx-disclaimer { padding-left: 16px; padding-right: 16px; }
      .prescription-modal-actions { flex-direction: column-reverse; }
      .prescription-modal-actions .ac-btn { width: 100%; }
      .print-format-options, .print-include-grid { grid-template-columns: 1fr; }
      .print-options-modal footer { flex-direction: column-reverse; }
      .print-options-modal .ac-btn { width: 100%; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpdPageComponent implements OnInit {
  protected readonly appointments = signal<AppointmentRecord[]>([]);
  protected readonly queues = signal<AppointmentQueueRecord[]>([]);
  protected readonly patients = signal<PatientSummary[]>([]);
  protected readonly doctors = signal<DoctorSummary[]>([]);
  protected readonly consultations = signal<OpdConsultationRecord[]>([]);
  protected readonly followUps = signal<OpdFollowUpRecord[]>([]);
  protected readonly labTests = signal<OpdLabTestRecord[]>([]);
  protected readonly medicines = signal<OpdMedicineRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<OpdTab>('dashboard');
  protected readonly activeEncounterSection = signal<OpdEncounterSection>('snapshot');
  protected readonly selectedVisit = signal<OpdVisitVm | null>(null);
  protected readonly transferVisit = signal<OpdVisitVm | null>(null);
  protected readonly encounterForm = signal<OpdEncounterForm>(emptyEncounterForm());
  protected readonly clinicalForm = signal<OpdClinicalForm>(emptyClinicalForm());
  protected readonly prescriptionPreviewOpen = signal(false);
  protected readonly saveTemplateOpen = signal(false);
  protected readonly printOptionsOpen = signal(false);
  protected readonly prescriptionStatus = signal<PrescriptionStatus>('DRAFT');
  protected readonly prescriptionRevisionNo = signal(1);
  protected readonly customFrequencyMode = signal(false);
  protected readonly customDietAdviceMode = signal(false);
  protected searchQuery = '';
  protected doctorFilter = '';
  protected transferDoctorId = '';
  protected selectedPrescriptionTemplateId = '';
  protected printOptions: PrescriptionPrintOptions = defaultPrescriptionPrintOptions();
  protected saveTemplateDraft: PrescriptionTemplateDraft = emptyPrescriptionTemplateDraft();
  protected readonly prescriptionTemplates = signal<PrescriptionTemplate[]>(loadPrescriptionTemplates());
  protected readonly prescriptionTemplateOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select prescription template', value: '' },
    ...this.prescriptionTemplates().map(template => ({ label: template.name, value: template.id }))
  ]);
  protected readonly complaintSeverityOptions: DropdownOption<string>[] = [
    { label: 'Low', value: 'Low' },
    { label: 'Moderate', value: 'Moderate' },
    { label: 'High', value: 'High' },
    { label: 'Critical', value: 'Critical' }
  ];
  protected readonly complaintTemplates = ['Weakness', 'Shoulder pain', 'Fever', 'Headache'];
  protected readonly investigationTemplates = ['CBC', 'Blood Sugar', 'Lipid Profile', 'X-Ray', 'MRI', 'ECG'];
  protected readonly procedureTemplates = ['Physiotherapy', 'Dressing', 'Injection', 'Nebulization', 'Minor Procedure'];
  protected readonly adviceTemplates = [
    'Take adequate rest.',
    'Avoid heavy lifting.',
    'Drink sufficient water.',
    'Continue medication as prescribed.'
  ];
  protected readonly diagnosisTypeOptions: DropdownOption<string>[] = [
    { label: 'Primary', value: 'PRIMARY' },
    { label: 'Secondary', value: 'SECONDARY' }
  ];
  protected readonly labPriorityOptions: DropdownOption<string>[] = [
    { label: 'Routine', value: 'Routine' },
    { label: 'Urgent', value: 'Urgent' },
    { label: 'STAT', value: 'STAT' }
  ];
  protected readonly frequencyOptions: DropdownOption<string>[] = [
    { label: 'Select frequency', value: '' },
    { label: 'OD - Once Daily', value: 'Once Daily' },
    { label: 'BD - Twice Daily', value: 'Twice Daily' },
    { label: 'TDS - Three Times Daily', value: 'Three Times Daily' },
    { label: 'QID - Four Times Daily', value: 'Four Times Daily' },
    { label: 'Every Morning', value: 'Every Morning' },
    { label: 'Every Night', value: 'Every Night' },
    { label: 'Before Breakfast', value: 'Before Breakfast' },
    { label: 'After Breakfast', value: 'After Breakfast' },
    { label: 'Before Lunch', value: 'Before Lunch' },
    { label: 'After Lunch', value: 'After Lunch' },
    { label: 'Before Dinner', value: 'Before Dinner' },
    { label: 'After Dinner', value: 'After Dinner' },
    { label: 'HS - At Bedtime', value: 'At Bedtime' },
    { label: 'SOS - As Needed', value: 'As Needed' },
    { label: 'Custom', value: 'CUSTOM' }
  ];
  protected readonly dietAdviceOptions: DropdownOption<string>[] = [
    { label: 'Select diet advice', value: '' },
    { label: 'Low Salt Diet', value: 'Low Salt Diet' },
    { label: 'Diabetic Diet', value: 'Diabetic Diet' },
    { label: 'High Protein Diet', value: 'High Protein Diet' },
    { label: 'Regular Diet', value: 'Regular Diet' },
    { label: 'Custom Advice', value: 'CUSTOM' }
  ];
  protected readonly followUpReasonOptions: DropdownOption<string>[] = [
    { label: 'Review', value: 'Review' },
    { label: 'Test Results', value: 'Test Results' },
    { label: 'Follow-up', value: 'Follow-up' }
  ];

  protected readonly tabs: Array<{ id: OpdTab; label: string; icon: string }> = [
    { id: 'dashboard', label: 'OPD Dashboard', icon: 'dashboard' },
    { id: 'queue', label: "Today's Queue", icon: 'queue' },
    { id: 'check-in', label: 'Check-In', icon: 'how_to_reg' },
    { id: 'active', label: 'Active Consultations', icon: 'clinical_notes' },
    { id: 'completed', label: 'Completed Visits', icon: 'task_alt' },
    { id: 'encounter', label: 'OPD Encounter', icon: 'stethoscope' }
  ];

  protected readonly encounterSections: Array<{ id: OpdEncounterSection; label: string; icon: string }> = [
    { id: 'snapshot', label: 'Patient Snapshot', icon: 'badge' },
    { id: 'vitals', label: 'Vitals', icon: 'monitor_heart' },
    { id: 'consultation', label: 'Consultation', icon: 'stethoscope' },
    { id: 'diagnosis', label: 'Diagnosis', icon: 'diagnosis' },
    { id: 'lab-orders', label: 'Lab Orders', icon: 'biotech' },
    { id: 'procedures', label: 'Procedures', icon: 'medical_services' },
    { id: 'notes', label: 'Clinical Notes', icon: 'clinical_notes' },
    { id: 'prescription', label: 'Prescription', icon: 'medication' },
    { id: 'follow-up', label: 'Follow-up', icon: 'event_repeat' }
  ];

  private readonly appointmentService = inject(AppointmentManagementService);
  private readonly patientService = inject(PatientManagementService);
  private readonly doctorService = inject(DoctorManagementService);
  private readonly opdService = inject(OpdManagementService);
  private readonly branchContext = inject(BranchContextService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly doctorFilterOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Doctors', value: '' },
    ...this.doctors().map(doctor => ({ label: `${doctor.fullName} · ${doctor.departmentName}`, value: doctor.doctorGuid }))
  ]);

  protected readonly transferDoctorOptions = computed<DropdownOption<string>[]>(() => {
    const visit = this.transferVisit();
    return [
      { label: 'Select target doctor', value: '' },
      ...this.doctors()
        .filter(doctor => doctor.doctorGuid !== visit?.appointment.doctorId)
        .map(doctor => ({ label: `${doctor.fullName} · ${doctor.departmentName}`, value: doctor.doctorGuid }))
    ];
  });

  protected readonly preferredDoctorOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Same doctor', value: '' },
    ...this.doctors().map(doctor => ({ label: `${doctor.fullName} · ${doctor.departmentName}`, value: doctor.doctorGuid }))
  ]);

  protected readonly labTestOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select test', value: '' },
    ...this.labTests()
      .filter(test => test.isActive)
      .map(test => ({ label: `${test.code} · ${test.name} · ${formatCurrency(test.price)}`, value: test.id }))
  ]);

  protected readonly medicineSearchResults = computed<MedicineSuggestion[]>(() => {
    const query = this.clinicalForm().prescriptionDraft.medicine.trim();
    return findMedicineSuggestions(query, this.medicines());
  });

  protected readonly frequencySelection = computed(() => this.customFrequencyMode() ? 'CUSTOM' : this.clinicalForm().prescriptionDraft.frequency);
  protected readonly dietAdviceSelection = computed(() => this.customDietAdviceMode() ? 'CUSTOM' : this.clinicalForm().dietAdviceDraft);
  protected readonly prescriptionStatusLabel = computed(() => prescriptionStatusLabels[this.prescriptionStatus()]);
  protected readonly prescriptionLocked = computed(() => ['FINALIZED', 'PRINTED', 'SHARED'].includes(this.prescriptionStatus()));
  protected readonly prescriptionIssued = computed(() => this.prescriptionStatus() !== 'DRAFT');

  protected readonly prescriptionPreview = computed<PrescriptionPreview | null>(() => {
    const visit = this.selectedVisit();
    return visit ? buildPrescriptionPreview(visit, this.clinicalForm(), this.labTests(), this.prescriptionStatusLabel(), this.prescriptionRevisionNo()) : null;
  });

  protected readonly prescriptionHeader = computed<PrescriptionHeaderVm | null>(() => {
    const visit = this.selectedVisit();
    if (!visit) {
      return null;
    }

    return buildPrescriptionHeader(visit, this.clinicalForm(), this.branchContext.hospitalName(), this.branchContext.selectedBranch());
  });

  protected readonly bmiValue = computed(() => calculateBmi(this.clinicalForm().vitals.height, this.clinicalForm().vitals.weight));

  protected readonly visitModels = computed<OpdVisitVm[]>(() => {
    const patientMap = new Map(this.patients().map(patient => [patient.patientGuid, patient]));
    const doctorMap = new Map(this.doctors().map(doctor => [doctor.doctorGuid, doctor]));
    const queueMap = new Map(this.queues().map(queue => [queue.appointmentId, queue]));
    const consultationMap = new Map(this.consultations().filter(item => item.appointmentId).map(item => [item.appointmentId as string, item]));

    return this.appointments()
      .map(appointment => {
        const queue = queueMap.get(appointment.id) ?? null;
        const consultation = consultationMap.get(appointment.id) ?? null;
        const patient = patientMap.get(appointment.patientId) ?? null;
        const doctor = doctorMap.get(appointment.doctorId) ?? null;
        return {
          appointment,
          queue,
          consultation,
          patient,
          doctor,
          appointmentNo: appointment.appointmentNo || derivedAppointmentNo(appointment.id),
          tokenNumber: queue?.tokenNumber || '-',
          queueNo: queue?.queueNo ?? null,
          priorityCode: priorityLabel(queue?.priorityCode),
          patientName: patient?.fullName ?? 'Unknown patient',
          patientMrn: patient?.medicalRecordNo ?? 'MRN not found',
          doctorName: doctor?.fullName ?? 'Unknown doctor',
          departmentName: appointment.departmentName || doctor?.departmentName || '-',
          branchName: appointment.branchName || doctor?.branchName || 'Main Branch',
          appointmentTime: formatTime(appointment.startsAt),
          arrivalTime: queue?.arrivedAt ? formatTime(queue.arrivedAt) : null,
          statusCode: String(appointment.statusCode || '').toUpperCase(),
          consultationStatus: String(consultation?.statusCode || appointment.statusCode || '-').toUpperCase()
        };
      })
      .filter(visit => this.matchesSearch(visit))
      .filter(visit => !this.doctorFilter || visit.appointment.doctorId === this.doctorFilter)
      .sort((a, b) => {
        const left = a.queueNo ?? 9999;
        const right = b.queueNo ?? 9999;
        return left === right
          ? safeTime(a.appointment.startsAt) - safeTime(b.appointment.startsAt)
          : left - right;
      });
  });

  protected readonly pendingCheckIns = computed(() => this.visitModels().filter(visit =>
    isToday(visit.appointment.startsAt)
    && !visit.queue
    && ['SCHEDULED', 'CONFIRMED', 'BOOKED'].includes(visit.statusCode)
  ));

  protected readonly waitingQueue = computed(() => this.visitModels().filter(visit =>
    visit.queue
    && isToday(visit.queue.arrivedAt)
    && ['WAITING', 'CHECKED_IN'].includes(String(visit.queue.statusCode || visit.statusCode).toUpperCase())
    && !['IN_PROGRESS', 'IN_CONSULTATION', 'COMPLETED'].includes(visit.consultationStatus)
  ));

  protected readonly queueVisits = computed(() => this.visitModels().filter(visit =>
    visit.queue
    && isToday(visit.queue.arrivedAt)
    && !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'NOSHOW'].includes(String(visit.queue.statusCode).toUpperCase())
    && !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'NOSHOW'].includes(visit.statusCode)
  ));

  protected readonly activeConsultations = computed(() => this.visitModels().filter(visit =>
    ['DRAFT', 'IN_PROGRESS', 'IN_CONSULTATION'].includes(visit.consultationStatus)
  ));

  protected readonly completedVisits = computed(() => this.visitModels().filter(visit =>
    visit.consultationStatus === 'COMPLETED' || visit.statusCode === 'COMPLETED'
  ));

  protected readonly noShowVisits = computed(() => this.visitModels().filter(visit =>
    ['NO_SHOW', 'NOSHOW'].includes(visit.statusCode)
    || ['NO_SHOW', 'NOSHOW'].includes(String(visit.queue?.statusCode || '').toUpperCase())
  ));

  protected readonly encounterCandidates = computed(() => [
    ...this.activeConsultations(),
    ...this.waitingQueue()
  ]);

  protected readonly nextWaitingVisit = computed(() => this.waitingQueue()[0] ?? null);

  protected readonly recentCompletedVisits = computed(() =>
    [...this.completedVisits()]
      .sort((a, b) => Math.max(safeTime(b.queue?.updatedAt), safeTime(b.appointment.updatedAt), safeTime(b.appointment.startsAt)) - Math.max(safeTime(a.queue?.updatedAt), safeTime(a.appointment.updatedAt), safeTime(a.appointment.startsAt)))
      .slice(0, 4)
  );

  protected readonly visibleFollowUps = computed(() => {
    const appointmentMap = new Map(this.appointments().map(appointment => [appointment.id, appointment]));
    return this.followUps().filter(followUp => {
      const appointment = followUp.appointmentId ? appointmentMap.get(followUp.appointmentId) : null;
      return isDateTodayOrFuture(followUp.followUpDate)
        && (!this.doctorFilter || appointment?.doctorId === this.doctorFilter);
    });
  });

  protected readonly stats = computed<OpdStats>(() => ({
    waiting: this.waitingQueue().length,
    inConsultation: this.activeConsultations().length,
    completed: this.completedVisits().length,
    followUps: this.visibleFollowUps().length,
    noShows: this.noShowVisits().length
  }));

  protected readonly totalOperationalVisits = computed(() => {
    const stats = this.stats();
    return stats.waiting + stats.inConsultation + stats.completed + stats.noShows;
  });

  protected readonly completionPercent = computed(() => {
    const total = this.totalOperationalVisits();
    return total ? Math.round((this.stats().completed / total) * 100) : 0;
  });

  protected readonly statCards = computed(() => {
    const stats = this.stats();
    return [
      { label: 'Waiting', value: formatNumber(stats.waiting), icon: 'queue', color: '#2563eb', bg: '#eff6ff', tab: 'queue' as OpdTab },
      { label: 'In Consultation', value: formatNumber(stats.inConsultation), icon: 'clinical_notes', color: '#0f766e', bg: '#f0fdfa', tab: 'active' as OpdTab },
      { label: 'Completed', value: formatNumber(stats.completed), icon: 'task_alt', color: '#059669', bg: '#ecfdf5', tab: 'completed' as OpdTab },
      { label: 'Follow-ups', value: formatNumber(stats.followUps), icon: 'event_repeat', color: '#7c3aed', bg: '#f5f3ff', tab: 'dashboard' as OpdTab },
      { label: 'No Shows', value: formatNumber(stats.noShows), icon: 'event_busy', color: '#dc2626', bg: '#fef2f2', tab: 'queue' as OpdTab }
    ];
  });

  protected tabCount(tabId: OpdTab): string | null {
    const stats = this.stats();
    switch (tabId) {
      case 'queue':
        return formatNumber(stats.waiting);
      case 'check-in':
        return formatNumber(this.pendingCheckIns().length);
      case 'active':
        return formatNumber(stats.inConsultation);
      case 'completed':
        return formatNumber(stats.completed);
      default:
        return null;
    }
  }

  protected readonly doctorQueueSummary = computed(() => {
    const doctor = this.doctors().find(item => item.doctorGuid === this.doctorFilter) ?? null;
    const visits = this.visitModels().filter(visit => !doctor || visit.appointment.doctorId === doctor.doctorGuid);
    return {
      doctorName: doctor ? `${doctor.fullName} · ${doctor.departmentName}` : 'All doctors',
      waiting: formatNumber(visits.filter(visit => this.waitingQueue().some(item => item.appointment.id === visit.appointment.id)).length),
      current: formatNumber(visits.filter(visit => ['DRAFT', 'IN_PROGRESS', 'IN_CONSULTATION'].includes(visit.consultationStatus)).length),
      completed: formatNumber(visits.filter(visit => this.completedVisits().some(item => item.appointment.id === visit.appointment.id)).length)
    };
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.applyRouteContext();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [appointments, queues, patients, doctors, consultations, followUps, labTests, medicines] = await Promise.all([
        this.appointmentService.list(1, 100),
        this.appointmentService.listQueue(1, 100),
        this.patientService.search('', '', '', '', '', 1, 100),
        this.doctorService.search({ searchText: '', departmentName: '', specializationName: '', branchName: '', employmentType: '', statusCode: '', pageNumber: 1, pageSize: 100 }),
        this.opdService.listConsultations(1, 100),
        this.opdService.listFollowUps(1, 100),
        this.opdService.listLabTests(1, 100),
        this.opdService.listMedicines(1, 100)
      ]);

      if (appointments.success && appointments.data) {
        this.appointments.set(appointments.data);
      } else {
        this.toast.error('Unable to load appointments', getApiErrorMessage(appointments, 'Appointment API failed'));
      }

      if (queues.success && queues.data) {
        this.queues.set(queues.data);
      } else {
        this.toast.error('Unable to load OPD queue', getApiErrorMessage(queues, 'Queue API failed'));
      }

      if (patients.success && patients.data) {
        this.patients.set(patients.data.patients);
      } else {
        this.toast.error('Unable to load patients', getApiErrorMessage(patients, 'Patient API failed'));
      }

      if (doctors.success && doctors.data) {
        this.doctors.set(doctors.data.doctors);
      } else {
        this.toast.error('Unable to load doctors', getApiErrorMessage(doctors, 'Doctor API failed'));
      }

      if (consultations.success && consultations.data) {
        this.consultations.set(consultations.data);
      } else {
        this.toast.error('Unable to load consultations', getApiErrorMessage(consultations, 'OPD API failed'));
      }

      if (followUps.success && followUps.data) {
        this.followUps.set(followUps.data);
      } else {
        this.toast.error('Unable to load follow-ups', getApiErrorMessage(followUps, 'Follow-up API failed'));
      }

      if (labTests.success && labTests.data) {
        this.labTests.set(labTests.data);
      } else {
        this.toast.error('Unable to load lab test catalog', getApiErrorMessage(labTests, 'Laboratory API failed'));
      }

      if (medicines.success && medicines.data) {
        this.medicines.set(medicines.data);
      } else {
        this.medicines.set([]);
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected clearFilters(): void {
    this.searchQuery = '';
    this.doctorFilter = '';
  }

  protected openStatCard(tab: OpdTab): void {
    this.activeTab.set(tab);
  }

  protected formatNumberValue(value: number): string {
    return formatNumber(value);
  }

  protected goToAppointments(): void {
    void this.router.navigate(['/appointments']);
  }

  protected selectVisit(visit: OpdVisitVm, tab: OpdTab = 'encounter'): void {
    this.selectedVisit.set(visit);
    this.encounterForm.set(toEncounterForm(visit, 'IN_PROGRESS'));
    this.clinicalForm.set(emptyClinicalForm(visit.consultation?.notes ?? ''));
    this.prescriptionStatus.set('DRAFT');
    this.prescriptionRevisionNo.set(1);
    this.prescriptionPreviewOpen.set(false);
    this.activeEncounterSection.set('snapshot');
    this.activeTab.set(tab);
  }

  protected async quickCheckIn(visit: OpdVisitVm): Promise<void> {
    const form = createCheckInForm(visit, this.queues(), this.appointments());
    const queueResponse = await this.appointmentService.createQueue(form);
    if (!queueResponse.success || !queueResponse.data) {
      this.toast.error('Unable to check in patient', getApiErrorMessage(queueResponse, 'Queue API failed'));
      return;
    }

    const appointmentResponse = await this.appointmentService.updateStatus(visit.appointment, 'CHECKED_IN');
    if (!appointmentResponse.success || !appointmentResponse.data) {
      this.toast.error('Unable to update appointment', getApiErrorMessage(appointmentResponse, 'Appointment API failed'));
      return;
    }

    this.upsertQueue(queueResponse.data);
    this.upsertAppointment(appointmentResponse.data);
    this.toast.success('Patient checked in', `${queueResponse.data.tokenNumber} added to OPD queue.`);
    this.activeTab.set('queue');
  }

  protected async startEncounter(visit: OpdVisitVm): Promise<void> {
    if (!visit.queue) {
      this.toast.warning('Check-in required', 'Add the patient to the OPD queue before starting consultation.');
      return;
    }

    this.saving.set(true);
    try {
      let consultation = visit.consultation;
      if (!consultation) {
        const response = await this.opdService.createConsultation(this.createStartEncounterForm(visit));
        if (!response.success || !response.data) {
          this.toast.error('Unable to start encounter', getApiErrorMessage(response, 'OPD API failed'));
          return;
        }
        consultation = response.data;
        this.upsertConsultation(consultation);
      }

      const appointmentResponse = await this.appointmentService.updateStatus(visit.appointment, 'IN_CONSULTATION');
      if (appointmentResponse.success && appointmentResponse.data) {
        this.upsertAppointment(appointmentResponse.data);
      } else {
        this.toast.error('Encounter created, but appointment status was not updated', getApiErrorMessage(appointmentResponse, 'Appointment API failed'));
      }

      const queueResponse = await this.opdService.updateQueueStatus(visit.queue, 'IN_CONSULTATION');
      if (queueResponse.success && queueResponse.data) {
        this.upsertQueue(queueResponse.data);
      } else {
        this.toast.error('Encounter created, but queue status was not updated', getApiErrorMessage(queueResponse, 'Queue API failed'));
      }

      const updatedVisit = this.visitModels().find(item => item.appointment.id === visit.appointment.id) ?? { ...visit, consultation };
      this.selectVisit(updatedVisit, 'encounter');
      this.toast.success('OPD consultation started', `${this.encounterRecordNo({ ...updatedVisit, consultation })} is now the active clinical record.`);
    } finally {
      this.saving.set(false);
    }
  }

  protected encounterStatusLabel(visit: OpdVisitVm): string {
    if (!visit.consultation) {
      return 'Not Started';
    }
    return humanizeCode(String(visit.consultation.statusCode || visit.consultationStatus || 'IN_PROGRESS').toUpperCase());
  }

  protected encounterRecordNo(visit: OpdVisitVm): string {
    return visit.consultation?.id ? `OPD-${visit.consultation.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'Not created';
  }

  protected canUseQueueActions(visit: OpdVisitVm): boolean {
    const queueStatus = String(visit.queue?.statusCode || visit.statusCode || '').toUpperCase();
    const consultationStatus = String(visit.consultationStatus || '').toUpperCase();
    return Boolean(visit.queue)
      && !['IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'NOSHOW'].includes(queueStatus)
      && !['IN_PROGRESS', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'].includes(consultationStatus);
  }

  protected canTransferDoctor(visit: OpdVisitVm): boolean {
    return this.canUseQueueActions(visit)
      && this.doctors().some(doctor => doctor.doctorGuid !== visit.appointment.doctorId);
  }

  protected queueStatusLabel(visit: OpdVisitVm): string {
    const status = String(visit.queue?.statusCode || visit.statusCode || '').toUpperCase();
    const labels: Record<string, string> = {
      CHECKED_IN: 'Waiting',
      WAITING: 'Waiting',
      SKIPPED: 'Skipped',
      IN_CONSULTATION: 'In Consultation'
    };
    return labels[status] ?? humanizeCode(status || 'WAITING');
  }

  protected queueStatusClass(visit: OpdVisitVm): string {
    const status = String(visit.queue?.statusCode || visit.statusCode || '').toUpperCase();
    if (status === 'SKIPPED') {
      return 'skipped';
    }
    if (status === 'IN_CONSULTATION') {
      return 'active';
    }
    return 'waiting';
  }

  protected async skipVisit(visit: OpdVisitVm): Promise<void> {
    if (!visit.queue) {
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.opdService.updateQueueStatus(visit.queue, 'SKIPPED');
      if (!response.success || !response.data) {
        this.toast.error('Unable to skip token', getApiErrorMessage(response, 'Queue API failed'));
        return;
      }

      this.upsertQueue(response.data);
      this.toast.success('Token skipped', `${visit.tokenNumber} remains available in today's queue.`);
    } finally {
      this.saving.set(false);
    }
  }

  protected async markNoShow(visit: OpdVisitVm): Promise<void> {
    if (!visit.queue) {
      return;
    }

    this.saving.set(true);
    try {
      const queueResponse = await this.opdService.updateQueueStatus(visit.queue, 'NO_SHOW');
      if (!queueResponse.success || !queueResponse.data) {
        this.toast.error('Unable to mark no show', getApiErrorMessage(queueResponse, 'Queue API failed'));
        return;
      }

      const appointmentResponse = await this.appointmentService.updateStatus(visit.appointment, 'NO_SHOW');
      if (!appointmentResponse.success || !appointmentResponse.data) {
        this.toast.error('Unable to update appointment', getApiErrorMessage(appointmentResponse, 'Appointment API failed'));
        return;
      }

      this.upsertQueue(queueResponse.data);
      this.upsertAppointment(appointmentResponse.data);
      if (this.selectedVisit()?.appointment.id === visit.appointment.id) {
        this.selectedVisit.set(null);
      }
      this.toast.success('Marked no show', `${visit.patientName} has been removed from the active OPD queue.`);
    } finally {
      this.saving.set(false);
    }
  }

  protected openTransferDoctor(visit: OpdVisitVm): void {
    this.transferVisit.set(visit);
    this.transferDoctorId = '';
  }

  protected cancelTransferDoctor(): void {
    this.transferVisit.set(null);
    this.transferDoctorId = '';
  }

  protected async confirmTransferDoctor(): Promise<void> {
    const visit = this.transferVisit();
    const doctor = this.doctors().find(item => item.doctorGuid === this.transferDoctorId);
    if (!visit || !doctor) {
      this.toast.warning('Select a doctor', 'Choose the target doctor before transferring this token.');
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.appointmentService.updateRecord({
        ...visit.appointment,
        doctorId: doctor.doctorGuid,
        departmentName: doctor.departmentName || visit.appointment.departmentName,
        branchName: doctor.branchName || visit.appointment.branchName
      });

      if (!response.success || !response.data) {
        this.toast.error('Unable to transfer doctor', getApiErrorMessage(response, 'Appointment API failed'));
        return;
      }

      this.upsertAppointment(response.data);
      this.cancelTransferDoctor();
      this.toast.success('Doctor transferred', `${visit.tokenNumber} moved to ${doctor.fullName}.`);
    } finally {
      this.saving.set(false);
    }
  }

  protected patientAgeGender(visit: OpdVisitVm): string {
    return [visit.patient?.age ? `${visit.patient.age} yrs` : '-', visit.patient?.genderName || '-'].join(' / ');
  }

  protected previousVisitCount(visit: OpdVisitVm): string {
    return formatNumber(this.consultations().filter(item => item.patientId === visit.appointment.patientId && item.id !== visit.consultation?.id).length);
  }

  protected currentMedicationSummary(): string {
    const medicines = this.clinicalForm().prescriptions.map(item => item.medicine.trim()).filter(Boolean);
    return medicines.length ? medicines.slice(0, 3).join(', ') : 'None recorded';
  }

  protected labTestName(testId: string): string {
    const test = this.labTests().find(item => item.id === testId);
    return test ? `${test.code} · ${test.name}` : 'Test not selected';
  }

  protected toAmount(value: string): number {
    return toAmount(value);
  }

  protected currency(value: number): string {
    return formatCurrency(value);
  }

  protected prescriptionMedicineName(item: OpdPrescriptionItemForm): string {
    return formatPrescriptionMedicineName(item);
  }

  protected prescriptionMedicineInstruction(item: OpdPrescriptionItemForm): string {
    return formatPrescriptionMedicineInstruction(item);
  }

  protected addComplaint(): void {
    const draft = this.clinicalForm().complaintDraft;
    if (!draft.complaint.trim()) {
      this.toast.warning('Complaint required', 'Enter the complaint before adding it.');
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      complaints: [...form.complaints, { ...draft }],
      complaintDraft: emptyComplaintForm()
    }));
  }

  protected removeComplaint(index: number): void {
    this.clinicalForm.update(form => ({ ...form, complaints: form.complaints.filter((_, itemIndex) => itemIndex !== index) }));
  }

  protected useComplaintTemplate(complaint: string): void {
    this.clinicalForm.update(form => ({
      ...form,
      complaintDraft: {
        ...form.complaintDraft,
        complaint
      }
    }));
  }

  protected updateMedicineSearch(value: string): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      prescriptionDraft: {
        ...form.prescriptionDraft,
        medicine: value,
        medicineId: null
      }
    }));
    this.markPrescriptionChanged();
  }

  protected updateFrequencySelection(value: string): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const isCustom = value === 'CUSTOM';
    this.customFrequencyMode.set(isCustom);
    this.clinicalForm.update(form => ({
      ...form,
      prescriptionDraft: {
        ...form.prescriptionDraft,
        frequency: isCustom ? '' : value
      }
    }));
    this.markPrescriptionChanged();
  }

  protected addInvestigation(value = this.clinicalForm().investigationDraft): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const investigation = value.trim();
    if (!investigation) {
      this.toast.warning('Investigation required', 'Enter or select an investigation before adding it.');
      return;
    }

    this.clinicalForm.update(form => ({
      ...form,
      includeInvestigationsInPrescription: true,
      prescriptionInvestigations: uniqueStrings([...form.prescriptionInvestigations, investigation]),
      investigationDraft: ''
    }));
    this.markPrescriptionChanged();
  }

  protected removeInvestigation(index: number): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      prescriptionInvestigations: form.prescriptionInvestigations.filter((_, itemIndex) => itemIndex !== index)
    }));
    this.markPrescriptionChanged();
  }

  protected useProcedureTemplate(procedure: string): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      procedureDraft: {
        ...form.procedureDraft,
        procedure
      }
    }));
  }

  protected addAdvice(value = this.clinicalForm().adviceDraft): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const advice = value.trim();
    if (!advice) {
      this.toast.warning('Advice required', 'Enter or select advice before adding it.');
      return;
    }

    this.clinicalForm.update(form => ({
      ...form,
      adviceList: uniqueStrings([...form.adviceList, advice]),
      adviceDraft: ''
    }));
    this.markPrescriptionChanged();
  }

  protected removeAdvice(index: number): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      adviceList: form.adviceList.filter((_, itemIndex) => itemIndex !== index)
    }));
    this.markPrescriptionChanged();
  }

  protected updateDietAdviceSelection(value: string): void {
    const isCustom = value === 'CUSTOM';
    this.customDietAdviceMode.set(isCustom);
    this.clinicalForm.update(form => ({
      ...form,
      dietAdviceDraft: isCustom ? '' : value
    }));
  }

  protected addDietAdvice(value = this.clinicalForm().dietAdviceDraft): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const advice = value.trim();
    if (!advice) {
      this.toast.warning('Diet advice required', 'Select or enter diet advice before adding it.');
      return;
    }

    this.clinicalForm.update(form => ({
      ...form,
      dietAdviceList: uniqueStrings([...form.dietAdviceList, advice]),
      dietAdviceDraft: ''
    }));
    this.customDietAdviceMode.set(false);
    this.markPrescriptionChanged();
  }

  protected removeDietAdvice(index: number): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      dietAdviceList: form.dietAdviceList.filter((_, itemIndex) => itemIndex !== index)
    }));
    this.markPrescriptionChanged();
  }

  protected updateFollowUpAfterDays(value: string): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const days = Number(String(value || '').replace(/[^0-9]/g, ''));
    this.clinicalForm.update(form => ({
      ...form,
      followUp: {
        ...form.followUp,
        followUpRequired: days > 0 || form.followUp.followUpRequired,
        followUpAfterDays: value,
        followUpDate: days > 0 ? addDaysInputValue(new Date(), days) : form.followUp.followUpDate
      }
    }));
    this.markPrescriptionChanged();
  }

  protected selectMedicineSuggestion(medicine: MedicineSuggestion): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      prescriptionDraft: {
        ...form.prescriptionDraft,
        medicineId: medicine.id,
        medicine: medicine.name,
        strength: medicine.strength,
        dosageForm: medicine.form
      }
    }));
    this.markPrescriptionChanged();
  }

  protected addDiagnosis(): void {
    const draft = this.clinicalForm().diagnosisDraft;
    if (!draft.diagnosisName.trim()) {
      this.toast.warning('Diagnosis required', 'Enter diagnosis name before adding it.');
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      diagnoses: [...form.diagnoses, { ...draft }],
      diagnosisDraft: emptyDiagnosisForm()
    }));
  }

  protected removeDiagnosis(index: number): void {
    this.clinicalForm.update(form => ({ ...form, diagnoses: form.diagnoses.filter((_, itemIndex) => itemIndex !== index) }));
  }

  protected addPrescriptionItem(): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const draft = this.clinicalForm().prescriptionDraft;
    if (!draft.medicine.trim()) {
      this.toast.warning('Medicine required', 'Enter medicine name before adding it.');
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      prescriptions: [...form.prescriptions, { ...draft }],
      prescriptionDraft: emptyPrescriptionItemForm()
    }));
    this.customFrequencyMode.set(false);
    this.markPrescriptionChanged();
  }

  protected removePrescriptionItem(index: number): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({ ...form, prescriptions: form.prescriptions.filter((_, itemIndex) => itemIndex !== index) }));
    this.markPrescriptionChanged();
  }

  protected applyPrescriptionTemplate(templateId = this.selectedPrescriptionTemplateId): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }

    const template = this.prescriptionTemplates().find(item => item.id === templateId);
    if (!template) {
      this.toast.warning('Template required', 'Select a prescription template before applying it.');
      return;
    }

    this.selectedPrescriptionTemplateId = template.id;
    this.clinicalForm.update(form => ({
      ...form,
      prescriptions: mergePrescriptionItems(form.prescriptions, template.medicines),
      adviceList: uniqueStrings([...form.adviceList, ...template.advice]),
      followUp: {
        ...form.followUp,
        followUpRequired: true,
        followUpAfterDays: String(template.followUpAfterDays),
        followUpDate: addDaysInputValue(new Date(), template.followUpAfterDays),
        reason: template.followUpReason,
        notes: template.followUpNotes || form.followUp.notes
      }
    }));
    this.markPrescriptionChanged();
    this.toast.success('Template applied', `${template.name} added to this prescription draft.`);
  }

  protected canSavePrescriptionTemplate(): boolean {
    const form = this.clinicalForm();
    return !this.prescriptionLocked() && (
      form.prescriptions.length > 0 ||
      form.adviceList.length > 0 ||
      Boolean(form.followUp.followUpAfterDays || form.followUp.followUpDate || form.followUp.notes)
    );
  }

  protected openSavePrescriptionTemplate(): void {
    if (!this.canSavePrescriptionTemplate()) {
      this.toast.warning('Template content required', 'Add medicines, advice, or follow-up before saving a template.');
      return;
    }

    const form = this.clinicalForm();
    const suggestedName = form.diagnoses.find(item => item.diagnosisName.trim())?.diagnosisName
      || form.complaints.find(item => item.complaint.trim())?.complaint
      || 'Custom Prescription';
    this.saveTemplateDraft = {
      name: suggestedName,
      description: `${form.prescriptions.length} medicines · ${form.adviceList.length} advice items`
    };
    this.saveTemplateOpen.set(true);
  }

  protected closeSavePrescriptionTemplate(): void {
    this.saveTemplateOpen.set(false);
  }

  protected saveCurrentPrescriptionTemplate(): void {
    const name = this.saveTemplateDraft.name.trim();
    if (!name) {
      this.toast.warning('Template name required', 'Enter a template name before saving.');
      return;
    }

    const form = this.clinicalForm();
    const followUpAfterDays = Number(String(form.followUp.followUpAfterDays || '').replace(/[^0-9]/g, '')) || 7;
    const template: PrescriptionTemplate = {
      id: `custom-${Date.now()}`,
      name,
      description: this.saveTemplateDraft.description.trim() || 'Doctor saved prescription template.',
      medicines: form.prescriptions.map(item => ({ ...item })),
      advice: [...form.adviceList],
      followUpAfterDays,
      followUpReason: form.followUp.reason || 'Follow-up',
      followUpNotes: form.followUp.notes || 'Review patient response.'
    };

    this.prescriptionTemplates.update(templates => [...templates, template]);
    persistPrescriptionTemplates(this.prescriptionTemplates());
    this.selectedPrescriptionTemplateId = template.id;
    this.saveTemplateOpen.set(false);
    this.toast.success('Template saved', `${template.name} is available for future OPD prescriptions.`);
  }

  protected closePrescriptionPreview(): void {
    this.prescriptionPreviewOpen.set(false);
  }

  protected async savePrescriptionDraft(): Promise<void> {
    this.markPrescriptionChanged();
    this.commitPrescriptionDraft();
    await this.saveEncounter('IN_PROGRESS');
  }

  protected async previewPrescription(): Promise<void> {
    if (!await this.ensurePrescriptionGenerated()) {
      return;
    }

    this.prescriptionPreviewOpen.set(true);
  }

  protected async generatePrescription(): Promise<boolean> {
    const previousStatus = this.prescriptionStatus();
    if (!this.prescriptionLocked()) {
      this.prescriptionStatus.set('GENERATED');
    }
    if (!await this.ensurePrescriptionGenerated()) {
      this.prescriptionStatus.set(previousStatus);
      return false;
    }

    this.prescriptionStatus.set('GENERATED');
    this.toast.success('Prescription generated', 'Prescription document is ready to review and finalize.');
    return true;
  }

  protected async finalizePrescription(showToast = true): Promise<boolean> {
    if (['FINALIZED', 'PRINTED', 'SHARED'].includes(this.prescriptionStatus())) {
      return true;
    }

    if (!await this.ensurePrescriptionGenerated()) {
      return false;
    }

    this.prescriptionStatus.set('FINALIZED');
    if (showToast) {
      this.toast.success('Prescription finalized', 'Issued prescription is now locked. Create a revision for corrections.');
    }
    return true;
  }

  protected async printPrescription(saveBeforePrint = true): Promise<void> {
    if (saveBeforePrint && !await this.ensureFinalPrescription()) {
      return;
    }

    this.printOptionsOpen.set(true);
  }

  protected closePrintOptions(): void {
    this.printOptionsOpen.set(false);
  }

  protected confirmPrintPrescription(): void {
    const preview = this.prescriptionPreview();
    if (!preview) {
      this.toast.warning('Prescription unavailable', 'Select an OPD encounter before printing.');
      return;
    }

    if (!openPrescriptionDocument(preview, true, this.printOptions)) {
      this.toast.error('Unable to open prescription', 'Allow pop-ups for this site and try again.');
      return;
    }
    this.prescriptionStatus.set('PRINTED');
    this.printOptionsOpen.set(false);
  }

  protected async printPrescriptionDirect(saveBeforePrint = true): Promise<void> {
    if (saveBeforePrint && !await this.ensureFinalPrescription()) {
      return;
    }

    const preview = this.prescriptionPreview();
    if (!preview) {
      this.toast.warning('Prescription unavailable', 'Select an OPD encounter before printing.');
      return;
    }

    if (!openPrescriptionDocument(preview, true)) {
      this.toast.error('Unable to open prescription', 'Allow pop-ups for this site and try again.');
      return;
    }
    this.prescriptionStatus.set('PRINTED');
  }

  protected async downloadPrescription(): Promise<void> {
    if (!await this.ensureFinalPrescription()) {
      return;
    }

    const preview = this.prescriptionPreview();
    if (!preview) {
      this.toast.warning('Prescription unavailable', 'Preview the prescription before downloading.');
      return;
    }

    if (openPrescriptionDocument(preview, true, this.printOptions)) {
      this.prescriptionStatus.set('PRINTED');
      this.toast.info('Download prescription', 'Use the print dialog and choose Save as PDF.');
    } else {
      this.toast.error('Unable to open prescription', 'Allow pop-ups for this site and try again.');
    }
  }

  protected async sharePrescription(): Promise<void> {
    if (!await this.ensureFinalPrescription()) {
      return;
    }

    const preview = this.prescriptionPreview();
    if (!preview) {
      this.toast.warning('Prescription unavailable', 'Preview the prescription before sharing.');
      return;
    }

    const text = prescriptionPlainText(preview);
    try {
      const browserNavigator = navigator as PrescriptionNavigator;
      if (browserNavigator.share) {
        await browserNavigator.share({ title: `Prescription - ${preview.patientName}`, text });
        this.prescriptionStatus.set('SHARED');
        return;
      }

      await browserNavigator.clipboard?.writeText(text);
      this.prescriptionStatus.set('SHARED');
      this.toast.success('Prescription copied', 'Prescription details are ready to share with the patient.');
    } catch {
      this.toast.error('Unable to share prescription', 'Copy or print the prescription from the preview.');
    }
  }

  protected createRevisedPrescription(): void {
    this.prescriptionStatus.set('DRAFT');
    this.prescriptionRevisionNo.update(value => value + 1);
    this.clinicalForm.update(form => ({
      ...form,
      prescriptionId: '',
      prescriptionNo: buildRevisedPrescriptionNo(form.prescriptionNo || this.prescriptionPreview()?.prescriptionNo || '', this.prescriptionRevisionNo()),
      prescriptions: form.prescriptions.map(item => ({ ...item, id: undefined }))
    }));
    this.toast.info('Revision started', 'Prescription is editable again as a revised draft.');
  }

  protected addLabOrderDraft(): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const draft = this.clinicalForm().labOrderDraft;
    if (!draft.testId) {
      this.toast.warning('Test required', 'Select a test before adding it.');
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      labOrders: [...form.labOrders, { ...draft }],
      labOrderDraft: emptyLabOrderForm()
    }));
    this.markPrescriptionChanged();
  }

  protected removeLabOrder(index: number): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({ ...form, labOrders: form.labOrders.filter((_, itemIndex) => itemIndex !== index) }));
    this.markPrescriptionChanged();
  }

  protected addProcedure(): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const draft = this.clinicalForm().procedureDraft;
    if (!draft.procedure.trim()) {
      this.toast.warning('Procedure required', 'Enter procedure name before adding it.');
      return;
    }
    this.clinicalForm.update(form => ({
      ...form,
      procedures: [...form.procedures, { ...draft }],
      procedureDraft: emptyProcedureForm()
    }));
    this.markPrescriptionChanged();
  }

  protected removeProcedure(index: number): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    this.clinicalForm.update(form => ({ ...form, procedures: form.procedures.filter((_, itemIndex) => itemIndex !== index) }));
    this.markPrescriptionChanged();
  }

  protected async createLabOrder(visit: OpdVisitVm): Promise<void> {
    const consultation = await this.ensureEncounterForAction(visit);
    if (!consultation) {
      return;
    }

    if (this.clinicalForm().labOrders.length === 0 && this.clinicalForm().labOrderDraft.testId) {
      this.addLabOrderDraft();
    }

    const pendingOrders = this.clinicalForm().labOrders.filter(item => !item.labOrderId);
    if (pendingOrders.length === 0) {
      this.toast.warning('No pending lab tests', 'Add at least one unsent lab test first.');
      return;
    }

    this.saving.set(true);
    try {
      const orderResponse = await this.opdService.createLabOrder(visit.appointment.patientId, consultation.id);
      if (!orderResponse.success || !orderResponse.data) {
        this.toast.error('Unable to create lab order', getApiErrorMessage(orderResponse, 'Laboratory API failed'));
        return;
      }

      for (const item of pendingOrders) {
        const test = this.labTests().find(testItem => testItem.id === item.testId);
        if (test) {
          await this.opdService.createLabOrderItem(orderResponse.data.id, test);
        }
      }

      this.clinicalForm.update(form => ({
        ...form,
        labOrders: form.labOrders.map(item => item.labOrderId ? item : { ...item, labOrderId: orderResponse.data?.id })
      }));
      this.toast.success('Lab order created', 'Selected tests were sent to the laboratory queue.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async createFollowUp(visit: OpdVisitVm): Promise<void> {
    const form = this.clinicalForm().followUp;
    if (!form.followUpRequired || !form.followUpDate) {
      this.toast.warning('Follow-up details required', 'Enable follow-up and select a follow-up date.');
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.opdService.createFollowUp(visit.appointment.patientId, visit.appointment.id, form.followUpDate, form.notes);
      if (!response.success || !response.data) {
        this.toast.error('Unable to create follow-up', getApiErrorMessage(response, 'Follow-up API failed'));
        return;
      }
      this.followUps.update(items => [response.data!, ...items]);

      if (form.createAppointment) {
        const doctorId = form.preferredDoctorId || visit.appointment.doctorId;
        const doctor = this.doctors().find(item => item.doctorGuid === doctorId);
        const appointmentResponse = await this.appointmentService.create({
          appointmentId: '',
          appointmentNo: '',
          patientId: visit.appointment.patientId,
          branchName: visit.branchName,
          departmentName: doctor?.departmentName || visit.departmentName,
          doctorId,
          appointmentDate: form.followUpDate,
          appointmentTime: '09:00',
          appointmentType: 'FOLLOW_UP',
          statusCode: 'SCHEDULED',
          reason: 'Follow-up OPD visit',
          notes: form.notes
        } satisfies AppointmentForm);

        if (appointmentResponse.success && appointmentResponse.data) {
          this.upsertAppointment(appointmentResponse.data);
        }
      }

      this.toast.success('Follow-up created', form.createAppointment ? 'Follow-up appointment was also scheduled.' : 'Follow-up task added.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async admitPatient(visit: OpdVisitVm): Promise<void> {
    const consultation = await this.ensureEncounterForAction(visit);
    if (!consultation) {
      return;
    }

    this.saving.set(true);
    try {
      await this.saveEncounter('IN_PROGRESS');
      const response = await this.opdService.createAdmission(visit.appointment.patientId, visit.appointment.doctorId);
      if (!response.success || !response.data) {
        this.toast.error('Unable to admit patient', getApiErrorMessage(response, 'IPD API failed'));
        return;
      }
      this.clinicalForm.update(form => ({ ...form, admissionId: response.data?.id ?? '' }));
      this.toast.success('Patient admitted', `${visit.patientName} has been moved into IPD admission workflow.`);
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveEncounter(statusCode: 'IN_PROGRESS' | 'COMPLETED'): Promise<OpdConsultationRecord | null> {
    const visit = this.selectedVisit();
    if (!visit) {
      return null;
    }

    this.saving.set(true);
    try {
      const notes = composeClinicalNotes(this.clinicalForm(), this.labTests());
      const form = {
        ...this.encounterForm(),
        notes,
        statusCode: statusCode === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS'
      } satisfies OpdEncounterForm;
      const response = form.consultationId
        ? await this.opdService.updateConsultation(form)
        : await this.opdService.createConsultation(form);

      if (!response.success || !response.data) {
        this.toast.error('Unable to save encounter', getApiErrorMessage(response, 'OPD API failed'));
        return null;
      }

      await this.createClinicalChildRecords(response.data, visit);
      this.upsertConsultation(response.data);
      const updatedVisit = { ...visit, consultation: response.data };
      this.selectedVisit.set(updatedVisit);
      this.encounterForm.set(toEncounterForm(updatedVisit, response.data.statusCode === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS'));
      const prescriptionReady = this.clinicalForm().prescriptions.length > 0 && Boolean(this.clinicalForm().prescriptionId);
      this.toast.success(
        statusCode === 'COMPLETED' ? 'Clinical record completed' : 'Draft saved',
        statusCode === 'IN_PROGRESS' && prescriptionReady ? 'Prescription generated and ready to preview.' : undefined
      );
      return response.data;
    } finally {
      this.saving.set(false);
    }
  }

  protected async completeVisit(): Promise<void> {
    const visit = this.selectedVisit();
    if (!visit) {
      return;
    }

    const consultation = await this.saveEncounter('COMPLETED');
    if (!consultation) {
      return;
    }

    await this.generateEncounterBill(visit);

    const appointmentResponse = await this.appointmentService.updateStatus(visit.appointment, 'COMPLETED');
    if (appointmentResponse.success && appointmentResponse.data) {
      this.upsertAppointment(appointmentResponse.data);
    }

    if (visit.queue) {
      const queueResponse = await this.opdService.updateQueueStatus(visit.queue, 'COMPLETED');
      if (queueResponse.success && queueResponse.data) {
        this.upsertQueue(queueResponse.data);
      }
    }

    this.activeTab.set('completed');
  }

  private async ensureEncounterForAction(visit: OpdVisitVm): Promise<OpdConsultationRecord | null> {
    if (visit.consultation) {
      return visit.consultation;
    }

    await this.startEncounter(visit);
    return this.visitModels().find(item => item.appointment.id === visit.appointment.id)?.consultation ?? null;
  }

  private async ensurePrescriptionGenerated(): Promise<boolean> {
    const visit = this.selectedVisit();
    if (!visit) {
      this.toast.warning('Select encounter', 'Select an OPD encounter before generating a prescription.');
      return false;
    }

    if (this.prescriptionLocked()) {
      return true;
    }

    this.commitPrescriptionDraft();
    if (!hasPrescriptionContent(this.clinicalForm(), this.labTests())) {
      this.toast.warning('Prescription content required', 'Add medicine, investigation, procedure, advice, diet advice, or follow-up before previewing.');
      this.activeEncounterSection.set('prescription');
      return false;
    }

    return Boolean(await this.saveEncounter('IN_PROGRESS'));
  }

  private async ensureFinalPrescription(): Promise<boolean> {
    return ['FINALIZED', 'PRINTED', 'SHARED'].includes(this.prescriptionStatus())
      ? true
      : await this.finalizePrescription(false);
  }

  private commitPrescriptionDraft(): void {
    if (this.prescriptionLocked()) {
      return;
    }
    const statusBeforeCommit = this.prescriptionStatus();
    const draft = this.clinicalForm().prescriptionDraft;
    if (!draft.medicine.trim()) {
      return;
    }

    this.clinicalForm.update(form => ({
      ...form,
      prescriptions: [...form.prescriptions, { ...draft }],
      prescriptionDraft: emptyPrescriptionItemForm()
    }));
    this.customFrequencyMode.set(false);
    this.prescriptionStatus.set(statusBeforeCommit === 'GENERATED' ? 'GENERATED' : 'DRAFT');
  }

  private markPrescriptionChanged(): void {
    if (this.prescriptionLocked()) {
      return;
    }
    this.prescriptionStatus.set('DRAFT');
  }

  private ensurePrescriptionEditable(): boolean {
    if (!this.prescriptionLocked()) {
      return true;
    }

    this.toast.warning('Prescription is issued', 'Create a revised prescription before changing finalized medical instructions.');
    return false;
  }

  private async createClinicalChildRecords(consultation: OpdConsultationRecord, visit: OpdVisitVm): Promise<void> {
    const form = this.clinicalForm();
    const complaints = [...form.complaints];
    for (const complaint of complaints.filter(item => !item.id)) {
      const response = await this.opdService.createSymptom(consultation.id, formatComplaint(complaint));
      if (response.success && response.data) {
        complaint.id = response.data.id;
      }
    }

    const diagnoses = [...form.diagnoses];
    for (const diagnosis of diagnoses.filter(item => !item.id)) {
      const response = await this.opdService.createDiagnosis(consultation.id, diagnosis);
      if (response.success && response.data) {
        diagnosis.id = response.data.id;
      }
    }

    let prescriptionId = form.prescriptionId;
    let prescriptionNo = form.prescriptionNo;
    if (hasPrescriptionContent(form, this.labTests()) && !prescriptionId) {
      prescriptionNo = prescriptionNo || buildPrescriptionNo(visit, consultation);
      const context = buildPrescriptionContext(visit, consultation, prescriptionNo, this.prescriptionStatusLabel(), this.prescriptionRevisionNo());
      const response = await this.opdService.createPrescription(
        consultation.id,
        buildPrescriptionInstructions(form, this.labTests(), context, form.includeVitalsInPrescription ? buildPrescriptionVitals(form) : [])
      );
      if (response.success && response.data) {
        prescriptionId = response.data.id;
      }
    }

    const prescriptions = [...form.prescriptions];
    if (prescriptionId) {
      for (const item of prescriptions.filter(prescription => !prescription.id)) {
        const response = await this.opdService.createPrescriptionItem(prescriptionId, item);
        if (response.success && response.data) {
          item.id = response.data.id;
        }
      }
    }

    this.clinicalForm.update(current => ({
      ...current,
      complaints,
      diagnoses,
      prescriptions,
      prescriptionId,
      prescriptionNo
    }));
  }

  private async generateEncounterBill(visit: OpdVisitVm): Promise<void> {
    if (this.clinicalForm().invoiceId) {
      return;
    }

    const services = this.billableServices(visit);
    const grossAmount = services.reduce((total, service) => total + service.amount, 0);
    const invoiceResponse = await this.opdService.createInvoice(visit.appointment.patientId, grossAmount);
    if (!invoiceResponse.success || !invoiceResponse.data) {
      this.toast.error('Unable to generate OPD bill', getApiErrorMessage(invoiceResponse, 'Billing API failed'));
      return;
    }

    for (const service of services) {
      await this.opdService.createInvoiceItem(invoiceResponse.data.id, service.description, service.quantity, service.rate);
    }

    this.clinicalForm.update(form => ({ ...form, invoiceId: invoiceResponse.data?.id ?? '' }));
    this.toast.success('OPD bill generated', `${invoiceResponse.data.invoiceNo} is ready in billing.`);
  }

  private billableServices(visit: OpdVisitVm): Array<{ description: string; quantity: number; rate: number; amount: number }> {
    const doctor = this.doctors().find(item => item.doctorGuid === visit.appointment.doctorId);
    const consultationFee = Math.max(Number(doctor?.consultationFee ?? 0), 0);
    const services = [
      {
        description: `OPD Consultation - ${visit.doctorName}`,
        quantity: 1,
        rate: consultationFee,
        amount: consultationFee
      }
    ];

    for (const procedure of this.clinicalForm().procedures) {
      const rate = toAmount(procedure.charge);
      services.push({ description: `Procedure - ${procedure.procedure}`, quantity: 1, rate, amount: rate });
    }

    for (const order of this.clinicalForm().labOrders) {
      const test = this.labTests().find(item => item.id === order.testId);
      if (test) {
        services.push({ description: `Lab Test - ${test.name}`, quantity: 1, rate: test.price, amount: test.price });
      }
    }

    return services.length ? services : [{ description: 'OPD Consultation', quantity: 1, rate: 0, amount: 0 }];
  }

  private createStartEncounterForm(visit: OpdVisitVm): OpdEncounterForm {
    const form = toEncounterForm(visit, 'IN_PROGRESS');
    const selectedVisit = this.selectedVisit();
    return selectedVisit?.appointment.id === visit.appointment.id
      ? { ...form, notes: composeClinicalNotes(this.clinicalForm(), this.labTests()) }
      : form;
  }

  private matchesSearch(visit: OpdVisitVm): boolean {
    const search = this.searchQuery.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return [
      visit.appointmentNo,
      visit.tokenNumber,
      visit.patientName,
      visit.patientMrn,
      visit.doctorName,
      visit.departmentName,
      visit.branchName,
      visit.statusCode,
      visit.consultationStatus
    ].join(' ').toLowerCase().includes(search);
  }

  private upsertAppointment(appointment: AppointmentRecord): void {
    this.appointments.update(appointments => appointments.some(item => item.id === appointment.id)
      ? appointments.map(item => item.id === appointment.id ? appointment : item)
      : [appointment, ...appointments]);
  }

  private upsertQueue(queue: AppointmentQueueRecord): void {
    this.queues.update(queues => queues.some(item => item.id === queue.id || item.appointmentId === queue.appointmentId)
      ? queues.map(item => item.id === queue.id || item.appointmentId === queue.appointmentId ? queue : item)
      : [queue, ...queues]);
  }

  private upsertConsultation(consultation: OpdConsultationRecord): void {
    this.consultations.update(consultations => consultations.some(item => item.id === consultation.id)
      ? consultations.map(item => item.id === consultation.id ? consultation : item)
      : [consultation, ...consultations]);
  }

  private applyRouteContext(): void {
    const appointmentId = this.route.snapshot.queryParamMap.get('appointmentId');
    if (!appointmentId) {
      return;
    }

    const visit = this.visitModels().find(item => item.appointment.id === appointmentId);
    if (visit) {
      this.selectVisit(visit, 'encounter');
    }
  }
}

interface PrescriptionPreview {
  hospitalName: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  ageGender: string;
  doctorName: string;
  doctorQualification: string;
  doctorRegistrationNo: string;
  departmentName: string;
  branchName: string;
  appointmentId: string;
  appointmentNo: string;
  opdEncounterId: string;
  opdEncounterNo: string;
  clinicalRecordNo: string;
  prescriptionId: string;
  prescriptionNo: string;
  statusLabel: string;
  revisionNo: number;
  generatedAt: string;
  includeVitals: boolean;
  vitals: PrescriptionVital[];
  diagnoses: OpdDiagnosisForm[];
  medicines: OpdPrescriptionItemForm[];
  investigations: string[];
  procedures: string[];
  advice: string[];
  dietAdvice: string[];
  followUp: string[];
  symptomSummary: string;
  diagnosisSummary: string;
  vitalSummary: string;
  followUpSummary: string;
  notes: string;
}

type PrescriptionStatus = 'DRAFT' | 'GENERATED' | 'FINALIZED' | 'PRINTED' | 'SHARED';
type PrescriptionPrintFormat = 'A4' | 'A5' | 'THERMAL';

interface PrescriptionPrintOptions {
  format: PrescriptionPrintFormat;
  includeHospitalHeader: boolean;
  includeDoctorSignature: boolean;
  includeQrCode: boolean;
  includeVitals: boolean;
  includeDiagnosis: boolean;
  includeAdvice: boolean;
  includeFollowUp: boolean;
}

const prescriptionStatusLabels: Record<PrescriptionStatus, string> = {
  DRAFT: 'Draft',
  GENERATED: 'Generated',
  FINALIZED: 'Finalized',
  PRINTED: 'Printed',
  SHARED: 'Shared'
};

function defaultPrescriptionPrintOptions(): PrescriptionPrintOptions {
  return {
    format: 'A4',
    includeHospitalHeader: true,
    includeDoctorSignature: true,
    includeQrCode: true,
    includeVitals: true,
    includeDiagnosis: true,
    includeAdvice: true,
    includeFollowUp: true
  };
}

interface PrescriptionVital {
  label: string;
  value: string;
}

interface PrescriptionNavigator {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: Clipboard;
}

interface PrescriptionHeaderVm {
  patientName: string;
  patientMrn: string;
  age: string;
  gender: string;
  bloodGroup: string;
  mobileNo: string;
  patientAddress: string;
  doctorName: string;
  specialization: string;
  registrationNo: string;
  departmentName: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalContact: string;
  prescriptionNo: string;
  prescriptionDateTime: string;
  appointmentNo: string;
  opdEncounterNo: string;
  visitType: string;
}

interface PrescriptionTemplate {
  id: string;
  name: string;
  description: string;
  medicines: OpdPrescriptionItemForm[];
  advice: string[];
  followUpAfterDays: number;
  followUpReason: string;
  followUpNotes: string;
}

interface PrescriptionTemplateDraft {
  name: string;
  description: string;
}

const PRESCRIPTION_TEMPLATE_STORAGE_KEY = 'care360.opd.prescriptionTemplates';

const DEFAULT_PRESCRIPTION_TEMPLATES: PrescriptionTemplate[] = [
  {
    id: 'fever-adult',
    name: 'Fever - Adult',
    description: 'Fever support with antipyretic, hydration advice, and short review.',
    medicines: [
      rxTemplateMedicine('Paracetamol', '500 mg', 'Tablet', '1 Tablet', 'Twice Daily', 'Oral', '3 Days', 'After Food'),
      rxTemplateMedicine('Vitamin C', '500 mg', 'Tablet', '1 Tablet', 'Once Daily', 'Oral', '5 Days', 'After Food')
    ],
    advice: ['Drink plenty of water.', 'Take adequate rest.'],
    followUpAfterDays: 3,
    followUpReason: 'Review',
    followUpNotes: 'Review fever and symptoms.'
  },
  {
    id: 'cold-cough',
    name: 'Cold & Cough',
    description: 'Symptomatic care for cough, cold, throat irritation, and congestion.',
    medicines: [
      rxTemplateMedicine('Cetirizine', '10 mg', 'Tablet', '1 Tablet', 'Every Night', 'Oral', '3 Days', 'After Dinner'),
      rxTemplateMedicine('Paracetamol', '500 mg', 'Tablet', '1 Tablet', 'As Needed', 'Oral', '3 Days', 'Only if fever or body ache')
    ],
    advice: ['Steam inhalation twice daily.', 'Drink warm fluids.', 'Avoid cold drinks.'],
    followUpAfterDays: 5,
    followUpReason: 'Follow-up',
    followUpNotes: 'Review if cough, fever, or breathing difficulty persists.'
  },
  {
    id: 'hypertension-follow-up',
    name: 'Hypertension Follow-up',
    description: 'Follow-up template with BP monitoring and lifestyle advice.',
    medicines: [
      rxTemplateMedicine('Amlodipine', '5 mg', 'Tablet', '1 Tablet', 'Once Daily', 'Oral', '30 Days', 'Same time daily')
    ],
    advice: ['Monitor blood pressure regularly.', 'Low Salt Diet', 'Continue medication as prescribed.'],
    followUpAfterDays: 30,
    followUpReason: 'Follow-up',
    followUpNotes: 'Review BP chart and medication response.'
  },
  {
    id: 'diabetes-follow-up',
    name: 'Diabetes Follow-up',
    description: 'Diabetes review with glucose monitoring and diet reminders.',
    medicines: [
      rxTemplateMedicine('Metformin', '500 mg', 'Tablet', '1 Tablet', 'Twice Daily', 'Oral', '30 Days', 'After Food')
    ],
    advice: ['Monitor fasting and post-meal blood sugar.', 'Diabetic Diet', 'Avoid sweets and sugary drinks.'],
    followUpAfterDays: 30,
    followUpReason: 'Test Results',
    followUpNotes: 'Review blood sugar readings and test reports.'
  },
  {
    id: 'back-pain',
    name: 'Back Pain',
    description: 'Pain relief, rest advice, and physiotherapy-oriented follow-up.',
    medicines: [
      rxTemplateMedicine('Paracetamol', '650 mg', 'Tablet', '1 Tablet', 'Twice Daily', 'Oral', '5 Days', 'After Food'),
      rxTemplateMedicine('Pantoprazole', '40 mg', 'Tablet', '1 Tablet', 'Before Breakfast', 'Oral', '5 Days', 'Before Food')
    ],
    advice: ['Avoid heavy lifting.', 'Apply local hot fomentation.', 'Take adequate rest.'],
    followUpAfterDays: 7,
    followUpReason: 'Review',
    followUpNotes: 'Review pain score and mobility.'
  },
  {
    id: 'gastritis',
    name: 'Gastritis',
    description: 'Acidity and gastritis care with diet and review instructions.',
    medicines: [
      rxTemplateMedicine('Pantoprazole', '40 mg', 'Tablet', '1 Tablet', 'Before Breakfast', 'Oral', '7 Days', 'Before Food'),
      rxTemplateMedicine('Antacid Gel', '', 'Syrup', '2 tsp', 'As Needed', 'Oral', '5 Days', 'After meals if acidity')
    ],
    advice: ['Avoid spicy and oily food.', 'Do not skip meals.', 'Drink sufficient water.'],
    followUpAfterDays: 7,
    followUpReason: 'Review',
    followUpNotes: 'Review acidity, pain, and appetite.'
  }
];

function emptyPrescriptionTemplateDraft(): PrescriptionTemplateDraft {
  return { name: '', description: '' };
}

function loadPrescriptionTemplates(): PrescriptionTemplate[] {
  const customTemplates = readCustomPrescriptionTemplates();
  return [...DEFAULT_PRESCRIPTION_TEMPLATES, ...customTemplates];
}

function readCustomPrescriptionTemplates(): PrescriptionTemplate[] {
  try {
    const rawTemplates = typeof localStorage === 'undefined' ? null : localStorage.getItem(PRESCRIPTION_TEMPLATE_STORAGE_KEY);
    if (!rawTemplates) {
      return [];
    }

    const parsed = JSON.parse(rawTemplates) as PrescriptionTemplate[];
    return Array.isArray(parsed) ? parsed.filter(isPrescriptionTemplate) : [];
  } catch {
    return [];
  }
}

function persistPrescriptionTemplates(templates: PrescriptionTemplate[]): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(
      PRESCRIPTION_TEMPLATE_STORAGE_KEY,
      JSON.stringify(templates.filter(template => template.id.startsWith('custom-')))
    );
  } catch {
    // Local template persistence is a convenience layer; failures should not block OPD work.
  }
}

function isPrescriptionTemplate(value: PrescriptionTemplate): value is PrescriptionTemplate {
  return Boolean(
    value &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.medicines) &&
    Array.isArray(value.advice)
  );
}

function rxTemplateMedicine(
  medicine: string,
  strength: string,
  dosageForm: string,
  dosage: string,
  frequency: string,
  route: string,
  duration: string,
  instructions: string
): OpdPrescriptionItemForm {
  return {
    medicineId: null,
    medicine,
    strength,
    dosageForm,
    dosage,
    route,
    frequency,
    duration,
    quantity: '',
    instructions
  };
}

function mergePrescriptionItems(current: OpdPrescriptionItemForm[], incoming: OpdPrescriptionItemForm[]): OpdPrescriptionItemForm[] {
  const seen = new Set(current.map(prescriptionItemKey));
  const additions = incoming
    .filter(item => {
      const key = prescriptionItemKey(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map(item => ({ ...item }));
  return [...current, ...additions];
}

function prescriptionItemKey(item: OpdPrescriptionItemForm): string {
  return normalizeSearchText([item.medicine, item.strength, item.dosageForm, item.frequency, item.duration, item.instructions].join('|'));
}

function emptyEncounterForm(): OpdEncounterForm {
  return {
    consultationId: '',
    patientId: '',
    doctorId: '',
    appointmentId: null,
    notes: '',
    statusCode: 'IN_PROGRESS'
  };
}

function emptyClinicalForm(notes = ''): OpdClinicalForm {
  return {
    vitals: {
      temperature: '',
      bloodPressure: '',
      pulseRate: '',
      respiratoryRate: '',
      spo2: '',
      height: '',
      weight: ''
    },
    includeVitalsInPrescription: true,
    complaints: [],
    complaintDraft: emptyComplaintForm(),
    history: {
      presentIllness: '',
      pastHistory: '',
      familyHistory: '',
      surgicalHistory: ''
    },
    examination: {
      generalExamination: '',
      systemExamination: '',
      observations: ''
    },
    diagnoses: [],
    diagnosisDraft: emptyDiagnosisForm(),
    prescriptions: [],
    prescriptionDraft: emptyPrescriptionItemForm(),
    prescriptionId: '',
    prescriptionNo: '',
    includeInvestigationsInPrescription: true,
    investigationDraft: '',
    prescriptionInvestigations: [],
    adviceDraft: '',
    adviceList: [],
    dietAdviceDraft: '',
    dietAdviceList: [],
    labOrders: [],
    labOrderDraft: emptyLabOrderForm(),
    procedures: [],
    procedureDraft: emptyProcedureForm(),
    clinicalNotes: notes,
    followUp: {
      followUpRequired: false,
      followUpAfterDays: '',
      followUpDate: '',
      preferredDoctorId: '',
      reason: 'Review',
      notes: '',
      createAppointment: false
    },
    invoiceId: '',
    admissionId: ''
  };
}

function emptyComplaintForm(): OpdComplaintForm {
  return { complaint: '', duration: '', severity: 'Moderate', notes: '' };
}

function emptyDiagnosisForm(): OpdDiagnosisForm {
  return { diagnosisCode: '', diagnosisName: '', diagnosisType: 'PRIMARY', notes: '' };
}

function emptyPrescriptionItemForm(): OpdPrescriptionItemForm {
  return { medicine: '', strength: '', dosageForm: 'Tablet', dosage: '', route: 'Oral', frequency: '', duration: '', quantity: '', instructions: '' };
}

function emptyLabOrderForm() {
  return { testCategory: '', testId: '', priority: 'Routine', notes: '' };
}

function emptyProcedureForm(): OpdProcedureForm {
  return { procedure: '', notes: '', charge: '' };
}

function composeClinicalNotes(form: OpdClinicalForm, labTests: OpdLabTestRecord[]): string {
  const sections = [
    ['Vitals', [
      `Temperature: ${form.vitals.temperature || '-'}`,
      `Blood Pressure: ${form.vitals.bloodPressure || '-'}`,
      `Pulse Rate: ${form.vitals.pulseRate || '-'}`,
      `Respiratory Rate: ${form.vitals.respiratoryRate || '-'}`,
      `SpO2: ${form.vitals.spo2 || '-'}`,
      `Height: ${form.vitals.height || '-'}`,
      `Weight: ${form.vitals.weight || '-'}`,
      `BMI: ${calculateBmi(form.vitals.height, form.vitals.weight) || '-'}`
    ]],
    ['Chief Complaints', form.complaints.map(formatComplaint)],
    ['Clinical History', [
      `Present Illness: ${form.history.presentIllness || '-'}`,
      `Past History: ${form.history.pastHistory || '-'}`,
      `Family History: ${form.history.familyHistory || '-'}`,
      `Surgical History: ${form.history.surgicalHistory || '-'}`
    ]],
    ['Examination', [
      `General Examination: ${form.examination.generalExamination || '-'}`,
      `System Examination: ${form.examination.systemExamination || '-'}`,
      `Observations: ${form.examination.observations || '-'}`
    ]],
    ['Diagnosis', form.diagnoses.map(item => [item.diagnosisType, item.diagnosisCode, item.diagnosisName, item.notes].filter(Boolean).join(' | '))],
    ['Prescription', form.prescriptions.map(formatPrescriptionMedicine)],
    ['Prescription Investigations', buildPrescriptionInvestigationLines(form, labTests)],
    ['Lab Orders', form.labOrders.map(item => {
      const test = labTests.find(testItem => testItem.id === item.testId);
      return [item.testCategory, test?.name ?? 'Selected test', item.priority, item.notes].filter(Boolean).join(' | ');
    })],
    ['Procedures', form.procedures.map(item => [item.procedure, item.charge ? formatCurrency(toAmount(item.charge)) : '', item.notes].filter(Boolean).join(' | '))],
    ['Advice', form.adviceList],
    ['Diet Advice', form.dietAdviceList],
    ['Follow-up', [
      `Required: ${form.followUp.followUpRequired ? 'Yes' : 'No'}`,
      `After: ${form.followUp.followUpAfterDays || '-'}`,
      `Date: ${form.followUp.followUpDate || '-'}`,
      `Reason: ${form.followUp.reason || '-'}`,
      `Notes: ${form.followUp.notes || '-'}`
    ]],
    ['Clinical Notes', [form.clinicalNotes || '-']]
  ];

  return sections
    .map(([title, lines]) => `## ${title}\n${(lines as string[]).filter(Boolean).map(line => `- ${line}`).join('\n') || '- -'}`)
    .join('\n\n');
}

function formatComplaint(complaint: OpdComplaintForm): string {
  return [complaint.complaint, complaint.duration, complaint.severity, complaint.notes].filter(Boolean).join(' | ');
}

function formatPrescriptionMedicine(item: OpdPrescriptionItemForm): string {
  return [
    item.medicine,
    item.strength,
    item.dosageForm,
    item.dosage,
    item.quantity ? `Qty: ${item.quantity}` : '',
    item.frequency,
    item.route,
    item.duration,
    item.instructions
  ].filter(Boolean).join(' | ');
}

function formatPrescriptionMedicineName(item: OpdPrescriptionItemForm): string {
  return [item.medicine, item.strength].filter(Boolean).join(' ');
}

function formatPrescriptionMedicineInstruction(item: OpdPrescriptionItemForm): string {
  return [
    item.dosage || item.dosageForm,
    item.frequency,
    item.instructions,
    item.duration
  ].filter(Boolean).join(' - ') || '-';
}

function buildSymptomSummary(form: OpdClinicalForm): string {
  return form.complaints.map(item => item.complaint).filter(Boolean).join(', ') || '-';
}

function buildDiagnosisSummary(form: OpdClinicalForm): string {
  return form.diagnoses.map(item => item.diagnosisName).filter(Boolean).join(', ') || '-';
}

function buildVitalSummary(form: OpdClinicalForm): string {
  const lines = buildPrescriptionVitals(form)
    .filter(item => item.value !== '-')
    .map(item => `${item.label}: ${item.value}`);
  return lines.join(', ') || '-';
}

function buildPrescriptionInvestigationLines(form: OpdClinicalForm, labTests: OpdLabTestRecord[]): string[] {
  if (!form.includeInvestigationsInPrescription) {
    return [];
  }

  const labOrderLines = form.labOrders.map(item => {
    const test = labTests.find(testItem => testItem.id === item.testId);
    return [test?.name ?? '', item.testCategory, item.priority, item.notes].filter(Boolean).join(' | ');
  });

  return uniqueStrings([...form.prescriptionInvestigations, ...labOrderLines].filter(Boolean));
}

function formatProcedureLine(item: OpdProcedureForm): string {
  return [item.procedure, item.charge ? formatCurrency(toAmount(item.charge)) : '', item.notes].filter(Boolean).join(' | ');
}

function buildPrescriptionFollowUpLines(form: OpdClinicalForm): string[] {
  if (!form.followUp.followUpRequired && !form.followUp.followUpDate && !form.followUp.followUpAfterDays) {
    return [];
  }

  return [
    form.followUp.followUpAfterDays ? `Follow-up after ${form.followUp.followUpAfterDays} days` : '',
    form.followUp.followUpDate ? `Next visit date: ${form.followUp.followUpDate}` : '',
    form.followUp.reason ? `Reason: ${form.followUp.reason}` : '',
    form.followUp.notes ? `Notes: ${form.followUp.notes}` : ''
  ].filter(Boolean);
}

function hasPrescriptionContent(form: OpdClinicalForm, labTests: OpdLabTestRecord[]): boolean {
  return [
    form.prescriptions.length > 0,
    buildPrescriptionInvestigationLines(form, labTests).length > 0,
    form.procedures.length > 0,
    form.adviceList.length > 0,
    form.dietAdviceList.length > 0,
    buildPrescriptionFollowUpLines(form).length > 0
  ].some(Boolean);
}

interface PrescriptionContext {
  hospitalName: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  appointmentId: string;
  appointmentNo: string;
  opdEncounterId: string;
  opdEncounterNo: string;
  clinicalRecordNo: string;
  prescriptionNo: string;
  statusLabel: string;
  revisionNo: number;
  doctorName: string;
  generatedAt: string;
}

function buildPrescriptionInstructions(form: OpdClinicalForm, labTests: OpdLabTestRecord[], context?: PrescriptionContext, vitals: PrescriptionVital[] = []): string {
  const medicineLines = form.prescriptions.map(formatPrescriptionMedicine);
  const investigations = buildPrescriptionInvestigationLines(form, labTests);
  const procedures = form.procedures.map(formatProcedureLine);
  const followUpLines = buildPrescriptionFollowUpLines(form);
  if (!context) {
    return medicineLines.join('\n');
  }

  return [
    '## Prescription Context',
    `- Hospital: ${context.hospitalName}`,
    `- Patient: ${context.patientName}`,
    `- MRN: ${context.patientMrn}`,
    `- Patient ID: ${context.patientId}`,
    `- Appointment: ${context.appointmentNo}`,
    `- Appointment ID: ${context.appointmentId}`,
    `- OPD Encounter: ${context.opdEncounterNo}`,
    `- OPD Encounter ID: ${context.opdEncounterId}`,
    `- Clinical Record: ${context.clinicalRecordNo}`,
    `- Prescription No: ${context.prescriptionNo}`,
    `- Status: ${context.statusLabel}`,
    `- Revision: ${context.revisionNo}`,
    `- Doctor: ${context.doctorName}`,
    `- Generated At: ${context.generatedAt}`,
    '',
    ...(vitals.length ? [
      '## Vitals',
      ...vitals.map(vital => `- ${vital.label}: ${vital.value}`),
      ''
    ] : []),
    '## Medicines',
    ...medicineLines.map(line => `- ${line}`),
    '',
    ...(investigations.length ? ['## Investigations', ...investigations.map(line => `- ${line}`), ''] : []),
    ...(procedures.length ? ['## Procedures', ...procedures.map(line => `- ${line}`), ''] : []),
    ...(form.adviceList.length ? ['## Advice', ...form.adviceList.map(line => `- ${line}`), ''] : []),
    ...(form.dietAdviceList.length ? ['## Diet Advice', ...form.dietAdviceList.map(line => `- ${line}`), ''] : []),
    ...(followUpLines.length ? ['## Follow-up', ...followUpLines.map(line => `- ${line}`)] : [])
  ].join('\n');
}

function buildPrescriptionPreview(visit: OpdVisitVm, form: OpdClinicalForm, labTests: OpdLabTestRecord[], statusLabel: string, revisionNo: number): PrescriptionPreview {
  const consultation = visit.consultation;
  const prescriptionNo = form.prescriptionNo || buildPrescriptionNo(visit, consultation);
  const opdEncounterNo = derivedOpdEncounterNo(consultation?.id);
  return {
    hospitalName: visit.branchName,
    patientId: visit.appointment.patientId,
    patientName: visit.patientName,
    patientMrn: visit.patientMrn,
    ageGender: [visit.patient?.age ? `${visit.patient.age} yrs` : '', visit.patient?.genderName || ''].filter(Boolean).join(' / ') || '-',
    doctorName: visit.doctorName,
    doctorQualification: [visit.doctor?.qualification, visit.doctor?.primarySpecialization].filter(Boolean).join(', ') || '-',
    doctorRegistrationNo: visit.doctor?.registrationNo || '-',
    departmentName: visit.departmentName,
    branchName: visit.branchName,
    appointmentId: visit.appointment.id,
    appointmentNo: visit.appointmentNo,
    opdEncounterId: consultation?.id ?? '',
    opdEncounterNo,
    clinicalRecordNo: opdEncounterNo,
    prescriptionId: form.prescriptionId,
    prescriptionNo,
    statusLabel,
    revisionNo,
    generatedAt: formatDisplayDateTime(new Date()),
    includeVitals: form.includeVitalsInPrescription,
    vitals: form.includeVitalsInPrescription ? buildPrescriptionVitals(form) : [],
    diagnoses: form.diagnoses,
    medicines: form.prescriptions,
    investigations: buildPrescriptionInvestigationLines(form, labTests),
    procedures: form.procedures.map(formatProcedureLine),
    advice: form.adviceList,
    dietAdvice: form.dietAdviceList,
    followUp: buildPrescriptionFollowUpLines(form),
    symptomSummary: buildSymptomSummary(form),
    diagnosisSummary: buildDiagnosisSummary(form),
    vitalSummary: form.includeVitalsInPrescription ? buildVitalSummary(form) : 'Not included',
    followUpSummary: buildPrescriptionFollowUpLines(form).join(' | ') || 'No follow-up recorded',
    notes: form.clinicalNotes || form.followUp.notes
  };
}

function buildPrescriptionVitals(form: OpdClinicalForm): PrescriptionVital[] {
  return [
    { label: 'Blood Pressure', value: form.vitals.bloodPressure || '-' },
    { label: 'Pulse Rate', value: form.vitals.pulseRate || '-' },
    { label: 'Temperature', value: form.vitals.temperature || '-' },
    { label: 'SpO2', value: form.vitals.spo2 || '-' },
    { label: 'Weight', value: form.vitals.weight || '-' },
    { label: 'Height', value: form.vitals.height || '-' },
    { label: 'BMI', value: calculateBmi(form.vitals.height, form.vitals.weight) || '-' }
  ];
}

function buildPrescriptionHeader(
  visit: OpdVisitVm,
  form: OpdClinicalForm,
  hospitalName: string,
  branch: BranchContextOption | null
): PrescriptionHeaderVm {
  const consultation = visit.consultation;
  const prescriptionNo = form.prescriptionNo || buildPrescriptionNo(visit, consultation);
  return {
    patientName: visit.patientName,
    patientMrn: visit.patientMrn,
    age: visit.patient?.age != null ? `${visit.patient.age} yrs` : '-',
    gender: visit.patient?.genderName || '-',
    bloodGroup: visit.patient?.bloodGroupName || '-',
    mobileNo: visit.patient?.mobileNo || '-',
    patientAddress: formatPatientAddress(visit.patient),
    doctorName: visit.doctorName,
    specialization: visit.doctor?.primarySpecialization || '-',
    registrationNo: visit.doctor?.registrationNo || '-',
    departmentName: visit.departmentName,
    hospitalName: hospitalName || visit.branchName || 'Auspira Care360',
    hospitalAddress: formatHospitalAddress(branch),
    hospitalContact: formatHospitalContact(branch),
    prescriptionNo,
    prescriptionDateTime: formatDisplayDateTime(new Date()),
    appointmentNo: visit.appointmentNo,
    opdEncounterNo: derivedOpdEncounterNo(consultation?.id),
    visitType: appointmentTypeLabel(visit.appointment.appointmentType)
  };
}

function buildPrescriptionContext(visit: OpdVisitVm, consultation: OpdConsultationRecord, prescriptionNo: string, statusLabel: string, revisionNo: number): PrescriptionContext {
  const opdEncounterNo = derivedOpdEncounterNo(consultation.id);
  return {
    hospitalName: visit.branchName,
    patientId: consultation.patientId || visit.appointment.patientId,
    patientName: visit.patientName,
    patientMrn: visit.patientMrn,
    appointmentId: consultation.appointmentId || visit.appointment.id,
    appointmentNo: visit.appointmentNo,
    opdEncounterId: consultation.id,
    opdEncounterNo,
    clinicalRecordNo: opdEncounterNo,
    prescriptionNo,
    statusLabel,
    revisionNo,
    doctorName: visit.doctorName,
    generatedAt: formatDisplayDateTime(new Date())
  };
}

function formatPatientAddress(patient: PatientSummary | null): string {
  if (!patient) {
    return '-';
  }

  return [
    patient.address,
    patient.city,
    patient.state,
    patient.country,
    patient.pincode
  ].filter(Boolean).join(', ') || '-';
}

function formatHospitalAddress(branch: BranchContextOption | null): string {
  if (!branch) {
    return '-';
  }

  return [
    branch.branchName,
    branch.cityName,
    branch.stateName,
    branch.countryCode
  ].filter(Boolean).join(', ') || '-';
}

function formatHospitalContact(branch: BranchContextOption | null): string {
  if (!branch) {
    return '-';
  }

  return [branch.primaryPhone, branch.email].filter(Boolean).join(' · ') || '-';
}

function appointmentTypeLabel(value: string | null | undefined): string {
  const normalized = String(value || '').toUpperCase();
  return appointmentTypeOptions.find(option => option.value === normalized)?.label ?? humanizeCode(normalized || 'OPD');
}

function prescriptionPlainText(prescription: PrescriptionPreview): string {
  const diagnosis = prescription.diagnoses.length
    ? prescription.diagnoses.map(item => `- ${item.diagnosisName} (${item.diagnosisType}${item.diagnosisCode ? `, ${item.diagnosisCode}` : ''})`).join('\n')
    : '- No diagnosis captured';
  const medicines = prescription.medicines.map((item, index) =>
    `${index + 1}. ${formatPrescriptionMedicine(item)}`
  ).join('\n');
  const vitals = prescription.includeVitals && prescription.vitals.length
    ? prescription.vitals.map(item => `- ${item.label}: ${item.value}`).join('\n')
    : '';
  const investigations = prescription.investigations.map(item => `- ${item}`).join('\n');
  const procedures = prescription.procedures.map(item => `- ${item}`).join('\n');
  const advice = prescription.advice.map(item => `- ${item}`).join('\n');
  const dietAdvice = prescription.dietAdvice.map(item => `- ${item}`).join('\n');
  const followUp = prescription.followUp.map(item => `- ${item}`).join('\n');

  return [
    'Care360 Prescription',
    `Prescription No: ${prescription.prescriptionNo}`,
    `Hospital: ${prescription.hospitalName}`,
    `Patient: ${prescription.patientName} (${prescription.patientMrn})`,
    `Patient ID: ${prescription.patientId}`,
    `Appointment: ${prescription.appointmentNo}`,
    `OPD Encounter: ${prescription.opdEncounterNo}`,
    `Clinical Record: ${prescription.clinicalRecordNo}`,
    `Status: ${prescription.statusLabel}`,
    `Revision: ${prescription.revisionNo}`,
    `Doctor: ${prescription.doctorName}`,
    `Generated: ${prescription.generatedAt}`,
    '',
    ...(vitals ? ['Vitals:', vitals, ''] : []),
    'Diagnosis:',
    diagnosis,
    '',
    'Medicines:',
    medicines || '- No medicines captured',
    '',
    ...(investigations ? ['Investigations:', investigations, ''] : []),
    ...(procedures ? ['Procedures:', procedures, ''] : []),
    'Advice:',
    advice || `- ${prescription.notes || 'Follow medical advice and return if symptoms worsen.'}`,
    '',
    ...(dietAdvice ? ['Diet Advice:', dietAdvice, ''] : []),
    ...(followUp ? ['Follow-up:', followUp] : [])
  ].join('\n');
}

function openPrescriptionDocument(prescription: PrescriptionPreview, autoPrint: boolean, options: PrescriptionPrintOptions = defaultPrescriptionPrintOptions()): boolean {
  const popup = window.open('', '_blank', 'width=980,height=800');
  if (!popup) {
    return false;
  }

  popup.document.open();
  popup.document.write(printablePrescriptionHtml(prescription, autoPrint, options));
  popup.document.close();
  popup.focus();
  return true;
}

function printablePrescriptionHtml(prescription: PrescriptionPreview, autoPrint: boolean, options: PrescriptionPrintOptions): string {
  const medicineRows = prescription.medicines.map(item => `
    <li>
      <strong>${escapeHtml(formatPrescriptionMedicineName(item))}</strong>
      <span>${escapeHtml(formatPrescriptionMedicineInstruction(item))}</span>
    </li>
  `).join('') || '<li><strong>No medicines captured.</strong></li>';
  const investigationRows = prescription.investigations.length ? printableList(prescription.investigations) : '';
  const procedureRows = prescription.procedures.length ? printableList(prescription.procedures) : '';
  const adviceRows = printableList(prescription.advice.length ? prescription.advice : [prescription.notes || 'Follow medical advice and return if symptoms worsen.']);
  const dietAdviceRows = prescription.dietAdvice.length ? printableList(prescription.dietAdvice) : '';
  const followUpRows = prescription.followUp.length ? `<p>${escapeHtml(prescription.followUpSummary)}</p>` : '';
  const formatClass = `format-${options.format.toLowerCase()}`;
  const showHeader = options.includeHospitalHeader;
  const showSignature = options.includeDoctorSignature;
  const showQr = options.includeQrCode;
  const showVitals = options.includeVitals && prescription.includeVitals;
  const showDiagnosis = options.includeDiagnosis;
  const showAdvice = options.includeAdvice;
  const showFollowUp = options.includeFollowUp;

  return `<!doctype html>
<html>
<head>
  <title>Prescription - ${escapeHtml(prescription.patientName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; color: #0f172a; font-family: Arial, sans-serif; background: #f8fafc; }
    .paper { max-width: 860px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; background: white; overflow: hidden; }
    .paper.format-a5 { max-width: 620px; font-size: 13px; }
    .paper.format-thermal { max-width: 360px; font-size: 12px; }
    h1, h2, h3, p { margin: 0; }
    .sheet-head { display: grid; grid-template-columns: 74px 1fr auto; gap: 14px; align-items: center; padding: 24px 28px; border-bottom: 1px solid #dbe4f0; text-align: center; }
    .logo { width: 62px; height: 62px; display: grid; place-items: center; border: 1px solid #bfdbfe; border-radius: 16px; background: #eff6ff; color: #2563eb; font-size: 30px; font-weight: 900; }
    .label { color: #64748b; font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .sheet-head h1 { font-size: 27px; }
    .sheet-head span, .sheet-head small, .muted { color: #64748b; font-weight: 700; }
    .sheet-head aside { display: grid; gap: 4px; justify-items: end; text-align: right; }
    .sheet-head aside strong { color: #2563eb; font-size: 14px; }
    .doctor { padding: 18px 28px; border-bottom: 1px solid #dbe4f0; text-align: center; }
    .doctor h2 { font-size: 22px; }
    .doctor p { margin-top: 6px; font-weight: 700; }
    .patient { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 32px; padding: 18px 28px; border-bottom: 1px solid #dbe4f0; }
    .patient div { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 5px; border-bottom: 1px dashed #cbd5e1; }
    .patient small { color: #64748b; font-weight: 800; }
    .patient strong { text-align: right; }
    .patient p { grid-column: 1 / -1; margin-top: 2px; font-weight: 700; line-height: 1.45; }
    .patient p strong { color: #64748b; }
    .rx { min-height: 230px; padding: 22px 28px; border-bottom: 1px solid #dbe4f0; }
    .rx h3 { margin-bottom: 14px; font-family: Georgia, serif; font-size: 34px; font-style: italic; }
    .rx ol { display: grid; gap: 16px; margin: 0; padding-left: 24px; }
    .rx li strong { display: block; font-size: 16px; }
    .rx li span { display: block; margin-top: 4px; color: #64748b; font-weight: 700; }
    .extras { display: grid; grid-template-columns: repeat(2, 1fr); border-bottom: 1px solid #dbe4f0; }
    .extras section { padding: 18px 28px; border-right: 1px solid #dbe4f0; border-bottom: 1px solid #dbe4f0; }
    .extras section:nth-child(even), .extras section:last-child { border-right: 0; }
    .extras .wide { grid-column: 1 / -1; border-right: 0; }
    .extras h3 { margin-bottom: 8px; font-size: 16px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 5px; font-weight: 700; }
    .foot { display: grid; grid-template-columns: auto 1fr minmax(190px, auto); gap: 14px; align-items: end; padding: 18px 28px; border-bottom: 1px solid #dbe4f0; }
    .qr { width: 74px; height: 74px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 6px; border: 1px solid #cbd5e1; }
    .qr span { background: #0f172a; }
    .signature { display: grid; gap: 8px; justify-items: end; text-align: right; }
    .signature::before { content: ''; width: 180px; border-top: 1px solid #475569; }
    .disclaimer { padding: 12px 28px 16px; color: #64748b; font-size: 11.5px; line-height: 1.5; }
    .foot.no-qr { grid-template-columns: 1fr; }
    .foot.no-signature { grid-template-columns: auto 1fr; }
    .paper.format-a5 .sheet-head,
    .paper.format-a5 .doctor,
    .paper.format-a5 .patient,
    .paper.format-a5 .rx,
    .paper.format-a5 .extras section,
    .paper.format-a5 .foot { padding-left: 18px; padding-right: 18px; }
    .paper.format-a5 .sheet-head { grid-template-columns: 58px 1fr; text-align: left; }
    .paper.format-a5 .sheet-head aside { grid-column: 1 / -1; justify-items: start; text-align: left; }
    .paper.format-a5 .logo { width: 52px; height: 52px; font-size: 26px; }
    .paper.format-a5 .sheet-head h1 { font-size: 23px; }
    .paper.format-a5 .patient, .paper.format-a5 .extras, .paper.format-a5 .foot { grid-template-columns: 1fr; }
    .paper.format-a5 .extras section { border-right: 0; }
    .paper.format-thermal .sheet-head,
    .paper.format-thermal .doctor,
    .paper.format-thermal .patient,
    .paper.format-thermal .rx,
    .paper.format-thermal .extras section,
    .paper.format-thermal .foot,
    .paper.format-thermal .disclaimer { padding-left: 14px; padding-right: 14px; }
    .paper.format-thermal .sheet-head { grid-template-columns: 1fr; justify-items: start; text-align: left; }
    .paper.format-thermal .sheet-head aside { justify-items: start; text-align: left; }
    .paper.format-thermal .logo { width: 48px; height: 48px; font-size: 24px; }
    .paper.format-thermal .sheet-head h1 { font-size: 20px; }
    .paper.format-thermal .doctor { text-align: left; }
    .paper.format-thermal .doctor h2 { font-size: 18px; }
    .paper.format-thermal .patient,
    .paper.format-thermal .extras,
    .paper.format-thermal .foot { grid-template-columns: 1fr; }
    .paper.format-thermal .patient div { display: grid; gap: 3px; }
    .paper.format-thermal .patient strong { text-align: left; }
    .paper.format-thermal .rx { min-height: 120px; }
    .paper.format-thermal .rx h3 { font-size: 26px; }
    .paper.format-thermal .extras section { border-right: 0; }
    .paper.format-thermal .signature { justify-items: start; text-align: left; }
    .paper.format-thermal .signature::before { width: 140px; }
    @media print { body { padding: 0; background: white; } .paper { border-radius: 0; border-color: #94a3b8; } }
  </style>
</head>
<body>
  <main class="paper ${formatClass}">
    ${showHeader ? `<header class="sheet-head">
      <div class="logo">+</div>
      <div>
        <p class="label">Hospital Logo</p>
        <h1>${escapeHtml(prescription.hospitalName)}</h1>
        <span>${escapeHtml(prescription.branchName)}</span>
      </div>
      <aside>
        <strong>${escapeHtml(prescription.prescriptionNo)}</strong>
        <small>${escapeHtml(prescription.statusLabel)} · Revision ${prescription.revisionNo}</small>
      </aside>
    </header>` : ''}
    <section class="doctor">
      <h2>${escapeHtml(prescription.doctorName)}</h2>
      <p>${escapeHtml(prescription.doctorQualification)} | Registration No. ${escapeHtml(prescription.doctorRegistrationNo)}</p>
      <span class="muted">${escapeHtml(prescription.departmentName)}</span>
    </section>
    <section class="patient">
      <div><small>Patient</small><strong>${escapeHtml(prescription.patientName)}</strong></div>
      <div><small>Date</small><strong>${escapeHtml(prescription.generatedAt)}</strong></div>
      <div><small>Age / Gender</small><strong>${escapeHtml(prescription.ageGender)}</strong></div>
      <div><small>MRN</small><strong>${escapeHtml(prescription.patientMrn)}</strong></div>
      ${showVitals ? `<p><strong>Vitals:</strong> ${escapeHtml(prescription.vitalSummary)}</p>` : ''}
      <p><strong>Symptoms:</strong> ${escapeHtml(prescription.symptomSummary)}</p>
      ${showDiagnosis ? `<p><strong>Diagnosis:</strong> ${escapeHtml(prescription.diagnosisSummary)}</p>` : ''}
    </section>
    <section class="rx">
      <h3>Rx</h3>
      <ol>${medicineRows}</ol>
    </section>
    <div class="extras">
      ${investigationRows ? `<section><h3>Investigations</h3><ul>${investigationRows}</ul></section>` : ''}
      ${procedureRows ? `<section><h3>Procedures</h3><ul>${procedureRows}</ul></section>` : ''}
      ${showAdvice ? `<section><h3>Advice</h3><ul>${adviceRows}</ul></section>` : ''}
      ${dietAdviceRows ? `<section><h3>Diet Advice</h3><ul>${dietAdviceRows}</ul></section>` : ''}
      ${showFollowUp && followUpRows ? `<section class="wide"><h3>Follow-up</h3>${followUpRows}</section>` : ''}
    </div>
    ${(showQr || showSignature) ? `<footer class="foot ${!showQr ? 'no-qr' : ''} ${!showSignature ? 'no-signature' : ''}">
      ${showQr ? `<div class="qr"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
      <div>
        <strong>Scan to access digital prescription</strong>
        <small class="muted">${escapeHtml(prescription.opdEncounterNo)} · ${escapeHtml(prescription.appointmentNo)}</small>
      </div>` : ''}
      ${showSignature ? `<div class="signature">
        <strong>Doctor Signature</strong>
        <span class="muted">${escapeHtml(prescription.doctorName)}</span>
      </div>` : ''}
    </footer>` : ''}
    <p class="disclaimer">Disclaimer: This prescription is generated from the Care360 OPD encounter and should be used only under the advice of the issuing doctor.</p>
  </main>
  ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 150));</script>' : ''}
</body>
</html>`;
}

function printableList(items: string[]): string {
  return items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface MedicineSuggestion {
  key: string;
  id: string | null;
  label: string;
  name: string;
  strength: string;
  form: string;
}

const fallbackMedicineSuggestions: MedicineSuggestion[] = [
  { key: 'fallback-paracetamol-500-tablet', id: null, label: 'Paracetamol 500mg Tablet', name: 'Paracetamol', strength: '500 mg', form: 'Tablet' },
  { key: 'fallback-paracetamol-650-tablet', id: null, label: 'Paracetamol 650mg Tablet', name: 'Paracetamol', strength: '650 mg', form: 'Tablet' },
  { key: 'fallback-paracetamol-syrup', id: null, label: 'Paracetamol Syrup', name: 'Paracetamol', strength: '', form: 'Syrup' },
  { key: 'fallback-paracetamol-injection', id: null, label: 'Paracetamol Injection', name: 'Paracetamol', strength: '', form: 'Injection' },
  { key: 'fallback-amoxicillin-500-capsule', id: null, label: 'Amoxicillin 500mg Capsule', name: 'Amoxicillin', strength: '500 mg', form: 'Capsule' },
  { key: 'fallback-azithromycin-500-tablet', id: null, label: 'Azithromycin 500mg Tablet', name: 'Azithromycin', strength: '500 mg', form: 'Tablet' }
];

function findMedicineSuggestions(query: string, medicines: OpdMedicineRecord[]): MedicineSuggestion[] {
  const normalized = normalizeSearchText(query);
  if (normalized.length < 2) {
    return [];
  }

  const catalog = medicines.map(toMedicineSuggestion);
  const merged = dedupeMedicineSuggestions([...catalog, ...fallbackMedicineSuggestions]);
  return merged
    .filter(item => normalizeSearchText([item.label, item.name, item.strength, item.form].join(' ')).includes(normalized))
    .slice(0, 8);
}

function toMedicineSuggestion(record: OpdMedicineRecord): MedicineSuggestion {
  const label = [record.name, record.unit].filter(Boolean).join(' ').trim() || record.name;
  const parsed = parseMedicineLabel(label);
  return {
    key: record.id,
    id: record.id,
    label,
    name: parsed.name || record.name,
    strength: parsed.strength,
    form: parsed.form || record.unit || ''
  };
}

function dedupeMedicineSuggestions(items: MedicineSuggestion[]): MedicineSuggestion[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = normalizeSearchText(`${item.name}|${item.strength}|${item.form}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function parseMedicineLabel(label: string): { name: string; strength: string; form: string } {
  const strengthMatch = label.match(/\b(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu|%))\b/i);
  const strength = strengthMatch ? normalizeStrength(strengthMatch[1]) : '';
  const form = medicineForms.find(item => new RegExp(`\\b${escapeRegex(item)}\\b`, 'i').test(label)) ?? '';
  let name = label;
  if (strengthMatch) {
    name = name.replace(strengthMatch[0], '');
  }
  if (form) {
    name = name.replace(new RegExp(`\\b${escapeRegex(form)}\\b`, 'i'), '');
  }
  name = name.replace(/\s{2,}/g, ' ').trim();
  return { name: name || label, strength, form };
}

const medicineForms = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Suspension',
  'Drops',
  'Cream',
  'Ointment',
  'Gel',
  'Inhaler',
  'Nebulizer',
  'Patch',
  'Powder'
];

function normalizeStrength(value: string): string {
  return value.replace(/(\d)([a-zA-Z%])/, '$1 $2').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const normalized = normalizeSearchText(item);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function toEncounterForm(visit: OpdVisitVm, statusCode: 'IN_PROGRESS' | 'COMPLETED'): OpdEncounterForm {
  return {
    consultationId: visit.consultation?.id ?? '',
    patientId: visit.appointment.patientId,
    doctorId: visit.appointment.doctorId,
    appointmentId: visit.appointment.id,
    notes: visit.consultation?.notes ?? '',
    statusCode: visit.consultation?.statusCode === 'COMPLETED' ? 'COMPLETED' : statusCode
  };
}

function createCheckInForm(visit: OpdVisitVm, queues: AppointmentQueueRecord[], appointments: AppointmentRecord[]): AppointmentCheckInForm {
  const queueNo = nextQueueNoForDoctor(visit, queues, appointments);
  return {
    queueId: '',
    appointmentId: visit.appointment.id,
    arrivalDate: todayInputValue(),
    arrivalTime: timeInputValue(new Date()),
    tokenNumber: `TKN-${queueNo.toString().padStart(3, '0')}`,
    queueNo,
    priorityCode: 'NORMAL',
    notes: 'Checked in from OPD workspace'
  };
}

function nextQueueNoForDoctor(visit: OpdVisitVm, queues: AppointmentQueueRecord[], appointments: AppointmentRecord[]): number {
  const appointmentMap = new Map(appointments.map(item => [item.id, item]));
  const numbers = queues
    .filter(queue => isToday(queue.arrivedAt))
    .filter(queue => !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'NOSHOW'].includes(String(queue.statusCode).toUpperCase()))
    .filter(queue => appointmentMap.get(queue.appointmentId)?.doctorId === visit.appointment.doctorId)
    .map(queue => queue.queueNo);

  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

function derivedAppointmentNo(id: string): string {
  return `APT-${String(id || Date.now()).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function derivedOpdEncounterNo(id: string | null | undefined): string {
  return id ? `OPD-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'Not created';
}

function buildPrescriptionNo(visit: OpdVisitVm, consultation: OpdConsultationRecord | null | undefined): string {
  const year = safeDate(visit.appointment.startsAt)?.getFullYear() ?? new Date().getFullYear();
  const source = [consultation?.id, visit.appointment.id, visit.appointment.patientId].filter(Boolean).join('|');
  const number = stableNumericHash(source || String(Date.now()));
  return `RX-${year}-${number.toString().padStart(6, '0')}`;
}

function buildRevisedPrescriptionNo(currentNo: string, revisionNo: number): string {
  const baseNo = currentNo.replace(/-R\d+$/i, '') || `RX-${new Date().getFullYear()}-DRAFT`;
  return revisionNo > 1 ? `${baseNo}-R${revisionNo}` : baseNo;
}

function stableNumericHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000;
  }
  return hash || 1;
}

function priorityLabel(value: string | null | undefined): string {
  const normalized = String(value || 'NORMAL').toUpperCase();
  return appointmentPriorityOptions.find(option => option.value === normalized)?.label ?? 'Normal';
}

function humanizeCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function todayInputValue(): string {
  return inputValue(new Date());
}

function inputValue(date: Date): string {
  const value = safeDate(date);
  if (!value) {
    return '';
  }
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
}

function addDaysInputValue(date: Date, days: number): string {
  const value = safeDate(date);
  if (!value) {
    return '';
  }
  value.setDate(value.getDate() + days);
  return inputValue(value);
}

function timeInputValue(date: Date): string {
  const value = safeDate(date);
  if (!value) {
    return '09:00';
  }
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(11, 16);
}

function dateKey(value: string): string {
  const date = safeDate(value);
  return date ? inputValue(date) : '';
}

function isToday(value: string): boolean {
  const key = dateKey(value);
  return Boolean(key) && key === todayInputValue();
}

function isDateTodayOrFuture(value: string): boolean {
  const key = dateKey(value);
  return Boolean(key) && key >= todayInputValue();
}

function formatTime(value: string): string {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date) : '-';
}

function safeDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeTime(value: string | Date | null | undefined): number {
  return safeDate(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatDisplayDateTime(value: string | Date): string {
  const date = safeDate(value);
  return date
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
    : '-';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

function toAmount(value: string): number {
  const amount = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function calculateBmi(heightValue: string, weightValue: string): string {
  const heightCm = toAmount(heightValue);
  const weightKg = toAmount(weightValue);
  if (!heightCm || !weightKg) {
    return '';
  }

  const heightM = heightCm / 100;
  return (weightKg / (heightM * heightM)).toFixed(1);
}
