import { AuthStore } from '../../core/auth/auth.store';
import { PatientProfile } from '../patients/patient-management.models';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, Injector, OnInit, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiResponse } from '../../core/auth/auth.models';
import { BranchContextOption, BranchContextService } from '../../core/context/branch-context.service';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcDismissiblePopoverDirective } from '../../shared/ui/dismissible-popover.directive';
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
  OpdDrugAllergyAlert,
  OpdDrugInteractionAlert,
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
import { isAsNeededPrescription, prescriptionItemIssues } from './prescription-validation';
import { LaboratoryService } from '../laboratory/laboratory.service';
import { LabReport } from '../laboratory/laboratory.models';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, AcDropdownComponent, AcGridLoaderComponent, AcDismissiblePopoverDirective],
  template: `
    <ng-template #previousVisitPanel let-visit>
      <section class="history-visit"><h3>Previous visit</h3>
        @if (previousConsultation(visit); as previous) {
          <p>{{ previous.createdAt | date:'mediumDate' }}</p>
          @for (section of clinicalSummaryPreview(previous.notes).sections; track section.title) {
            @if (['Diagnosis', 'Prescription', 'Clinical Notes', 'Follow-up'].includes(section.title)) { <h4>{{ section.title }}</h4>@for (item of section.items; track item) { <p>{{ item }}</p> } }
          }
        } @else { <p>{{ historyByPatient()[visit.appointment.patientId] ? 'No previous completed visit recorded.' : (contextError() || 'Loading history…') }}</p> }
      </section>
    </ng-template>
    <section class="opd-page" [class.consulting]="activeTab() === 'encounter'">
      <header class="page-header">
        <div>
          <p class="ac-eyebrow">Clinical workspace</p>
          <h1 class="ac-page-title">Today's OPD</h1>
          <p class="page-desc">Your waiting patients, current consultation, and clinical decisions in one place.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary" type="button" (click)="reload()">
            <span aria-hidden="true" class="material-symbols-rounded">refresh</span>
            Refresh
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="goToAppointments()">
            <span aria-hidden="true" class="material-symbols-rounded">event_available</span>
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
      @if (averageConsultationMinutes(); as minutes) { <p class="page-desc">Average consultation time today: {{ minutes }} min</p> }

      <section class="opd-shell ac-card">
        <div class="opd-tabs">
          @for (tab of tabs; track tab.id) {
            <button type="button" [class.active]="activeTab() === tab.id" [disabled]="saving()" (click)="setActiveTab(tab.id)">
              <span aria-hidden="true" class="material-symbols-rounded">{{ tab.icon }}</span>
              <span class="tab-label">{{ tab.label }}</span>
              @if (tabCount(tab.id); as count) {
                <span class="tab-count">{{ count }}</span>
              }
            </button>
          }
        </div>

        <div class="toolbar">
          <div class="search-field">
            <span aria-hidden="true" class="material-symbols-rounded">search</span>
            <input type="text" name="opdSearch" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" aria-label="Search OPD patients by token, name, MRN, or doctor" placeholder="Search token, patient, MRN..." />
          </div>
          <ac-dropdown ariaLabel="doctor Filter" name="doctorFilter" [ngModel]="doctorFilter()" (ngModelChange)="doctorFilter.set($event)" [options]="doctorFilterOptions()" />
          <button class="icon-btn" type="button" title="Clear filters" (click)="clearFilters()">
            <span aria-hidden="true" class="material-symbols-rounded">filter_alt_off</span>
          </button>
        </div>

        @if (loading()) {
          <ac-grid-loader title="Loading OPD workspace..." message="Preparing queue, check-ins, consultations, and lab context." />
        } @else {
          @switch (activeTab()) {
            @case ('dashboard') {
              @if (completedPatientName()) {
                <div class="completion-banner" role="status"><span aria-hidden="true" class="material-symbols-rounded">task_alt</span><span>Consultation completed for {{ completedPatientName() }}. Your next patient is ready below.</span>@if (completedPrescription()) { <button type="button" class="ac-btn ac-btn-secondary" (click)="printCompletedPrescription()">Print prescription</button> }</div>
              }
              <section class="opd-today-grid">
                <article class="panel today-queue-panel">
                  <div class="panel-topline"><div><p class="ac-eyebrow">My Queue</p><h2>Waiting patients</h2><span>{{ doctorQueueSummary().doctorName }} · {{ waitingQueue().length }} waiting</span></div></div>
                  <div class="simple-queue-list">
                    @for (visit of waitingQueue(); track visit.appointment.id) {
                      <div class="simple-queue-row">
                        <span class="token-pill">{{ visit.tokenNumber }}</span>
                        <span class="patient-cell"><strong>{{ visit.patientName }}</strong><small>{{ visit.patientMrn }} · {{ patientAgeGender(visit) }}</small><small>{{ waitingTime(visit) }} · {{ visit.priorityCode }}</small></span>
                        <button type="button" class="ac-btn ac-btn-primary" [disabled]="saving()" (click)="startEncounter(visit)">Start Consultation</button>
                      </div>
                    } @empty { <div class="empty-state compact">No patients waiting. {{ activeConsultations().length ? 'Your current consultation is shown alongside.' : 'Checked-in patients will appear here.' }}</div> }
                  </div>
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="goToAppointments()">Reception / Check-In</button>
                </article>
                <article class="panel patient-focus-panel">
                  @if (dashboardFocusVisit(); as visit) {
                    <p class="ac-eyebrow">{{ visit.consultation ? 'Current patient' : 'Next patient' }}</p>
                    <div class="focus-head"><div><h2>{{ visit.patientName }}</h2><span>{{ patientAgeGender(visit) }} · {{ visit.patientMrn }}</span></div><span class="status-badge">{{ visit.consultation ? encounterStatusLabel(visit) : 'Waiting' }}</span></div>
                    <div class="focus-details">
                      <span><small>Token</small><strong>{{ visit.tokenNumber }}</strong></span>
                      <span><small>Arrival</small><strong>{{ visit.arrivalTime || 'Not recorded' }}</strong></span>
                      <span><small>Allergies</small><strong>{{ allergySummary(visit) }}</strong></span>
                      <span><small>Previous visits</small><strong>{{ previousVisitCount(visit) }}</strong></span>
                      <span><small>Lab orders pending</small><strong>{{ pendingLabCount(visit) }}</strong></span>
                      <span><small>Medication history</small><strong>{{ recordedMedicationSummary(visit) }}</strong></span>
                      <span><small>Medical history</small><strong>{{ visit.patient?.pastMedicalHistory || 'Not recorded' }}</strong></span>
                    </div>
                    @if (clinicalSummaryPreview(visit.consultation?.notes); as summary) {
                      @for (section of summary.sections; track section.title) {
                        @if (section.title === 'Vitals' || section.title === 'Complaints') {
                          <section class="summary-section"><h3>{{ section.title }}</h3>@for (item of section.items; track item) { <p>{{ item }}</p> }</section>
                        }
                      }
                    }
                    <div class="focus-action-grid">
                      <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="visit.consultation ? selectVisit(visit, 'encounter') : startEncounter(visit)">{{ visit.consultation ? 'Open Consultation' : 'Call Next Patient' }}</button>
                      <button class="ac-btn ac-btn-secondary" type="button" (click)="showHistory(visit)">View complete history →</button>
                    </div>
                    <ng-container *ngTemplateOutlet="previousVisitPanel; context: { $implicit: visit }" />
                  } @else { <div class="empty-state compact">No current consultation or waiting patients.</div> }
                </article>
              </section>
            }
            @case ('follow-ups') {
              <section class="panel"><h2>Upcoming follow-ups</h2>
                @for (followUp of visibleFollowUps(); track followUp.id) {
                  <div class="visit-row"><div><strong>{{ patientNameFor(followUp.patientId) }}</strong><p>{{ followUp.followUpDate | date:'mediumDate' }}</p><p>{{ followUp.notes || 'No follow-up notes recorded' }}</p></div><button class="ac-btn ac-btn-secondary" (click)="openPatientProfile(followUp.patientId)">Patient history</button></div>
                } @empty { <p class="empty-state">No upcoming follow-ups for this doctor.</p> }
              </section>
            }
            @case ('history') {
              <section class="panel"><h2>Patient history</h2>
                @if (selectedVisit() || dashboardFocusVisit(); as visit) {
                  <h3>{{ visit.patientName }} · {{ visit.patientMrn }}</h3>
                  <button class="ac-btn ac-btn-secondary" (click)="openPatientProfile(visit.appointment.patientId)">Open complete patient record</button>
                  @if (historyByPatient()[visit.appointment.patientId]; as history) {
                    @for (record of history; track record.id) {
                      <article class="history-visit"><details><summary>Full clinical notes</summary><p style="white-space: pre-wrap">{{ record.notes }}</p></details><h3>{{ record.createdAt | date:'medium' }} · {{ record.statusCode }}</h3>
                        @for (section of clinicalSummaryPreview(record.notes).sections; track section.title) { <h4>{{ section.title }}</h4>@for (item of section.items; track item) { <p>{{ item }}</p> } }
                      </article>
                    } @empty { <p>No previous consultations recorded.</p> }
                  } @else { <p>{{ contextError() || 'Loading patient history…' }}</p> }
                } @else { <p>Select a patient from My Queue or Today's Visits to see their history.</p> }
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
                    <ac-dropdown ariaLabel="transfer Doctor" name="transferDoctor" [(ngModel)]="transferDoctorId" [options]="transferDoctorOptions()" />
                    <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving() || !transferDoctorId" (click)="confirmTransferDoctor()">
                      <span aria-hidden="true" class="material-symbols-rounded">sync_alt</span>
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
                            <span aria-hidden="true" class="material-symbols-rounded">play_arrow</span>
                          </button>
                          <button class="tbl-btn" type="button" title="Skip" [disabled]="!canUseQueueActions(visit)" (click)="skipVisit(visit)">
                            <span aria-hidden="true" class="material-symbols-rounded">skip_next</span>
                          </button>
                          <button class="tbl-btn danger" type="button" title="Mark No Show" [disabled]="!canUseQueueActions(visit)" (click)="markNoShow(visit)">
                            <span aria-hidden="true" class="material-symbols-rounded">event_busy</span>
                          </button>
                          <button class="tbl-btn" type="button" title="Transfer Doctor" [disabled]="!canTransferDoctor(visit)" (click)="openTransferDoctor(visit)">
                            <span aria-hidden="true" class="material-symbols-rounded">sync_alt</span>
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
                      <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="quickCheckIn(visit)">
                        <span aria-hidden="true" class="material-symbols-rounded" [class.spin]="saving()">{{ saving() ? 'progress_activity' : 'how_to_reg' }}</span>
                        {{ saving() ? 'Checking in...' : 'Check-In' }}
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
              <ng-container *ngTemplateOutlet="visitList; context: { visits: todaysVisits(), action: 'Open Visit' }" />
            }

            @case ('encounter') {
              <section class="encounter-layout">
                <article class="encounter-card" [style.--opd-header-height]="consultationHeaderHeight() + 'px'">
                  @if (selectedVisit(); as visit) {
                    <div #consultationHeader class="encounter-head">
                      <div>
                        <p class="ac-eyebrow">Consultation workspace · {{ visit.doctorName }}</p>
                        <h2>{{ visit.patientName }}</h2>
                        <span>{{ visit.patientMrn }} · {{ patientAgeGender(visit) }} · Token {{ visit.tokenNumber }}</span>
                      </div>
                      <div class="encounter-head-actions"><span class="status-badge">{{ encounterStatusLabel(visit) }}</span><button class="ac-btn ac-btn-secondary" type="button" (click)="showHistory(visit)"><span aria-hidden="true" class="material-symbols-rounded">history</span>History &amp; results</button></div>
                      <div class="patient-alert-strip">
                        <span class="clinical-alert" [class.allergy-alert]="hasRecordedAllergies(visit)"><span aria-hidden="true" class="material-symbols-rounded">shield</span><strong>Allergies:</strong> {{ allergySummary(visit) }}</span>
                        @if (recordedConditions(visit); as conditions) { <span class="clinical-alert condition-alert"><span aria-hidden="true" class="material-symbols-rounded">medical_information</span>{{ conditions }}</span> }
                      </div>
                      <div class="patient-vitals-strip" aria-label="Current consultation vitals">
                        @for (vital of compactVitals(); track vital.label) { <span><small>{{ vital.label }}</small><strong>{{ vital.value || '—' }}</strong><small>{{ vital.unit }}</small></span> }
                        <button type="button" (click)="focusConsultationField('assessment', 'bloodPressure')">Record vitals <span aria-hidden="true" class="material-symbols-rounded">edit</span></button>
                      </div>
                    </div>

                    <div class="encounter-workspace">

                      <aside class="patient-snapshot doctor-summary" aria-label="Doctor summary">
                        <details class="doctor-summary-details" [open]="wideConsultation()">
                          <summary><span aria-hidden="true" class="material-symbols-rounded">clinical_notes</span>Doctor summary<span class="summary-live">Live</span></summary>
                          <div class="summary-content">
                            <div class="summary-patient"><strong>{{ visit.patientName }}</strong><small>{{ patientAgeGender(visit) }} · {{ visit.patientMrn }}</small></div>
                            <section><h4>Patient context</h4><p>{{ visit.patient?.pastMedicalHistory || 'Medical history not recorded' }}</p><p>{{ visit.patient?.knownConditions || 'Conditions not recorded' }}</p></section>
                            <section><h4>Previous medicines</h4><p>{{ recordedMedicationSummary(visit) }}</p><small>Confirm current use with the patient.</small></section>
                            <section><h4>Today's diagnosis <span>{{ clinicalForm().diagnoses.length }}</span></h4>@for (diagnosis of clinicalForm().diagnoses; track $index) { <p><strong>{{ diagnosis.diagnosisType === 'PRIMARY' ? '★ ' : '' }}{{ diagnosis.diagnosisName }}</strong><small>{{ diagnosis.diagnosisCode }}</small></p> } @empty { <p class="summary-empty">No diagnosis added yet</p> }</section>
                            <section><h4>Treatment <span>{{ clinicalForm().prescriptions.length }}</span></h4>@for (medicine of clinicalForm().prescriptions; track $index) { <p><strong>{{ medicine.medicine }} {{ medicine.strength }}</strong><small>{{ medicine.dosage }} · {{ medicine.frequency }} · {{ medicine.duration }}</small></p> } @empty { <p class="summary-empty">No medicines added yet</p> }</section>
                            <section><h4>Follow-up</h4><p>{{ clinicalForm().followUp.followUpRequired ? (clinicalForm().followUp.followUpDate || 'Choose a review date') : 'Not requested' }}</p>@if (clinicalForm().followUp.followUpRequired) { <small>{{ clinicalForm().followUp.reason }}</small> }</section>
                            <button class="summary-results" type="button" (click)="showHistory(visit)"><span aria-hidden="true" class="material-symbols-rounded">lab_research</span>{{ pendingLabCount(visit) }} pending lab orders<span aria-hidden="true" class="material-symbols-rounded">arrow_forward</span></button>
                            <details class="summary-previous"><summary>Previous visit</summary><ng-container *ngTemplateOutlet="previousVisitPanel; context: { $implicit: visit }" /></details>
                            <small class="shortcut-hint">F2 Diagnosis · F3 Medicine · F4 Investigation<br />Ctrl + S Save · Ctrl + Enter Review</small>
                          </div>
                        </details>
                      </aside>


                      <section class="clinical-board">

                        <nav class="consultation-jump-links" aria-label="Consultation sections">
                          @for (stage of consultationStages; track stage.id) {
                            <button type="button" [class.active]="consultationStage() === stage.id" [attr.aria-current]="consultationStage() === stage.id ? 'step' : null" [disabled]="saving() && !draftSaving()" (click)="jumpToConsultation(stage.id)"><span class="stage-number">{{ $index + 1 }}</span><span><strong>{{ stage.label }}</strong><small>{{ stage.description }}</small></span><span aria-hidden="true" class="material-symbols-rounded">{{ stage.icon }}</span></button>
                          }
                        </nav>
                        <fieldset class="consultation-fields" [disabled]="reviewOpen() || (saving() && !draftSaving()) || finishing()">
                          <legend class="sr-only">Consultation for {{ visit.patientName }}</legend>
                          <section class="consultation-group" id="opd-assessment" [hidden]="consultationStage() !== 'assessment'">
                            <div class="group-heading"><span>1</span><div><h2>Clinical assessment</h2><p>Record today's findings once.</p></div></div>
                            <details class="optional-section vitals-section" open><summary>Vitals <span>Review and record</span></summary><div class="section-title">
                                <h3>Vitals</h3>
                                <p>BMI is calculated automatically from height and weight.</p>
                              </div>
                              <div class="clinical-grid">
                                    <label class="field"><span>Temperature (°F)</span><input name="temperature" [(ngModel)]="clinicalForm().vitals.temperature" placeholder="°F" /></label>
                                <label class="field"><span>Blood Pressure</span><input name="bloodPressure" [(ngModel)]="clinicalForm().vitals.bloodPressure" placeholder="120/80" /></label>
                                    <label class="field"><span>Pulse (bpm)</span><input name="pulseRate" [(ngModel)]="clinicalForm().vitals.pulseRate" placeholder="bpm" /></label>
                                <label class="field"><span>Respiratory Rate</span><input name="respiratoryRate" [(ngModel)]="clinicalForm().vitals.respiratoryRate" placeholder="16 / min" /></label>
                                <label class="field"><span>SpO2</span><input name="spo2" [(ngModel)]="clinicalForm().vitals.spo2" placeholder="98%" /></label>
                                <label class="field"><span>Height</span><input name="height" [(ngModel)]="clinicalForm().vitals.height" placeholder="cm" /></label>
                                <label class="field"><span>Weight</span><input name="weight" [(ngModel)]="clinicalForm().vitals.weight" placeholder="kg" /></label>
                                <span class="metric-tile"><small>BMI</small><strong>{{ bmiValue() || '-' }}</strong></span>
                              </div></details>
                            <div class="consultation-stack">
                                <section>
                                  <div class="section-title">
                                    <h3>Consultation</h3>
                                    <p>Capture chief complaints, clinical history, and examination findings in one place.</p>
                                  </div>
                                  <div class="clinical-grid">
                                    <label class="field"><span>Complaint</span><input name="complaint" [(ngModel)]="clinicalForm().complaintDraft.complaint" placeholder="Body pain" /></label>
                                    <label class="field"><span>Duration</span><input name="complaintDuration" [(ngModel)]="clinicalForm().complaintDraft.duration" placeholder="2 days" /></label>
                                    <label class="field"><span>Severity</span><ac-dropdown ariaLabel="complaint Severity" name="complaintSeverity" [(ngModel)]="clinicalForm().complaintDraft.severity" [options]="complaintSeverityOptions" /></label>
                                    <label class="field wide"><span>Notes</span><input name="complaintNotes" [(ngModel)]="clinicalForm().complaintDraft.notes" placeholder="Associated symptoms or trigger" /></label>
                                  </div>
                                  <button class="ac-btn ac-btn-secondary" type="button" (click)="addComplaint()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Complaint</button>
                                  <div class="chip-list">
                                    @for (item of clinicalForm().complaints; track $index) {
                                      <span>{{ item.complaint }} · {{ item.severity }} <button type="button" (click)="removeComplaint($index)">Remove</button></span>
                                    }
                                  </div>
                                </section>

                                <section>
                                  <div class="section-title"><h3>Clinical History</h3><p>Present illness and relevant medical background.</p></div>
                                  <div class="clinical-grid single">
                                    <label class="field"><span>History of present illness</span><textarea rows="3" name="presentIllness" [(ngModel)]="clinicalForm().history.presentIllness" placeholder="Describe onset, course and associated symptoms…"></textarea></label>
                                    <details class="optional-section"><summary>Structured symptom history <span>Optional</span></summary><div class="clinical-grid">
                                      <label class="field"><span>Location</span><input name="hpiLocation" [(ngModel)]="clinicalForm().history.location" /></label><label class="field"><span>Onset</span><input name="hpiOnset" [(ngModel)]="clinicalForm().history.onset" /></label><label class="field"><span>Character</span><input name="hpiCharacter" [(ngModel)]="clinicalForm().history.character" /></label><label class="field"><span>Associated symptoms</span><input name="hpiAssociatedSymptoms" [(ngModel)]="clinicalForm().history.associatedSymptoms" /></label><label class="field"><span>Aggravating factors</span><input name="hpiAggravating" [(ngModel)]="clinicalForm().history.aggravatingFactors" /></label><label class="field"><span>Relieving factors</span><input name="hpiRelieving" [(ngModel)]="clinicalForm().history.relievingFactors" /></label>
                                    </div><button type="button" class="ac-btn ac-btn-secondary" (click)="appendStructuredHistory()">Add to HPI</button></details>
                                    <details class="optional-section"><summary>Past, family, and surgical history</summary>
                                    <label class="field"><span>Past History</span><textarea rows="3" name="pastHistory" [(ngModel)]="clinicalForm().history.pastHistory"></textarea></label>
                                    <label class="field"><span>Family History</span><textarea rows="3" name="familyHistory" [(ngModel)]="clinicalForm().history.familyHistory"></textarea></label>
                                    <label class="field"><span>Surgical History</span><textarea rows="3" name="surgicalHistory" [(ngModel)]="clinicalForm().history.surgicalHistory"></textarea></label>
                                    </details>
                                  </div>
                                </section>

                                <section>
                                  <div class="section-title"><h3>Examination</h3><p>General, system, and observational findings.</p></div>
                                  <div class="clinical-grid single">
                                    <label class="field"><span>General Examination</span><textarea rows="3" name="generalExamination" [(ngModel)]="clinicalForm().examination.generalExamination"></textarea></label>
                                    <details class="optional-section system-examination"><summary>+ System examination <span>Expand when needed</span></summary>
                                    <div class="system-template-buttons">@for (system of examinationSystems(); track system) { <button type="button" (click)="addExaminationSystem(system)">{{ system }}</button> }</div>
                                    <label class="field"><span>System Examination</span><textarea rows="3" name="systemExamination" [(ngModel)]="clinicalForm().examination.systemExamination"></textarea></label>
                                    <label class="field"><span>Observations</span><textarea rows="3" name="observations" [(ngModel)]="clinicalForm().examination.observations"></textarea></label>
                                    </details>
                                  </div>
                                </section>
                              </div>
                            <div class="section-title"><h3>Diagnosis</h3><p>Primary and secondary diagnoses are supported.</p></div>
                              <div class="clinical-grid">
                                <label class="field"><span>ICD Code</span><input name="diagnosisCode" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisCode" placeholder="M25.512" /></label>
                                <div class="field diagnosis-search-field" [acDismissiblePopover]="diagnosisSuggestionsOpen()" (dismissPopover)="diagnosisSuggestionsOpen.set(false)"><label for="opd-diagnosis-name">Diagnosis</label><input id="opd-diagnosis-name" name="diagnosisName" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisName" (ngModelChange)="diagnosisSuggestionsOpen.set(true)" (focus)="diagnosisSuggestionsOpen.set(true)" placeholder="Search a recorded diagnosis or enter one…" autocomplete="off" />@if (diagnosisSuggestionsOpen() && diagnosisSuggestions().length) { <div class="medicine-suggestions diagnosis-suggestions">@for (diagnosis of diagnosisSuggestions(); track diagnosis.diagnosisCode + diagnosis.diagnosisName) { <button type="button" (click)="selectDiagnosisSuggestion(diagnosis)"><strong>{{ diagnosis.diagnosisName }}</strong><small>{{ diagnosis.diagnosisCode || 'No code recorded' }} · Recorded diagnosis</small></button> }</div> }</div>
                                <div class="field">
                                  <span>Type</span>
                                  <div class="radio-segment">
                                    <label><input type="radio" name="diagnosisType" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisType" value="PRIMARY" /> Primary</label>
                                    <label><input type="radio" name="diagnosisType" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisType" value="SECONDARY" /> Secondary</label>
                                  </div>
                                </div>
                                <label class="field wide"><span>Notes</span><input name="diagnosisNotes" [(ngModel)]="clinicalForm().diagnosisDraft.notes" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" (click)="addDiagnosis()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Diagnosis</button>
                              <div class="record-list">
                                @for (item of clinicalForm().diagnoses; track $index) {
                                  <span><strong>{{ item.diagnosisName }}</strong><small>{{ item.diagnosisCode || '-' }} · {{ item.diagnosisType }}</small><button type="button" (click)="removeDiagnosis($index)">Remove</button></span>
                                }
                              </div>
                            <details class="optional-section"><summary>Additional clinical notes</summary><div class="section-title"><h3>Clinical Notes</h3><p>Free-form clinical summary for this encounter.</p></div>
                              <label class="field"><span>Clinical Notes</span><textarea rows="9" name="clinicalNotes" [(ngModel)]="clinicalForm().clinicalNotes" placeholder="Capture summary, advice, counseling, and follow-up plan."></textarea></label></details>
                          </section>
                          <section class="consultation-group" id="opd-treatment" [hidden]="consultationStage() !== 'treatment'">
                            <div class="group-heading"><span>2</span><div><h2>Treatment plan</h2><p>Add medicines, tests, and advice as needed.</p></div></div>
                            @if (prescriptionLocked()) {
                                <div class="prescription-lock-banner">
                                  <span aria-hidden="true" class="material-symbols-rounded">verified</span>
                                  <div>
                                    <strong>Prescription {{ prescriptionStatusLabel() }}</strong>
                                    <p>Create a revised prescription before changing issued medical instructions.</p>
                                    <button type="button" class="ac-btn ac-btn-secondary" (click)="createRevisedPrescription()">Revise prescription</button>
                                  </div>
                                </div>
                              }
                              <details class="treatment-templates"><summary>Use or save a treatment template</summary><section class="prescription-template-panel" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="template-panel-head">
                                  <div class="template-panel-title">
                                    <span aria-hidden="true" class="material-symbols-rounded">auto_awesome</span>
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
                                      <span aria-hidden="true" class="material-symbols-rounded">post_add</span>
                                      Apply Template
                                    </button>
                                    <button class="ac-btn ac-btn-secondary" type="button" [disabled]="!canSavePrescriptionTemplate()" (click)="openSavePrescriptionTemplate()">
                                      <span aria-hidden="true" class="material-symbols-rounded">bookmark_add</span>
                                      Save Current
                                    </button>
                                  </div>
                                </div>

                              </section></details>
                              <section class="medicine-composer" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="section-title">
                                  <h3>Medicine / Prescription</h3>
                                  <p>Add each medicine as a separate row with strength, form, dosage, frequency, route, duration, quantity, and instructions.</p>
                                  @if (!pharmacyIntegrationEnabled()) { <p class="medicine-catalog-help">Independent prescribing: review the patient's recorded allergies and medicines. Automated pharmacy checks and pharmacy handoff are unavailable.</p> }
                                </div>
                                <div class="clinical-grid medicine-grid">
                                  <div class="field medicine-search-field" [acDismissiblePopover]="medicineSuggestionsOpen()" (dismissPopover)="medicineSuggestionsOpen.set(false)">
                                    <label for="opd-medicine-name">Medicine Name *</label>
                                    <input
                                      id="opd-medicine-name"
                                      name="medicine"
                                      [ngModel]="clinicalForm().prescriptionDraft.medicine"
                                      (ngModelChange)="updateMedicineSearch($event)"
                                      (focus)="medicineSuggestionsOpen.set(true)"
                                      (click)="medicineSuggestionsOpen.set(true)"
                                      [attr.aria-expanded]="medicineSuggestionsOpen() && medicineSearchResults().length > 0"
                                      aria-controls="opd-medicine-suggestions"
                                      placeholder="Search Medicine..."
                                      autocomplete="off"
                                      aria-describedby="opd-medicine-catalog-help"
                                    />
                                    <small id="opd-medicine-catalog-help" class="medicine-catalog-help">{{ clinicalForm().prescriptionDraft.medicineId ? 'Hospital catalog medicine selected.' : pharmacyIntegrationEnabled() ? 'Choose a medicine from the hospital catalog suggestions.' : 'Choose a pharmacy medicine suggestion or enter your own medicine name. Stock availability does not limit suggestions.' }}</small>
                                    @if (pharmacyConfigurationError()) {
                                      <small class="medicine-validation-error" role="alert">Unable to load prescribing settings. <button type="button" (click)="reload()">Retry settings</button></small>
                                    } @else if (medicineCatalogError()) {
                                      <small class="medicine-validation-error" role="alert">Medicine catalog could not be loaded. <button type="button" (click)="refreshMedicineCatalog()">Retry catalog</button></small>
                                    } @else if (!clinicalForm().prescriptionDraft.medicineId && clinicalForm().prescriptionDraft.medicine.trim().length >= 2 && !medicineSearchResults().length) {
                                      <small class="medicine-catalog-help" role="status">{{ medicines().length ? 'No matching pharmacy medicine. Try the brand or generic name.' : 'No active medicines are available in the pharmacy catalog.' }}{{ pharmacyIntegrationEnabled() ? ' Ask Pharmacy to update the catalog if needed.' : ' You can enter your own medicine name.' }}</small>
                                    }
                                    @if (medicineSuggestionsOpen() && medicineSearchResults().length > 0) {
                                      <div class="medicine-suggestions" id="opd-medicine-suggestions">
                                        @for (medicine of medicineSearchResults(); track medicine.key) {
                                          <button type="button" (click)="selectMedicineSuggestion(medicine)">
                                            <strong>{{ medicine.label }}</strong>
                                            @if (medicine.genericName && medicine.genericName.toLowerCase() !== medicine.name.toLowerCase()) {
                                              <small>{{ medicine.genericName }}</small>
                                            }
                                            <small>{{ medicine.name }} · {{ medicine.strength || '-' }} · {{ medicine.form || '-' }}</small>
                                            @if (medicine.formularyStatus === 'RESTRICTED') { <small class="medicine-formulary-warning">Restricted{{ medicine.approvalRequired ? ' · Approval required' : '' }}{{ medicine.restrictionReason ? ' · ' + medicine.restrictionReason : '' }}</small> }
                                          </button>
                                        }
                                      </div>
                                    }
                                  </div>
                                  <label class="field"><span>Strength</span><input name="medicineStrength" [(ngModel)]="clinicalForm().prescriptionDraft.strength" placeholder="500 mg" /></label>
                                  <label class="field"><span>Dosage Form</span><input name="dosageForm" [(ngModel)]="clinicalForm().prescriptionDraft.dosageForm" placeholder="Tablet" /></label>
                                  <label class="field"><span>Dosage *</span><input name="dosage" [(ngModel)]="clinicalForm().prescriptionDraft.dosage" placeholder="1 Tablet" /></label>
                                  <label class="field">
                                    <span>Frequency *</span>
                                    <ac-dropdown
                                      name="frequencyPreset"
                                      [ngModel]="frequencySelection()"
                                      (ngModelChange)="updateFrequencySelection($event)"
                                      [options]="frequencyOptions"
                                    />
                                  </label>
                                  <label class="field"><span>Route *</span><input name="route" [(ngModel)]="clinicalForm().prescriptionDraft.route" placeholder="Oral" /></label>
                                  <label class="field"><span>Duration (days) *</span><input name="duration" [(ngModel)]="clinicalForm().prescriptionDraft.duration" placeholder="5 Days" /></label>
                                  <label class="field"><span>Quantity *</span><input name="quantity" [(ngModel)]="clinicalForm().prescriptionDraft.quantity" placeholder="10" /></label>
                                  @if (customFrequencyMode()) {
                                    <label class="field"><span>Custom Frequency</span><input name="customFrequency" [(ngModel)]="clinicalForm().prescriptionDraft.frequency" placeholder="Enter custom frequency" /></label>
                                  }
                                  <label class="field wide"><span>Instructions</span><input name="instructions" [(ngModel)]="clinicalForm().prescriptionDraft.instructions" placeholder="After Food" /></label>
                                  <label class="field prescription-prn"><span>As needed (PRN)</span><input type="checkbox" name="isPrn" [(ngModel)]="clinicalForm().prescriptionDraft.isPrn" /></label>
                                  @if (clinicalForm().prescriptionDraft.isPrn) { <label class="field wide"><span>PRN reason / indication *</span><input name="prnReason" [(ngModel)]="clinicalForm().prescriptionDraft.prnReason" placeholder="Example: Fever above 38°C or pain" /></label> }
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addPrescriptionItem()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Medicine</button>
                              </section>
                              <div class="medicine-table" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="medicine-table-head">
                                  <strong>Prescription medicines</strong><span>{{ clinicalForm().prescriptions.length }} added</span>
                                </div>
                                @for (item of clinicalForm().prescriptions; track $index) {
                                  <div class="medicine-table-row">
                                    <span class="medicine-index">{{ $index + 1 }}</span>
                                    <span class="medicine-card-content"><strong>{{ item.medicine }} <span>{{ item.strength }}</span></strong><small>{{ item.dosageForm }} · {{ item.dosage || 'Dose not recorded' }} · {{ item.frequency }} · {{ item.route }} · {{ item.duration }}</small><small>Quantity: {{ item.quantity || '-' }}{{ item.instructions ? ' · ' + item.instructions : '' }}{{ item.isPrn ? ' · As needed: ' + item.prnReason : '' }}</small>@if (medicineValidationIssues(item).length) { <small class="medicine-validation-error">Required: {{ medicineValidationIssues(item).join(', ') }}. Use Edit to correct this medicine.</small> }</span>
                                    <span class="medicine-card-actions"><button type="button" (click)="editPrescriptionItem($index)" [attr.aria-label]="'Edit ' + item.medicine">Edit</button><button type="button" (click)="removePrescriptionItem($index)" [attr.aria-label]="'Remove ' + item.medicine">Remove</button></span>
                                  </div>
                                } @empty {
                                  <div class="empty-state compact">No medicines added yet.</div>
                                }
                              </div>
                              <details class="optional-section" [open]="clinicalForm().prescriptionInvestigations.length > 0"><summary>Investigations / imaging advice <span>{{ clinicalForm().prescriptionInvestigations.length }} added</span></summary><section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
                                <div class="mini-section-title">
                                  <div>
                                    <h4>Other investigations / imaging advice</h4>
                                    <p>Printed advice only. Submit laboratory tests using the lab order section below.</p>
                                  </div>
                                  <label class="include-toggle"><input type="checkbox" name="includeInvestigations" [(ngModel)]="clinicalForm().includeInvestigationsInPrescription" /> Include in Prescription</label>
                                </div>
                                <div class="investigation-categories">@for (category of investigationCategories; track category.label) { <section><small>{{ category.label }}</small><div class="quick-complaints">@for (investigation of category.items; track investigation) { <button type="button" (click)="addInvestigation(investigation)">{{ investigation }}</button> }</div></section> }</div>
                                <div class="clinical-grid single">
                                  <label class="field"><span>Investigation</span><input name="investigationDraft" [(ngModel)]="clinicalForm().investigationDraft" placeholder="CBC, Blood Sugar, X-Ray..." /></label>
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addInvestigation()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Investigation</button>
                                <div class="chip-list">
                                  @for (item of clinicalForm().prescriptionInvestigations; track $index) {
                                    <span>{{ item }} <button type="button" (click)="removeInvestigation($index)">Remove</button></span>
                                  }
                                </div>
                              </section></details>

                              <details class="optional-section" [open]="clinicalForm().adviceList.length > 0"><summary>Patient advice <span>{{ clinicalForm().adviceList.length }} added</span></summary><section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
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
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addAdvice()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Advice</button>
                                <div class="chip-list">
                                  @for (item of clinicalForm().adviceList; track $index) {
                                    <span>{{ item }} <button type="button" (click)="removeAdvice($index)">Remove</button></span>
                                  }
                                </div>
                              </section></details>
                              <details class="optional-section" [open]="clinicalForm().dietAdviceList.length > 0"><summary>Diet guidance <span>{{ clinicalForm().dietAdviceList.length }} added</span></summary><section class="prescription-extra-card" [class.prescription-edit-locked]="prescriptionLocked()">
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
                                    <ac-dropdown ariaLabel="diet Advice" name="dietAdvice" [ngModel]="dietAdviceSelection()" (ngModelChange)="updateDietAdviceSelection($event)" [options]="dietAdviceOptions" />
                                  </label>
                                  @if (customDietAdviceMode()) {
                                    <label class="field wide"><span>Custom Advice</span><input name="customDietAdvice" [(ngModel)]="clinicalForm().dietAdviceDraft" placeholder="Enter diet advice" /></label>
                                  }
                                </div>
                                <button class="ac-btn ac-btn-secondary" type="button" (click)="addDietAdvice()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Diet Advice</button>
                                <div class="chip-list">
                                  @for (item of clinicalForm().dietAdviceList; track $index) {
                                    <span>{{ item }} <button type="button" (click)="removeDietAdvice($index)">Remove</button></span>
                                  }
                                </div>
                              </section></details>


                            <details class="optional-section" [open]="clinicalForm().labOrders.length > 0"><summary>Laboratory tests · {{ clinicalForm().labOrders.length }} selected</summary><div class="lab-order-composer">
                                <div class="section-title lab-order-title">
                                  <span aria-hidden="true" class="material-symbols-rounded">biotech</span>
                                  <div>
                                    <h3>Lab Orders</h3>
                                    <p>Submitted tests create a laboratory queue order.</p>
                                  </div>
                                </div>
                                <div class="clinical-grid lab-order-grid">
                                  <label class="field"><span>Test Category</span><input name="testCategory" [(ngModel)]="clinicalForm().labOrderDraft.testCategory" placeholder="Hematology" /></label>
                                  <label class="field"><span>Test</span><ac-dropdown ariaLabel="lab Test" name="labTest" [(ngModel)]="clinicalForm().labOrderDraft.testId" [options]="labTestOptions()" /></label>
                                  <label class="field"><span>Priority</span><ac-dropdown ariaLabel="lab Priority" name="labPriority" [(ngModel)]="clinicalForm().labOrderDraft.priority" [options]="labPriorityOptions" /></label>
                                  <label class="field wide"><span>Clinical indication / instructions</span><input name="labNotes" [(ngModel)]="clinicalForm().labOrderDraft.notes" placeholder="Reason for testing and instructions for the laboratory" /></label>
                                </div>
                                <div class="lab-order-actions">
                                  <button class="ac-btn ac-btn-secondary" type="button" (click)="addLabOrderDraft()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Test</button>
                                  <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="createLabOrder(visit)"><span aria-hidden="true" class="material-symbols-rounded">biotech</span>Create Lab Order</button>
                                </div>
                              </div>
                              <div class="record-list">
                                @for (item of clinicalForm().labOrders; track $index) {
                                  <span><strong>{{ labTestName(item.testId) }}</strong><small>{{ item.testCategory || '-' }} · {{ item.priority }}</small><button type="button" (click)="removeLabOrder($index)">Remove</button></span>
                                }
                              </div></details>
                            <details class="optional-section" [open]="clinicalForm().procedures.length > 0"><summary>Procedures · {{ clinicalForm().procedures.length }} added</summary><div class="section-title"><h3>Procedures</h3><p>Procedures are added to notes and billing services.</p></div>
                              <div class="clinical-grid">
                                <label class="field"><span>Procedure</span><input name="procedure" [(ngModel)]="clinicalForm().procedureDraft.procedure" placeholder="Dressing" /></label>
                                <label class="field"><span>Charge</span><input name="procedureCharge" [(ngModel)]="clinicalForm().procedureDraft.charge" placeholder="500" /></label>
                                <label class="field wide"><span>Notes</span><input name="procedureNotes" [(ngModel)]="clinicalForm().procedureDraft.notes" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" (click)="addProcedure()"><span aria-hidden="true" class="material-symbols-rounded">add</span>Add Procedure</button>
                              <div class="record-list">
                                @for (item of clinicalForm().procedures; track $index) {
                                  <span><strong>{{ item.procedure }}</strong><small>{{ currency(toAmount(item.charge)) }} · {{ item.notes || '-' }}</small><button type="button" (click)="removeProcedure($index)">Remove</button></span>
                                }
                              </div></details>
                          </section>
                          <section class="consultation-group" id="opd-follow-up" [hidden]="consultationStage() !== 'follow-up'">
                            <div class="group-heading"><span>3</span><div><h2>Follow-up and next steps</h2><p>Record the review plan or refer for admission.</p></div></div>
                            <div class="section-title"><h3>Follow-up</h3><p>Create a follow-up task or appointment automatically.</p></div>
                              <div class="clinical-grid">
                                <label class="check-field"><input type="checkbox" name="followUpRequired" [(ngModel)]="clinicalForm().followUp.followUpRequired" /> Follow-up Required</label>
                                <label class="field"><span>Review after (days)</span><input name="followUpAfter" [ngModel]="clinicalForm().followUp.followUpAfterDays" (ngModelChange)="updateFollowUpAfterDays($event)" inputmode="numeric" /></label><label class="field"><span>Follow-up Date</span><input type="date" name="followUpDate" [(ngModel)]="clinicalForm().followUp.followUpDate" /></label>
                                <label class="field"><span>Preferred Doctor</span><ac-dropdown ariaLabel="preferred Doctor" name="preferredDoctor" [(ngModel)]="clinicalForm().followUp.preferredDoctorId" [options]="preferredDoctorOptions()" /></label>
                                <label class="field"><span>Follow-up reason</span><input name="followUpReason" [(ngModel)]="clinicalForm().followUp.reason" list="opd-follow-up-reasons" placeholder="Select or enter a reason" /><datalist id="opd-follow-up-reasons"><option value="Review symptoms"></option><option value="Review investigations"></option><option value="Medication review"></option><option value="Post-procedure review"></option><option value="Chronic disease follow-up"></option></datalist></label>
                                <label class="check-field"><input type="checkbox" name="createFollowUpAppointment" [(ngModel)]="clinicalForm().followUp.createAppointment" /> Create Follow-Up Appointment Automatically</label>
                                @if (clinicalForm().followUp.createAppointment) { <label class="field"><span>Follow-up appointment time</span><input type="time" name="followUpAppointmentTime" [(ngModel)]="clinicalForm().followUp.appointmentTime" /></label> }
                                <label class="field wide"><span>Notes</span><input name="followUpNotes" [(ngModel)]="clinicalForm().followUp.notes" /></label>
                              </div>
                              <p class="page-desc">The follow-up task will be saved when you complete this consultation.</p>
                            <details class="optional-section"><summary>Admission referral</summary><p>Open the IPD admission workspace to arrange admission.</p><button type="button" class="ac-btn ac-btn-secondary" (click)="openAdmissionWorkspace(visit)">Open IPD admission</button></details>
                          </section>
                        </fieldset>
                        <footer class="consultation-footer">
                          <span class="draft-status" role="status" aria-live="polite">{{ draftSaveStatus() }}</span>
                          @if (consultationStage() !== 'assessment') { <button class="ac-btn ac-btn-secondary stage-back" type="button" (click)="moveConsultationStage(-1)"><span aria-hidden="true" class="material-symbols-rounded">arrow_back</span>Back</button> }
                          <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving() || draftConflict()" (click)="saveEncounterDraft()">Save Draft</button>
                          @if (consultationStage() !== 'follow-up') { <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving() && !draftSaving()" (click)="moveConsultationStage(1)">Next: {{ consultationStage() === 'assessment' ? 'Treatment' : 'Follow-up' }}<span aria-hidden="true" class="material-symbols-rounded">arrow_forward</span></button> } @else { <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving() || draftConflict()" (click)="openCompletionReview()">Review &amp; Complete</button> }
                        </footer>
                        @if (draftConflict()) { <div class="draft-conflict" role="alert"><p>This visit changed in another session. Your local draft is retained. Open patient history to compare records before loading the latest version.</p><button type="button" class="ac-btn ac-btn-secondary" [disabled]="saving()" (click)="loadLatestDraft()">Load latest saved version</button><button type="button" class="ac-btn ac-btn-secondary" (click)="downloadLocalDraft()">Download my local notes</button></div> }
                      </section>
                    </div>

                    <div class="encounter-actions">
                      @if (!visit.consultation) {
                        <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="startEncounter(visit)">
                          <span aria-hidden="true" class="material-symbols-rounded">stethoscope</span>
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


      @if (historyVisit(); as visit) {
        <div class="opd-overlay history-overlay" (click)="historyVisit.set(null)">
          <aside class="history-drawer" role="dialog" aria-modal="true" aria-labelledby="opd-history-title" cdkTrapFocus [cdkTrapFocusAutoCapture]="true" (click)="$event.stopPropagation()" (keydown.escape)="historyVisit.set(null)">
            <header class="history-header">
              <div class="history-heading"><span class="history-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4H5v16h14V4h-3M9 3h6v4H9zM8 11h8M8 15h5" /></svg></span><div><p class="history-eyebrow">PATIENT RECORD</p><h2 id="opd-history-title">History &amp; results</h2></div></div>
              <button type="button" class="history-close" aria-label="Close patient history" cdkFocusInitial (click)="historyVisit.set(null)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
            </header>
            <div class="history-patient"><span class="history-avatar" aria-hidden="true">{{ visit.patientName.slice(0, 1) }}</span><div><strong>{{ visit.patientName }}</strong><p>{{ visit.patientMrn }} <span aria-hidden="true">·</span> {{ patientAgeGender(visit) }}</p></div><span class="history-readonly">Read only</span></div>
            <nav class="history-navigation" aria-label="Patient history views">
              <button type="button" [class.active]="historyView() === 'visits'" [attr.aria-pressed]="historyView() === 'visits'" (click)="historyView.set('visits')">Visits <span>{{ historyRecords().length }}</span></button>
              <button type="button" [class.active]="historyView() === 'results'" [attr.aria-pressed]="historyView() === 'results'" (click)="historyView.set('results')">Lab reports <span>{{ patientLabReports()[visit.appointment.patientId]?.length || 0 }}</span></button>
              <button type="button" [class.active]="historyView() === 'documents'" [attr.aria-pressed]="historyView() === 'documents'" (click)="historyView.set('documents')">Imaging <span>{{ radiologyDocuments(visit).length }}</span></button>
            </nav>
            @if (contextError()) { <div class="history-context-error" role="alert"><p>{{ contextError() }}</p><button type="button" class="ac-btn ac-btn-secondary" (click)="retryHistoryContext()">Retry</button></div> }
            <div class="history-body">
              @switch (historyView()) {
                @case ('visits') {
                  @if (historyByPatient()[visit.appointment.patientId]) {
                    @if (historyRecords().length) {
                      <div class="history-visits-layout">
                        <nav class="history-timeline" aria-label="Consultation timeline"><p class="history-eyebrow">VISIT TIMELINE</p>
                          @for (item of historyRecords(); track item.record.id) {
                            <button type="button" class="history-timeline-item" [attr.data-status-tone]="item.tone" [class.selected]="selectedHistoryRecordId() === item.record.id" [attr.aria-pressed]="selectedHistoryRecordId() === item.record.id" (click)="selectHistoryRecord(item.record.id)">
                              <span class="history-timeline-date">{{ item.record.createdAt | date:'dd MMM yyyy' }}</span><span class="history-status"><span class="history-status-dot" aria-hidden="true"></span>{{ item.status }}</span><strong>{{ item.preview }}</strong><small>{{ item.doctorName }}</small>
                            </button>
                          }
                        </nav>
                        @if (selectedHistoryRecord(); as item) {
                          <article class="history-detail" aria-label="Selected consultation">
                            <div class="history-detail-heading history-consultation-status" [attr.data-status-tone]="item.tone"><div><p class="history-eyebrow">CONSULTATION</p><h3>{{ item.record.createdAt | date:'EEEE, dd MMM yyyy' }}</h3><p>{{ item.doctorName }}</p></div><span class="history-status"><span class="history-status-dot" aria-hidden="true"></span>{{ item.status }}</span></div>
                            @for (section of item.sections; track section.title) {
                              <section class="history-clinical-section"><div class="history-section-heading"><h4>{{ section.title }}</h4>@if (section.kind === 'medicines') { <span>{{ section.rows.length }} medicines</span> }</div>
                                @if (section.kind === 'metrics') {
                                  <dl class="history-vitals">@for (row of section.rows; track $index) { <div><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div> }</dl>
                                } @else {
                                  <div class="history-clinical-rows" [class.history-medicines]="section.kind === 'medicines'">@for (row of section.rows; track $index) { <div class="history-clinical-row">@if (row.label) { <span class="history-row-label">{{ row.label }}</span> }<p>{{ row.value }}</p>@if (row.details.length) { <div class="history-row-details">@for (detail of row.details; track $index) { <span>{{ detail }}</span> }</div> }</div> }</div>
                                }
                              </section>
                            } @empty { <div class="history-empty"><h3>No clinical notes recorded</h3><p>This visit has no documented clinical details.</p></div> }
                            @if (item.record.notes.trim()) { <details class="history-original"><summary>View original clinical note</summary><p>{{ item.record.notes }}</p></details> }
                          </article>
                        }
                      </div>
                    } @else { <div class="history-empty"><h3>No previous visits</h3><p>Earlier consultations will appear here when they are recorded.</p></div> }
                  } @else { <div class="history-empty" role="status"><h3>Loading visit history…</h3><p>Retrieving this patient's consultation records.</p></div> }
                }
                @case ('results') {
                  <div class="history-results"><div class="history-detail-heading"><div><p class="history-eyebrow">LABORATORY</p><h3>Lab reports</h3><p>Download complete, verified reports with all test results and reference ranges.</p></div></div>
                    @if (labReportErrors()[visit.appointment.patientId]) {
                      <div class="history-empty" role="alert"><h3>Unable to load lab reports</h3><p>Please retry to retrieve this patient's released reports.</p><button type="button" class="ac-btn ac-btn-secondary" (click)="loadLabReports(visit.appointment.patientId)">Retry</button></div>
                    } @else {
                      @for (report of patientLabReports()[visit.appointment.patientId] || []; track report.id) {
                        <article class="history-document-card history-lab-report"><span class="history-document-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></svg></span><div class="history-report-info"><span class="history-status" data-status-tone="success">Verified report · PDF</span><h4>{{ report.reportNumber }}</h4><p>Order {{ report.orderNumber }} · Version {{ report.currentVersion }}</p><small>Released {{ report.releasedAt | date:'dd MMM yyyy, h:mm a' }}</small></div><button type="button" class="ac-btn ac-btn-primary history-report-download" [disabled]="downloadingReports().includes(report.id)" [attr.aria-label]="'Download PDF for report ' + report.reportNumber" (click)="downloadLabReport(report)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" /></svg>{{ downloadingReports().includes(report.id) ? 'Downloading…' : 'Download PDF' }}</button></article>
                      } @empty { <div class="history-empty" role="status"><h3>{{ patientLabReports()[visit.appointment.patientId] ? 'No released reports yet' : 'Loading lab reports…' }}</h3><p>Downloadable reports appear after the laboratory verifies and releases the complete order.</p></div> }
                    }
                  </div>
                }
                @case ('documents') {
                  <div class="history-results"><div class="history-detail-heading"><div><p class="history-eyebrow">IMAGING</p><h3>Radiology documents</h3><p>Documents recorded in this patient's profile.</p></div></div>
                    @for (document of radiologyDocuments(visit); track document.documentGuid) { <article class="history-document-card"><span class="history-document-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></svg></span><div><h4>{{ document.documentName }}</h4><p>{{ document.documentType }}</p><small>Uploaded {{ document.uploadedDate | date:'dd MMM yyyy' }}</small></div></article> } @empty { <div class="history-empty"><h3>No imaging documents</h3><p>Radiology documents will appear here after they are added to the patient record.</p></div> }
                  </div>
                }
              }
            </div>
            <footer class="history-footer"><span>Historical records · {{ visit.patientMrn }}</span><button type="button" class="ac-btn ac-btn-secondary" (click)="historyVisit.set(null)">Back to OPD</button></footer>
          </aside>
        </div>
      }
      @if (reviewOpen() && selectedVisit(); as visit) {
        <div class="opd-overlay">
          <section class="completion-review" role="dialog" aria-modal="true" aria-labelledby="opd-review-title" cdkTrapFocus [cdkTrapFocusAutoCapture]="true" (keydown.escape)="!saving() && reviewOpen.set(false)">
            <header><div><h2 id="opd-review-title">Review consultation</h2><p>{{ visit.patientName }} · {{ visit.patientMrn }}</p></div><button type="button" class="ac-btn ac-btn-secondary" cdkFocusInitial [disabled]="saving()" (click)="reviewOpen.set(false)">Back to editing</button></header>
            @for (section of completionSummary().sections; track section.title) { <section class="summary-section"><h3>{{ section.title }}</h3>@for (item of section.items; track item) { <p>{{ item }}</p> }</section> }
            @if (pendingCompletionLabs()) { <div class="draft-conflict" role="alert"><p>{{ pendingCompletionLabs() }} laboratory tests have not been submitted.</p><button type="button" class="ac-btn ac-btn-secondary" [disabled]="saving()" (click)="createLabOrder(visit)">Submit selected tests</button></div> }
            <p>Completing closes this clinical record, saves the follow-up plan, and prepares billing. Selected laboratory tests must be submitted before completion.</p>
            @if (pharmacyIntegrationEnabled() && clinicalForm().prescriptions.length) { <label class="check-field"><input type="checkbox" [ngModel]="sendToPharmacyOnComplete()" (ngModelChange)="sendToPharmacyOnComplete.set($event)" [disabled]="saving() || pharmacyConfigurationError()" /> Send prescription to pharmacy before completing</label> }
            <footer><button type="button" class="ac-btn ac-btn-secondary" [disabled]="saving()" (click)="reviewOpen.set(false)">Continue editing</button><button type="button" class="ac-btn ac-btn-primary" [disabled]="saving() || pendingCompletionLabs() > 0" (click)="completeVisit()">{{ saving() ? 'Saving…' : 'Complete Consultation' }}</button></footer>
          </section>
        </div>
      }
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
                  <span aria-hidden="true" class="material-symbols-rounded">close</span>
                </button>
              </header>

              <div class="prescription-paper rx-sheet">
                <header class="rx-sheet-head">
                  <div class="rx-logo-mark">
                    <span aria-hidden="true" class="material-symbols-rounded">ecg_heart</span>
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
                  <span aria-hidden="true" class="material-symbols-rounded">ios_share</span>
                  Share to Patient
                </button>
                <button class="ac-btn ac-btn-secondary" type="button" (click)="downloadPrescription()">
                  <span aria-hidden="true" class="material-symbols-rounded">download</span>
                  Download PDF
                </button>
                <button class="ac-btn ac-btn-primary" type="button" (click)="printPrescription(false)">
                  <span aria-hidden="true" class="material-symbols-rounded">print</span>
                  Print Prescription
                </button>
              </footer>
            </section>
          </div>
        }
      }

      @if (allergyReviewOpen()) {
        <div class="prescription-backdrop" (click)="cancelAllergyReview()">
          <section class="print-options-modal interaction-review-modal" (click)="$event.stopPropagation()" aria-label="Allergy alert review">
            <header><div><p class="ac-eyebrow">Allergy Alert</p><h2>Patient Allergy Match</h2><span>The prescribed medication matches an active Patient Profile allergy.</span></div><button class="modal-close" type="button" aria-label="Close allergy review" (click)="cancelAllergyReview()"><span aria-hidden="true" class="material-symbols-rounded">close</span></button></header>
            <div class="interaction-alert-list">
              @for (alert of allergyAlerts(); track alert.mappingId + alert.patientAllergyId + alert.medicineId) {
                <article class="allergy-alert" [class.blocking]="alert.behaviorCode==='BLOCK'">
                  <div class="interaction-alert-head"><span aria-hidden="true" class="material-symbols-rounded">emergency_home</span><div><strong>{{ alert.allergenName }} allergy → {{ alert.medicineName }} {{ alert.medicineStrength }}</strong><small>{{ alert.allergySeverity || 'Severity not recorded' }}{{ alert.isCritical ? ' · Critical' : '' }} · {{ interactionLabel(alert.behaviorCode) }}</small></div></div>
                  @if (alert.reaction) { <p><strong>Recorded reaction:</strong> {{ alert.reaction }}</p> }
                  <div class="clinical-recommendation"><strong>Clinical recommendation</strong><span>{{ alert.clinicalRecommendation }}</span></div>
                </article>
              }
            </div>
            @if (!hasBlockingAllergy()) { <label class="field interaction-reason"><span>Clinical override reason *</span><textarea rows="3" [(ngModel)]="allergyOverrideReason" placeholder="Document why the medication is still required and the monitoring or mitigation plan..."></textarea><small>Your identity, patient, medicine, allergy, encounter, and reason will be audited.</small></label> }
            @if (hasBlockingAllergy()) { <div class="interaction-stop"><span aria-hidden="true" class="material-symbols-rounded">gpp_bad</span><div><strong>This allergy rule cannot be overridden</strong><small>Cancel and replace the medication before issuing the prescription.</small></div></div> }
            <footer><button class="ac-btn ac-btn-secondary" type="button" (click)="cancelAllergyReview()">Cancel</button><button class="ac-btn ac-btn-primary" type="button" [disabled]="hasBlockingAllergy() || saving() || allergyOverrideReason.trim().length < 5" (click)="continueAfterAllergyReview()"><span aria-hidden="true" class="material-symbols-rounded">approval</span>{{ saving() ? 'Recording...' : 'Override with Reason' }}</button></footer>
          </section>
        </div>
      }

      @if (interactionReviewOpen()) {
        <div class="prescription-backdrop" (click)="cancelInteractionReview()">
          <section class="print-options-modal interaction-review-modal" (click)="$event.stopPropagation()" aria-label="Drug interaction review">
            <header>
              <div><p class="ac-eyebrow">Medication Safety</p><h2>Potential Drug Interactions</h2><span>{{ interactionAlerts().length }} clinical {{ interactionAlerts().length === 1 ? 'rule' : 'rules' }} matched this prescription</span></div>
              <button class="modal-close" type="button" aria-label="Close interaction review" (click)="cancelInteractionReview()"><span aria-hidden="true" class="material-symbols-rounded">close</span></button>
            </header>
            <div class="interaction-alert-list">
              @for (alert of interactionAlerts(); track alert.interactionId + alert.medicineAId + alert.medicineBId) {
                <article [class.blocking]="alert.behaviorCode==='BLOCK'" [class.override]="alert.behaviorCode==='REQUIRE_OVERRIDE'">
                  <div class="interaction-alert-head"><span aria-hidden="true" class="material-symbols-rounded">{{ alert.behaviorCode==='BLOCK' ? 'block' : alert.behaviorCode==='REQUIRE_OVERRIDE' ? 'approval' : 'warning' }}</span><div><strong>{{ alert.medicineAName }} {{ alert.medicineAStrength }} + {{ alert.medicineBName }} {{ alert.medicineBStrength }}</strong><small>{{ interactionLabel(alert.severity) }} · {{ interactionLabel(alert.behaviorCode) }}</small></div></div>
                  <p>{{ alert.description }}</p><div class="clinical-recommendation"><strong>Clinical recommendation</strong><span>{{ alert.clinicalRecommendation }}</span></div>
                </article>
              }
            </div>
            @if (requiresInteractionOverride() && !hasBlockingInteraction()) {
              <label class="field interaction-reason"><span>Clinical override reason *</span><textarea rows="3" [(ngModel)]="interactionOverrideReason" placeholder="Document why the expected benefit outweighs the interaction risk..."></textarea><small>This reason and your identity will be stored in the medication-safety audit trail.</small></label>
            }
            @if (hasBlockingInteraction()) { <div class="interaction-stop"><span aria-hidden="true" class="material-symbols-rounded">gpp_bad</span><div><strong>Prescription cannot be issued</strong><small>Remove or replace the blocked medicine combination, then run the safety check again.</small></div></div> }
            <footer><button class="ac-btn ac-btn-secondary" type="button" (click)="cancelInteractionReview()">Return to prescription</button><button class="ac-btn ac-btn-primary" type="button" [disabled]="hasBlockingInteraction() || saving() || (requiresInteractionOverride() && interactionOverrideReason.trim().length < 5)" (click)="continueAfterInteractionReview()"><span aria-hidden="true" class="material-symbols-rounded">{{ requiresInteractionOverride() ? 'approval' : 'check_circle' }}</span>{{ saving() ? 'Recording...' : requiresInteractionOverride() ? 'Override & Continue' : 'Acknowledge & Continue' }}</button></footer>
          </section>
        </div>
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
                <span aria-hidden="true" class="material-symbols-rounded">close</span>
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
                <span aria-hidden="true" class="material-symbols-rounded">save</span>
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
                <span aria-hidden="true" class="material-symbols-rounded">close</span>
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
                <span aria-hidden="true" class="material-symbols-rounded">print</span>
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
              <span><span class="consultation-status" [ngClass]="consultationStatusClass(visit)">{{ consultationStatusLabel(visit) }}</span></span>
              <span>
                <button class="ac-btn ac-btn-secondary" type="button" (click)="selectVisit(visit, 'encounter')">
                  <span aria-hidden="true" class="material-symbols-rounded">clinical_notes</span>
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
    .history-visit { padding: 16px; margin-top: 12px; border: 1px solid var(--ac-border); border-radius: 12px; overflow-wrap: anywhere; }
    .history-visit h4 { margin: 12px 0 4px; }
    .completion-banner { display: flex; gap: 10px; padding: 16px; background: #ecfdf5; color: #065f46; }
    :host { display: block; min-width: 0; }
    .opd-page { width: 100%; max-width: 100%; min-width: 0; display: grid; gap: 10px; overflow-x: hidden; }
    .page-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .page-desc { margin: 3px 0 0; max-width: 760px; color: var(--ac-muted); font-size: 13px; }
    .header-actions, .queue-actions, .encounter-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .stats-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
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
    .opd-page * { letter-spacing: 0; }
    .quick-action-bar {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--ac-subtle) 72%, var(--ac-surface));
    }
    .quick-action-bar button {
      min-width: 0;
      min-height: 42px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      padding: 7px 10px;
      background: var(--ac-surface);
      color: var(--ac-text);
      font: inherit;
      font-size: 12px;
      font-weight: 850;
      text-align: left;
      cursor: pointer;
    }
    .quick-action-bar button:hover, .quick-action-bar button.active {
      border-color: color-mix(in srgb, var(--ac-primary) 42%, var(--ac-border));
      background: color-mix(in srgb, var(--ac-primary) 7%, var(--ac-surface));
      color: var(--ac-primary);
      box-shadow: 0 8px 18px rgba(15, 23, 42, .06);
    }
    .quick-action-bar button:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
    .quick-action-bar .material-symbols-rounded { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--ac-primary-light); font-size: 17px; }
    .quick-action-bar span:not(.material-symbols-rounded) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quick-action-bar strong { min-width: 24px; min-height: 22px; display: inline-grid; place-items: center; border-radius: 999px; background: var(--ac-subtle); color: var(--ac-muted); font-size: 11px; font-weight: 950; }
    .spin { animation: spin 900ms linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { min-height: 240px; display: grid; place-items: center; align-content: center; gap: 10px; color: var(--ac-muted); text-align: center; }
    .empty-state.compact { min-height: 56px; border: 1px dashed var(--ac-border); border-radius: 10px; background: var(--ac-subtle); font-weight: 850; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .opd-today-grid { min-width: 0; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(360px, .85fr); gap: 10px; align-items: start; }
    .today-queue-panel, .encounter-focus-panel { min-height: 520px; display: grid; align-content: start; gap: 12px; }
    .panel-topline { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .panel-topline h2 { margin: 0; color: var(--ac-text); font-size: 22px; line-height: 1.15; }
    .panel-topline span { display: block; margin-top: 4px; color: var(--ac-muted); font-size: 12px; font-weight: 800; overflow-wrap: anywhere; }
    .queue-flow-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .flow-step {
      min-width: 0;
      min-height: 82px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 3px 8px;
      align-content: center;
      align-items: center;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      padding: 10px;
      background: var(--ac-surface);
      color: var(--ac-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .flow-step:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(15, 23, 42, .06); }
    .flow-step .material-symbols-rounded { grid-row: span 2; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; font-size: 18px; }
    .flow-step small { min-width: 0; color: var(--ac-muted); font-size: 11px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .flow-step strong { min-width: 0; color: var(--ac-text); font-size: 24px; line-height: 1; }
    .flow-step.waiting .material-symbols-rounded { background: var(--ac-primary-light); color: var(--ac-primary); }
    .flow-step.active .material-symbols-rounded { background: #f0fdfa; color: #0f766e; }
    .flow-step.completed .material-symbols-rounded { background: #ecfdf5; color: #047857; }
    .flow-step.danger .material-symbols-rounded { background: #fff1f2; color: #e11d48; }
    .simple-queue-list { display: grid; gap: 7px; max-height: 372px; overflow: auto; padding-right: 2px; }
    .simple-queue-row {
      min-width: 0;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      padding: 9px 10px;
      background: var(--ac-surface);
      color: var(--ac-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .simple-queue-row:hover, .simple-queue-row.selected {
      border-color: color-mix(in srgb, var(--ac-primary) 42%, var(--ac-border));
      background: color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface));
      box-shadow: 0 8px 18px rgba(15, 23, 42, .05);
    }
    .patient-cell, .doctor-cell { min-width: 0; display: grid; gap: 3px; }
    .patient-cell strong, .doctor-cell strong { min-width: 0; color: var(--ac-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .patient-cell small, .doctor-cell small { min-width: 0; color: var(--ac-muted); font-size: 11.5px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .patient-focus-panel { display: grid; gap: 16px; }
    .encounter-focus-panel { position: sticky; top: 10px; }
    .focus-head { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
    .patient-avatar { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 8px; background: linear-gradient(135deg, var(--ac-primary), #0f766e); color: white; font-size: 15px; font-weight: 950; }
    .focus-head h2 { margin: 0; color: var(--ac-text); font-size: 21px; line-height: 1.15; overflow-wrap: anywhere; }
    .focus-head span:not(.status-badge) { color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .focus-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .focus-details span, .clinical-summary-card {
      min-width: 0;
      display: grid;
      gap: 4px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      padding: 10px;
      background: color-mix(in srgb, var(--ac-subtle) 58%, var(--ac-surface));
    }
    .focus-details small { color: var(--ac-muted); font-size: 10.5px; font-weight: 900; text-transform: uppercase; }
    .focus-details strong { color: var(--ac-text); overflow-wrap: anywhere; }
    .clinical-summary-card h3 { margin: 0; color: var(--ac-text); font-size: 15px; }
    .clinical-summary-card p { margin: 0; color: var(--ac-muted); line-height: 1.45; font-size: 12px; font-weight: 760; }
    .summary-card-head { min-width: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .summary-card-head > div { min-width: 0; display: grid; gap: 3px; }
    .summary-card-head > span {
      flex: 0 0 auto;
      min-height: 24px;
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ac-primary) 10%, var(--ac-surface));
      color: var(--ac-primary);
      font-size: 10.5px;
      font-weight: 900;
    }
    .summary-section-grid { display: grid; gap: 8px; margin-top: 8px; }
    .summary-section {
      min-width: 0;
      display: grid;
      gap: 7px;
      padding: 9px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 78%, transparent);
      border-radius: 8px;
      background: var(--ac-surface);
    }
    .summary-section-title { min-width: 0; display: flex; align-items: center; gap: 7px; color: var(--ac-text); }
    .summary-section-title span {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border-radius: 7px;
      background: color-mix(in srgb, var(--ac-primary) 11%, var(--ac-surface));
      color: var(--ac-primary);
      font-size: 16px;
    }
    .summary-section-title strong { min-width: 0; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .summary-chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .summary-chip-list span {
      max-width: 100%;
      min-height: 26px;
      display: inline-flex;
      align-items: center;
      padding: 5px 8px;
      border-radius: 7px;
      background: var(--ac-subtle);
      color: var(--ac-text);
      font-size: 11.5px;
      font-weight: 820;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .summary-empty {
      min-height: 108px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      margin-top: 8px;
      border: 1px dashed var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      text-align: center;
    }
    .summary-empty span { color: var(--ac-primary); font-size: 24px; }
    .summary-empty p { max-width: 320px; }
    .focus-action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: auto; }
    .focus-action-grid .ac-btn { justify-content: center; min-width: 0; }
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
    .progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--ac-primary), #10b981); transition: width .24s ease; }
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
    .queue-lane.waiting { background: var(--ac-primary-light); border-color: #bfdbfe; }
    .queue-lane.active { background: #f0fdfa; border-color: #99f6e4; }
    .queue-lane.complete { background: #ecfdf5; border-color: #bbf7d0; }
    .dashboard-visit-list { max-height: 220px; overflow: auto; padding-right: 2px; }
    .compact-list, .queue-workspace { display: grid; gap: 8px; }
    .visit-row { width: 100%; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; align-items: center; border: 1px solid var(--ac-border); border-radius: 9px; padding: 8px 9px; background: color-mix(in srgb, var(--ac-surface) 88%, transparent); color: var(--ac-text); text-align: left; cursor: pointer; }
    .encounter-list button { width: 100%; min-width: 0; display: grid; gap: 3px; align-content: center; border: 1px solid var(--ac-border); border-radius: 9px; padding: 10px 12px; background: var(--ac-surface); color: var(--ac-text); text-align: left; cursor: pointer; }
    .visit-row:hover, .encounter-list button:hover, .encounter-list button.active { border-color: color-mix(in srgb, var(--ac-primary) 38%, var(--ac-border)); box-shadow: 0 8px 18px color-mix(in srgb, var(--ac-primary) 8%, transparent); }
    .visit-row strong, .encounter-list button strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .visit-row small { grid-column: 2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
    .encounter-list button small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
    .token-pill { width: fit-content; border-radius: 999px; padding: 3px 8px; background: var(--ac-primary-light); color: var(--ac-primary-hover); font-size: 10.5px; font-weight: 900; }
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
    .queue-status.waiting { background: var(--ac-primary-light); color: var(--ac-primary-hover); }
    .queue-status.skipped { background: #fffbeb; color: #b45309; }
    .queue-status.active { background: #f0fdfa; color: #0f766e; }
    .visit-table {
      display: block;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      overflow-x: auto;
      background: var(--ac-surface);
      box-shadow: 0 8px 18px rgba(15, 23, 42, .035);
    }
    .table-head,
    .table-row {
      display: grid;
      grid-template-columns: minmax(118px, .8fr) minmax(220px, 1.45fr) minmax(210px, 1.35fr) minmax(150px, .85fr) minmax(180px, auto);
      gap: 12px;
      align-items: center;
      min-width: 920px;
      padding: 12px 18px;
    }
    .table-head {
      min-height: 44px;
      background: var(--ac-subtle);
      color: var(--ac-muted);
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 900;
      letter-spacing: .04em;
    }
    .table-row {
      min-height: 66px;
      border-top: 1px solid var(--ac-border);
      background: var(--ac-surface);
    }
    .table-row:hover { background: color-mix(in srgb, var(--ac-primary) 3%, var(--ac-surface)); }
    .table-row > span {
      min-width: 0;
      display: grid;
      align-content: center;
    }
    .table-row > span:last-child { justify-content: end; }
    .table-row strong,
    .table-row small {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .table-row strong { color: var(--ac-text); font-size: 13.5px; font-weight: 850; }
    .table-row small { margin-top: 3px; font-size: 12px; }
    .visit-table .ac-btn {
      min-height: 36px;
      padding: 0 14px;
      border-radius: 9px;
      white-space: nowrap;
      justify-content: center;
    }
    .consultation-status {
      width: fit-content;
      min-height: 26px;
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 10px;
      background: var(--ac-subtle);
      color: var(--ac-muted);
      font-size: 11.5px;
      font-weight: 900;
      white-space: nowrap;
    }
    .consultation-status.active { background: var(--ac-primary-light); color: var(--ac-primary-hover); }
    .consultation-status.draft { background: #fffbeb; color: #b45309; }
    .consultation-status.completed { background: #ecfdf5; color: #047857; }
    .consultation-status.cancelled { background: #fef2f2; color: #dc2626; }
    .encounter-layout { min-width: 0; display: grid; grid-template-columns: 1fr; gap: 12px; align-items: start; }
    .encounter-list { display: grid; gap: 10px; padding: 12px; overflow: hidden; }
    .encounter-list-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .encounter-list-head h2 { margin: 0; font-size: 18px; }
    .encounter-list-head span { min-height: 26px; display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 9px; background: var(--ac-primary-light); color: var(--ac-primary); font-size: 11.5px; font-weight: 900; white-space: nowrap; }
    .encounter-switcher-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
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
    .encounter-workflow-stepper {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(9, minmax(92px, 1fr));
      gap: 0;
      padding: 14px 16px 12px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
      box-shadow: 0 12px 28px rgba(15, 23, 42, .05);
      overflow-x: auto;
    }
    .encounter-workflow-stepper button {
      position: relative;
      min-width: 92px;
      min-height: 84px;
      display: grid;
      justify-items: center;
      align-content: start;
      gap: 9px;
      border: 0;
      background: transparent;
      color: var(--ac-muted);
      font: inherit;
      cursor: pointer;
    }
    .encounter-workflow-stepper button::before {
      content: '';
      position: absolute;
      top: 20px;
      left: calc(50% + 26px);
      right: calc(-50% + 26px);
      z-index: 0;
      height: 2px;
      background: var(--ac-border);
      transform: translateY(-50%);
    }
    .encounter-workflow-stepper button:last-child::before { display: none; }
    .encounter-workflow-stepper button.completed::before {
      background: color-mix(in srgb, #0f766e 58%, var(--ac-border));
    }
    .encounter-workflow-stepper button.active::before {
      background: color-mix(in srgb, var(--ac-primary) 52%, var(--ac-border));
    }
    .encounter-workflow-stepper button:disabled { cursor: wait; opacity: .72; }
    .step-number {
      position: relative;
      z-index: 1;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      border: 2px solid var(--ac-border);
      background: var(--ac-subtle);
      color: var(--ac-muted);
      font-size: 14px;
      font-weight: 950;
      box-shadow:
        0 0 0 8px var(--ac-surface),
        0 8px 16px rgba(15, 23, 42, .06);
    }
    .encounter-workflow-stepper button.completed .step-number,
    .encounter-workflow-stepper button.active .step-number {
      border-color: color-mix(in srgb, var(--ac-primary) 66%, #ffffff);
      background: var(--ac-primary);
      color: #ffffff;
    }
    .encounter-workflow-stepper button.completed .step-number {
      background: linear-gradient(135deg, #0f766e, #059669);
      border-color: #0f766e;
      color: #ffffff;
      box-shadow:
        0 0 0 8px var(--ac-surface),
        0 10px 20px color-mix(in srgb, #0f766e 24%, transparent);
    }
    .step-copy {
      min-width: 0;
      display: grid;
      gap: 2px;
      justify-items: center;
      text-align: center;
      line-height: 1.2;
    }
    .step-copy strong {
      max-width: 112px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ac-text);
      font-size: 11.5px;
      font-weight: 950;
    }
    .step-copy small {
      max-width: 112px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ac-muted);
      font-size: 10.5px;
      font-weight: 850;
    }
    .encounter-workflow-stepper button.active .step-copy strong,
    .encounter-workflow-stepper button.active .step-copy small { color: var(--ac-primary); }
    .encounter-workflow-stepper button.completed .step-copy strong,
    .encounter-workflow-stepper button.completed .step-copy small { color: #047857; }
    .section-panel { min-width: 0; min-height: 360px; padding: 14px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface); overflow: hidden; }
    .encounter-workflow-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-subtle) 58%, var(--ac-surface));
    }
    .encounter-workflow-footer .ac-btn { min-width: 132px; justify-content: center; }
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
    .medicine-catalog-help { color: var(--ac-muted); font-size: 11px; line-height: 1.5; }
    .medicine-validation-error, .medicine-table-row .medicine-validation-error { color: var(--ac-error-text); font-size: 11px; line-height: 1.5; }
    .medicine-validation-error button { color: var(--ac-primary); text-decoration: underline; font: inherit; }
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
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--ac-primary) 14%, var(--ac-border));
    }
    .prescription-action-status > div:first-child { min-width: 0; display: grid; gap: 5px; }
    .prescription-action-status strong {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ac-text);
      font-size: 18px;
      line-height: 1.2;
    }
    .prescription-action-meta {
      min-width: 0;
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 6px;
    }
    .prescription-action-meta span {
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
      background: var(--ac-primary);
      box-shadow: 0 0 0 4px rgba(37, 99, 235, .14);
    }
    .prescription-action-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(184px, 1fr));
      gap: 8px;
    }
    .prescription-workflow-actions {
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    }
    .prescription-output-actions {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      padding-top: 2px;
    }
    .prescription-action-grid .ac-btn {
      width: 100%;
      min-width: 0;
      min-height: 44px;
      justify-content: center;
      padding: 10px 12px;
      line-height: 1.2;
      white-space: normal;
      text-align: center;
    }
    .prescription-action-grid .complete-action {
      background: linear-gradient(135deg, var(--ac-primary), #0f766e);
      border-color: color-mix(in srgb, #0f766e 34%, var(--ac-primary));
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
    .interaction-review-modal { width: min(760px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow: auto; }
    .interaction-review-modal header span { display: block; color: var(--ac-muted); margin-top: 4px; }
    .interaction-alert-list { display: grid; gap: 12px; padding: 18px 22px; }
    .interaction-alert-list article { border: 1px solid #d8e2ec; border-left: 4px solid #e9a23b; border-radius: 12px; padding: 14px; background: var(--ac-surface); }
    .interaction-alert-list article.blocking { border-left-color: #d43d51; background: #fff7f8; }
    .interaction-alert-list article.override { border-left-color: #c67a15; background: #fffbf3; }
    .interaction-alert-head { display: flex; gap: 10px; align-items: flex-start; }
    .interaction-alert-head > span { color: #b15d14; }
    .interaction-alert-head div { display: grid; gap: 3px; }
    .interaction-alert-head small { color: var(--ac-muted); font-weight: 700; }
    .interaction-alert-list p { margin: 11px 0; color: var(--ac-text-3); }
    .clinical-recommendation { display: grid; gap: 3px; border-radius: 8px; padding: 10px; background: #eef6fa; color: #23425a; }
    .interaction-reason { margin: 0 22px 18px; }
    .interaction-reason textarea { width: 100%; resize: vertical; }
    .interaction-reason small { display: block; color: var(--ac-muted); margin-top: 5px; }
    .interaction-stop { display: flex; gap: 10px; margin: 0 22px 18px; padding: 13px; border-radius: 10px; background: #fdecef; color: #9f1f35; }
    .interaction-stop div { display: grid; gap: 3px; }

    @media (max-width: 1480px) {
      .encounter-list { padding: 10px; }
      .encounter-card { padding: 12px; }
      .encounter-head h2 { font-size: 23px; }
    }
    @media (max-width: 1180px) {
      .stats-row, .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .opd-today-grid { grid-template-columns: 1fr; }
      .encounter-focus-panel { position: static; min-height: 0; }
      .quick-action-bar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .simple-queue-list { max-height: none; }
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
      .quick-action-bar, .queue-flow-strip, .focus-details, .focus-action-grid { grid-template-columns: 1fr; }
      .quick-action-bar button { min-height: 44px; }
      .panel-topline, .focus-head { grid-template-columns: 1fr; display: grid; }
      .panel-topline .ac-btn { width: 100%; justify-content: center; }
      .simple-queue-row { grid-template-columns: 1fr; }
      .simple-queue-row .queue-status { width: fit-content; }
      .command-panel { grid-column: auto; }
      .command-head { display: grid; }
      .command-score { width: fit-content; min-width: 64px; }
      .opd-shell { padding: 10px; }
      .opd-tabs button { flex: 1 1 150px; justify-content: center; }
      .encounter-workflow-stepper { padding: 12px; grid-template-columns: repeat(9, minmax(86px, 1fr)); }
      .encounter-workflow-stepper button { min-width: 86px; min-height: 76px; }
      .step-copy strong, .step-copy small { max-width: 92px; }
      .encounter-workflow-footer { display: grid; grid-template-columns: 1fr; }
      .encounter-workflow-footer .ac-btn { width: 100%; }
      .encounter-head { display: grid; }
      .status-badge { width: fit-content; }
      .section-panel, .prescription-header-card, .clinical-info-card, .prescription-vitals-card, .medicine-composer, .prescription-extra-card, .prescription-template-panel, .prescription-action-bar { padding: 12px; }
      .prescription-action-status { grid-template-columns: 1fr; align-items: stretch; }
      .prescription-action-meta { justify-content: flex-start; }
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
    /* Doctor consultation workspace: one page, clear hierarchy, accessible controls. */
    .opd-page { font-size: 15px; }
    .opd-shell { overflow: visible; padding: 16px; }
    .encounter-card, .clinical-board { overflow: visible; }
    .encounter-head { position: sticky; top: 0; z-index: 12; background: var(--ac-surface); padding: 16px; border-bottom: 1px solid var(--ac-border); box-shadow: 0 2px 8px #0f172a0a; }
    .encounter-head h2 { font-size: 22px; }
    .patient-allergy { margin: 8px 0 0; font-weight: 650; color: var(--ac-text); }
    .patient-snapshot { background: var(--ac-surface); top: 120px; padding: 18px; border-color: var(--ac-border); }
    .patient-snapshot p { margin: 0; line-height: 1.65; overflow-wrap: anywhere; }
    .patient-snapshot small { line-height: 1.5; }
    .consultation-jump-links { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 0; }
    .consultation-jump-links button { padding: 10px 18px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text); font: inherit; font-weight: 650; cursor: pointer; min-height: 44px; }
    .consultation-fields { min-width: 0; border: 0; padding: 0; margin: 0; display: grid; gap: 24px; }
    .consultation-group { scroll-margin-top: 140px; min-width: 0; padding: 24px; background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 12px; display: grid; gap: 20px; }
    .group-heading { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--ac-border); }
    .group-heading > span { display: grid; place-items: center; flex: 0 0 32px; height: 32px; border-radius: 8px; background: var(--ac-primary-soft, var(--ac-primary-light)); color: var(--ac-primary); font-weight: 750; }
    .group-heading h2 { margin: 0 0 6px; font-size: 20px; }
    .group-heading p { margin: 0; color: var(--ac-text-muted); line-height: 1.5; }
    .consultation-group .clinical-section, .consultation-group .medicine-composer, .consultation-group .prescription-extra-card { background: var(--ac-surface); box-shadow: none; }
    .consultation-group .clinical-grid { gap: 14px; }
    .consultation-group .field > span, .consultation-group .check-field { color: var(--ac-text); font-size: 14px; }
    .consultation-group input, .consultation-group textarea { font-size: 15px; min-height: 44px; }
    .consultation-group input[type="checkbox"], .consultation-group input[type="radio"] { min-height: auto; }
    .optional-section, .treatment-templates { border: 1px solid var(--ac-border); border-radius: 8px; padding: 12px 16px; min-width: 0; }
    .optional-section > summary, .treatment-templates > summary { cursor: pointer; min-height: 32px; font-weight: 650; line-height: 1.6; }
    .optional-section[open] > summary, .treatment-templates[open] > summary { margin-bottom: 18px; }
    .consultation-footer { position: sticky; bottom: 0; z-index: 15; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--ac-border); background: var(--ac-surface); border-radius: 10px; box-shadow: 0 -3px 14px #0f172a0c; }
    .draft-status { margin-right: auto; font-size: 14px; color: var(--ac-text); }
    .draft-conflict { padding: 16px; border: 1px solid #b45309; border-radius: 8px; color: #78350f; background: #fffbeb; line-height: 1.6; }
    .draft-conflict .ac-btn { margin: 6px 8px 0 0; }
    .opd-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 24px; background: #0f172a80; }
    .history-drawer, .completion-review { background: var(--ac-surface); color: var(--ac-text); padding: 24px; border-radius: 12px; width: min(760px, 100%); max-height: calc(100dvh - 48px); overflow-y: auto; overscroll-behavior: contain; }
    .history-drawer { width: min(540px, 100%); margin-left: auto; height: 100%; }
    .opd-overlay header, .completion-review footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
    .completion-review footer { position: sticky; bottom: -24px; background: var(--ac-surface); padding: 16px 0; border-top: 1px solid var(--ac-border); }
    .opd-overlay h2 { margin: 0; font-size: 22px; }
    .opd-overlay h3 { font-size: 16px; margin-top: 24px; }
    .completion-banner { flex-wrap: wrap; }
    .opd-page button:focus-visible, .opd-page input:focus-visible, .opd-page textarea:focus-visible, summary:focus-visible, .opd-overlay button:focus-visible { outline: 3px solid var(--ac-primary); outline-offset: 3px; }
    .opd-page .ac-btn, .opd-overlay .ac-btn { min-height: 44px; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
    @media (max-width: 1100px) { .encounter-workspace { grid-template-columns: 1fr; } .patient-snapshot { position: static; } }
    @media (max-width: 640px) { .opd-shell, .consultation-group { padding: 12px; } .consultation-footer { gap: 8px; } .draft-status { flex-basis: 100%; } .consultation-footer .ac-btn { flex: 1; } .opd-overlay { padding: 12px; } .history-drawer, .completion-review { padding: 16px; max-height: calc(100dvh - 24px); } .encounter-head { top: 0; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; } }
    .history-overlay { padding: 16px; justify-content: flex-end; }
    .history-drawer { display: flex; flex-direction: column; width: min(1040px, 100%); height: calc(100dvh - 32px); max-height: calc(100dvh - 32px); padding: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 70px #0f172a40; }
    .history-drawer .history-header { flex: 0 0 auto; padding: 22px 28px; border-bottom: 1px solid var(--ac-border); flex-wrap: nowrap; }
    .history-heading { display: flex; gap: 12px; align-items: center; }
    .history-heading-icon { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; background: var(--ac-primary-light); color: var(--ac-primary); border-radius: 12px; }
    .history-heading-icon svg { width: 25px; height: 25px; }
    .history-drawer .history-eyebrow { margin: 0 0 6px; font-size: 10px; font-weight: 750; letter-spacing: .1em; color: var(--ac-muted); }
    .history-drawer h2 { font-size: 21px; letter-spacing: -.025em; }
    .history-close { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); color: var(--ac-muted); flex-shrink: 0; cursor: pointer; }
    .history-close svg { width: 20px; height: 20px; }
    .history-close:hover { background: var(--ac-primary-light); color: var(--ac-primary); }
    .history-patient { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 18px 28px; background: var(--ac-bg); }
    .history-avatar { display: grid; place-items: center; height: 42px; width: 42px; flex-shrink: 0; border: 1px solid var(--ac-border); border-radius: 50%; font-weight: 700; color: var(--ac-primary); background: var(--ac-surface); }
    .history-patient strong { font-size: 16px; }
    .history-patient p { margin: 5px 0 0; color: var(--ac-muted); font-size: 13px; }
    .history-patient p span { margin: 0 7px; }
    .history-readonly { margin-left: auto; flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--ac-muted); border: 1px solid var(--ac-border); padding: 5px 9px; border-radius: 6px; background: var(--ac-surface); }
    .history-navigation { flex-shrink: 0; display: flex; gap: 20px; padding: 0 28px; border-bottom: 1px solid var(--ac-border); }
    .history-navigation button { display: flex; gap: 8px; align-items: center; padding: 15px 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--ac-muted); font: inherit; font-size: 13px; font-weight: 650; min-height: 48px; cursor: pointer; }
    .history-navigation button.active { border-bottom-color: var(--ac-primary); color: var(--ac-primary); }
    .history-navigation button > span { border-radius: 5px; padding: 2px 6px; font-size: 10px; color: var(--ac-muted); background: var(--ac-surface-2); }
    .history-navigation button.active > span { color: var(--ac-primary); background: var(--ac-primary-light); }
    .history-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: var(--ac-bg); }
    .history-visits-layout { height: 100%; min-height: 0; display: grid; grid-template-columns: 225px minmax(0, 1fr); }
    .history-timeline, .history-detail { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
    .history-timeline { padding: 24px 16px; border-right: 1px solid var(--ac-border); background: var(--ac-surface); }
    .history-timeline > .history-eyebrow { padding: 0 10px; margin-bottom: 14px; }
    .history-timeline-item { display: flex; flex-direction: column; align-items: flex-start; width: 100%; gap: 8px; padding: 14px; margin-bottom: 10px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); color: var(--ac-text); text-align: left; font: inherit; cursor: pointer; }
    .history-timeline-item, .history-consultation-status { --history-status-accent: var(--ac-muted); --history-status-ink: var(--ac-muted); --history-status-fill: var(--ac-surface-2); }
    .history-timeline-item[data-status-tone="success"], .history-consultation-status[data-status-tone="success"] { --history-status-accent: #16a34a; }
    .history-timeline-item[data-status-tone="pending"], .history-consultation-status[data-status-tone="pending"] { --history-status-accent: #ca8a04; }
    .history-timeline-item[data-status-tone="active"], .history-consultation-status[data-status-tone="active"] { --history-status-accent: #ea580c; }
    .history-timeline-item[data-status-tone], .history-consultation-status[data-status-tone] { --history-status-ink: color-mix(in srgb, var(--history-status-accent) 55%, var(--ac-text)); --history-status-fill: color-mix(in srgb, var(--history-status-accent) 13%, var(--ac-surface)); }
    .history-timeline-item[data-status-tone] { border-color: color-mix(in srgb, var(--history-status-accent) 35%, var(--ac-border)); border-left: 4px solid var(--history-status-accent); background: color-mix(in srgb, var(--history-status-accent) 7%, var(--ac-surface)); }
    .history-timeline-item.selected { outline: 2px solid var(--ac-primary); outline-offset: 2px; box-shadow: 0 2px 8px #0f172a0a; }
    .history-timeline-item:hover { background: color-mix(in srgb, var(--history-status-accent) 12%, var(--ac-surface)); }
    .history-timeline-date { font-size: 13px; font-weight: 750; }
    .history-timeline-item strong { font-size: 12px; font-weight: 600; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
    .history-timeline-item small { font-size: 11px; color: var(--ac-muted); }
    .history-status { display: inline-flex; align-items: center; gap: 6px; width: fit-content; flex-shrink: 0; padding: 5px 8px; border-radius: 6px; background: var(--history-status-fill, var(--ac-surface-2)); color: var(--history-status-ink, var(--ac-muted)); font-size: 11px; font-weight: 700; }
    .history-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--history-status-accent, var(--ac-muted)); }
    .history-consultation-status { padding: 16px; border: 1px solid color-mix(in srgb, var(--history-status-accent) 30%, var(--ac-border)); border-left: 4px solid var(--history-status-accent); border-radius: 10px; background: color-mix(in srgb, var(--history-status-accent) 6%, var(--ac-surface)); }
    .history-detail { min-width: 0; padding: 24px; }
    .history-detail-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 22px; }
    .history-drawer .history-detail-heading h3 { margin: 0; font-size: 18px; letter-spacing: -.015em; line-height: 1.5; }
    .history-detail-heading p:not(.history-eyebrow) { margin: 6px 0 0; font-size: 12px; color: var(--ac-muted); line-height: 1.5; }
    .history-clinical-section { border: 1px solid var(--ac-border); border-radius: 10px; margin-bottom: 16px; background: var(--ac-surface); overflow: hidden; }
    .history-section-heading { display: flex; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--ac-border); }
    .history-section-heading h4 { margin: 0; font-size: 13px; font-weight: 750; }
    .history-section-heading > span { font-size: 11px; color: var(--ac-muted); }
    .history-vitals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin: 0; padding: 8px; }
    .history-vitals > div { padding: 12px; }
    .history-vitals dt { color: var(--ac-muted); font-size: 11px; line-height: 1.5; }
    .history-vitals dd { margin: 5px 0 0; color: var(--ac-text); font-size: 18px; font-weight: 700; overflow-wrap: anywhere; }
    .history-clinical-rows { padding: 0 18px; }
    .history-clinical-row { padding: 13px 0; border-bottom: 1px solid var(--ac-border); }
    .history-clinical-row:last-child { border-bottom: 0; }
    .history-row-label { display: block; margin-bottom: 5px; color: var(--ac-muted); font-size: 11px; font-weight: 600; }
    .history-clinical-row p { margin: 0; font-size: 13px; line-height: 1.7; white-space: pre-line; overflow-wrap: anywhere; }
    .history-medicines .history-clinical-row > p { font-weight: 650; }
    .history-row-details { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .history-row-details span { font-size: 11px; line-height: 1.5; color: var(--ac-muted); background: var(--ac-bg); padding: 4px 7px; border-radius: 5px; border: 1px solid var(--ac-border); overflow-wrap: anywhere; }
    .history-original { padding: 12px 4px; color: var(--ac-muted); font-size: 12px; }
    .history-original summary { cursor: pointer; padding: 8px 0; }
    .history-original p { white-space: pre-wrap; line-height: 1.7; overflow-wrap: anywhere; }
    .history-drawer .history-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 28px; background: var(--ac-surface); border-top: 1px solid var(--ac-border); }
    .history-footer > span { font-size: 11px; color: var(--ac-muted); }
    .history-empty { padding: 56px 24px; text-align: center; color: var(--ac-muted); }
    .history-drawer .history-empty h3 { margin: 0 0 10px; color: var(--ac-text); font-size: 17px; }
    .history-empty p { margin: 0; font-size: 13px; line-height: 1.7; }
    .history-results { max-width: 780px; margin: 0 auto; padding: 28px; }
    .history-document-card h4 { margin: 4px 0 8px; font-size: 14px; overflow-wrap: anywhere; }
    .history-document-card small { color: var(--ac-muted); font-size: 11px; }
    .history-document-card { display: flex; gap: 14px; border: 1px solid var(--ac-border); border-radius: 10px; padding: 18px; margin-bottom: 12px; background: var(--ac-surface); }
    .history-document-icon { display: grid; place-items: center; width: 40px; height: 44px; flex-shrink: 0; background: var(--ac-primary-light); color: var(--ac-primary); border-radius: 8px; }
    .history-document-icon svg { width: 24px; height: 24px; }
    .history-document-card p { margin: 0 0 8px; color: var(--ac-muted); font-size: 12px; }
    .history-lab-report { align-items: center; flex-wrap: wrap; border-left: 4px solid #16a34a; }
    .history-report-info { flex: 1; min-width: 150px; }
    .history-report-info .history-status { color: #166534; background: #dcfce7; }
    .history-report-info h4 { margin-top: 10px; }
    .history-report-download { flex-shrink: 0; min-height: 44px; }
    .history-report-download svg { width: 18px; height: 18px; }
    .history-empty button { margin-top: 16px; }
    @media (max-width: 700px) { .history-report-download { width: 100%; justify-content: center; } }
    .history-context-error { flex-shrink: 0; padding: 10px 28px; background: #fffbeb; color: #78350f; display: flex; align-items: center; gap: 12px; }
    .history-context-error p { margin: 0; font-size: 12px; line-height: 1.5; }
    .history-drawer button:focus-visible, .history-drawer summary:focus-visible { outline: 3px solid var(--ac-primary); outline-offset: 3px; }
    @media (max-width: 700px) { .history-visits-layout { height: auto; min-height: 100%; } .history-detail { overflow: visible; } .history-timeline { overflow-y: hidden; } }
    @media (max-width: 700px) { .history-overlay { padding: 0; } .history-drawer { height: 100dvh; max-height: 100dvh; border-radius: 0; width: 100%; } .history-drawer .history-header, .history-patient { padding: 16px 18px; } .history-heading-icon { width: 38px; height: 38px; } .history-drawer h2 { font-size: 18px; } .history-navigation { padding: 0 18px; gap: 18px; } .history-visits-layout { grid-template-columns: minmax(0, 1fr); } .history-timeline { padding: 16px; border-right: 0; border-bottom: 1px solid var(--ac-border); display: flex; gap: 10px; overflow-x: auto; } .history-timeline > .history-eyebrow { display: none; } .history-timeline-item { flex: 0 0 180px; margin-bottom: 0; } .history-detail, .history-results { padding: 18px; } .history-drawer .history-detail-heading h3 { font-size: 16px; } .history-detail-heading { flex-wrap: wrap; } .history-drawer .history-footer { padding: 12px 18px; } .history-readonly { display: none; } .history-vitals { grid-template-columns: repeat(2, minmax(0, 1fr)); } .history-result-card { grid-template-columns: minmax(0, 1fr); } .history-result-value { align-items: flex-start; } .history-context-error { padding: 12px 18px; } }
    /* Focused consultation: one stage at a time, with patient context always close. */
    .opd-page.consulting { overflow: visible; }
    .consulting > .page-header .page-desc, .consulting > .stats-row { display: none; }
    .consulting > .page-header { margin-bottom: 12px; }
    .consulting > .page-header h1 { font-size: 23px; }
    .consulting .toolbar { display: none; }
    .consulting .opd-shell { padding: 0; border-color: transparent; background: transparent; box-shadow: none; }
    .consulting .opd-tabs { background: var(--ac-surface); margin-bottom: 14px; border: 1px solid var(--ac-border); border-radius: 12px; }
    .encounter-card { padding: 0; border: 0; background: transparent; container-type: normal; }
    .encounter-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px 20px; margin-bottom: 18px; padding: 20px 24px 16px; border: 1px solid var(--ac-border); border-top: 3px solid var(--ac-secondary, #7c3aed); border-radius: 16px; box-shadow: 0 6px 24px #33415508; top: 0; z-index: 25; }
    .encounter-head h2 { margin: 5px 0 7px; font-size: 26px; letter-spacing: -.025em; }
    .encounter-head .ac-eyebrow { margin: 0; }
    .encounter-head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .patient-alert-strip { grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap; }
    .clinical-alert { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 7px 10px; border-radius: 8px; font-size: 12px; background: #fff7ed; color: #9a3412 !important; }
    .clinical-alert .material-symbols-rounded { font-size: 18px; color: inherit; }
    .clinical-alert.allergy-alert { background: #fff1f2; color: #be123c !important; border: 1px solid #fecdd3; }
    .patient-vitals-strip { grid-column: 1 / -1; display: flex; align-items: center; gap: 0; flex-wrap: wrap; border-top: 1px solid var(--ac-border); padding-top: 12px; }
    .patient-vitals-strip > span { display: flex; align-items: baseline; gap: 5px; padding: 3px 18px 3px 0; margin-right: 18px; border-right: 1px solid var(--ac-border); }
    .patient-vitals-strip strong { color: var(--ac-text); font-size: 15px; }
    .patient-vitals-strip small { color: var(--ac-muted); font-size: 11px; }
    .patient-vitals-strip button { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; min-height: 36px; padding: 6px 9px; color: var(--ac-primary); background: var(--ac-primary-light); border: 0; border-radius: 8px; font: inherit; font-size: 12px; cursor: pointer; }
    .patient-vitals-strip button .material-symbols-rounded { font-size: 16px; color: inherit; }
    .encounter-workspace { grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; }
    .clinical-board { order: 1; min-width: 0; }
    .doctor-summary { order: 2; position: sticky; top: calc(var(--opd-header-height, 180px) + 20px); padding: 0; border-radius: 14px; box-shadow: 0 4px 18px #33415506; max-height: calc(100dvh - var(--opd-header-height, 180px) - 110px); overflow-y: auto; overscroll-behavior: contain; }
    .doctor-summary-details > summary { display: flex; align-items: center; gap: 8px; list-style: none; cursor: pointer; padding: 16px; font-weight: 750; background: linear-gradient(115deg, var(--ac-primary-light), color-mix(in srgb, var(--ac-secondary, #7c3aed) 5%, var(--ac-surface))); border-bottom: 1px solid var(--ac-border); }
    .doctor-summary-details > summary::-webkit-details-marker { display: none; }
    .doctor-summary-details > summary > .material-symbols-rounded { font-size: 20px; color: var(--ac-primary); }
    .summary-live { margin-left: auto; padding: 3px 6px; border-radius: 5px; color: #047857; background: #ecfdf5; font-size: 10px; }
    .summary-content { display: grid; gap: 0; padding: 0 16px 16px; }
    .summary-content > section, .summary-patient { padding: 13px 0; border-bottom: 1px solid var(--ac-border); }
    .summary-patient { display: grid; gap: 5px; }
    .summary-content h4 { display: flex; justify-content: space-between; margin: 0 0 8px; font-size: 11px; color: var(--ac-muted); text-transform: uppercase; letter-spacing: .055em; }
    .summary-content h4 span { color: var(--ac-primary); }
    .summary-content p { font-size: 12px; line-height: 1.6; margin-bottom: 7px; }
    .summary-content p small { display: block; }
    .summary-content small { font-size: 11px; color: var(--ac-muted); }
    .summary-empty { color: var(--ac-muted); }
    .summary-results { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 10px 0; border: 0; background: transparent; color: var(--ac-primary); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
    .summary-results .material-symbols-rounded { font-size: 18px; }
    .summary-results .material-symbols-rounded:last-child { margin-left: auto; }
    .summary-previous { font-size: 12px; }
    .shortcut-hint { margin-top: 15px; line-height: 1.9 !important; }
    .consultation-jump-links { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 0; margin-bottom: 16px; position: sticky; top: calc(var(--opd-header-height, 180px) + 10px); z-index: 24; background: var(--ac-bg); }
    .consultation-jump-links button { display: flex; gap: 9px; align-items: center; text-align: left; min-width: 0; padding: 14px 12px; background: var(--ac-surface); border-radius: 12px; transition: border-color 150ms; }
    .consultation-jump-links button.active { border-color: var(--ac-primary); background: linear-gradient(120deg, var(--ac-primary-light), color-mix(in srgb, var(--ac-secondary, #7c3aed) 5%, var(--ac-surface))); box-shadow: 0 3px 12px #2563eb0b; }
    .consultation-jump-links .stage-number { display: grid; place-items: center; flex: 0 0 28px; height: 28px; background: var(--ac-bg); color: var(--ac-muted); border-radius: 8px; font-size: 12px; }
    .consultation-jump-links .active .stage-number { background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary, #7c3aed)); color: white; }
    .consultation-jump-links strong { font-size: 13px; display: block; }
    .consultation-jump-links small { display: block; margin-top: 4px; font-size: 10px; font-weight: 500; color: var(--ac-muted); line-height: 1.4; }
    .consultation-jump-links .material-symbols-rounded { font-size: 18px; color: var(--ac-primary); margin-left: auto; }
    .consultation-group { padding: 22px; border-radius: 14px; gap: 18px; scroll-margin-top: calc(var(--opd-header-height, 180px) + 105px); box-shadow: 0 4px 18px #33415505; }
    .consultation-group[hidden] { display: none !important; }
    .group-heading h2 { font-size: 19px; }
    .group-heading p { font-size: 12px; color: var(--ac-muted); }
    .consultation-stack { gap: 18px; }
    .consultation-stack > section { padding: 16px 0; border: 0; border-bottom: 1px solid var(--ac-border); border-radius: 0; background: transparent; }
    .consultation-group .section-title h3 { font-size: 15px; }
    .consultation-group .section-title p { font-size: 12px; }
    .optional-section > summary > span { float: right; color: var(--ac-muted); font-size: 11px; font-weight: 500; }
    .vitals-section { background: var(--ac-bg); }
    .vitals-section .clinical-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .vitals-section .section-title h3 { display: none; }
    .vitals-section .section-title p { margin: 0; }
    .system-template-buttons { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 14px; }
    .system-template-buttons button { min-height: 36px; padding: 7px 10px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-primary); font: inherit; font-size: 12px; cursor: pointer; }
    .diagnosis-search-field { position: relative; }
    .consultation-footer { margin-top: 16px; padding: 12px 16px; border-radius: 12px; background: color-mix(in srgb, var(--ac-surface) 96%, transparent); backdrop-filter: blur(12px); }
    .consultation-footer { z-index: 300; }
    .consultation-footer .draft-status { font-size: 11px; }
    .investigation-categories { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .investigation-categories > section > small { display: block; margin-bottom: 7px; color: var(--ac-muted); font-size: 11px; font-weight: 650; }
    .opd-page button:focus-visible, .opd-page input:focus-visible, .opd-page textarea:focus-visible, .opd-page summary:focus-visible { outline-width: 2px; outline-offset: 2px; }
    .consultation-footer .ac-btn { font-size: 12px; }
    .consultation-footer .material-symbols-rounded { font-size: 17px; }
    .medicine-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .medicine-table { display: grid; gap: 8px; overflow: visible; border: 0; background: transparent; }
    .medicine-table-head { min-width: 0; display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; background: transparent; border: 0; text-transform: none; letter-spacing: normal; font-size: 12px; }
    .medicine-table-row { min-width: 0; display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 12px; align-items: start; border: 1px solid var(--ac-border); border-radius: 10px; padding: 14px; background: var(--ac-surface); }
    .medicine-table-row > span::before { display: none !important; }
    .medicine-table-row .medicine-index { display: grid; place-items: center; background: var(--ac-primary-light); color: var(--ac-primary); height: 26px; border-radius: 7px; font-size: 11px; }
    .medicine-card-content strong { font-size: 14px; line-height: 1.5; }
    .medicine-card-content strong > span { color: var(--ac-muted); font-weight: 500; }
    .medicine-card-content small { display: block; margin-top: 5px; font-size: 11px; line-height: 1.5; color: var(--ac-muted); white-space: normal; }
    .medicine-table-row .medicine-card-actions { display: flex; gap: 6px; }
    .medicine-card-actions button { min-height: 32px; border: 1px solid var(--ac-border); border-radius: 7px; padding: 5px 8px; background: var(--ac-surface); color: var(--ac-primary); font: inherit; font-size: 11px; cursor: pointer; }
    .medicine-card-actions button:last-child { color: #be123c; }
    @media (max-width: 1250px) {
      .encounter-workspace { grid-template-columns: minmax(0, 1fr); }
      .doctor-summary { position: static; max-height: none; }
      .shortcut-hint { display: none; }
    }
    @media (max-width: 700px) {
      .consulting > .page-header { display: none; }
      .encounter-head { padding: 14px; gap: 10px; border-radius: 12px; }
      .encounter-head h2 { font-size: 20px; }
      .encounter-head > div:first-child > span { font-size: 11px; }
      .encounter-head .ac-eyebrow { font-size: 9px; }
      .encounter-head-actions { gap: 6px; }
      .encounter-head-actions .ac-btn { min-height: 36px; padding: 6px; font-size: 10px; }
      .encounter-head-actions .ac-btn .material-symbols-rounded { display: none; }
      .encounter-head-actions .status-badge { font-size: 10px; }
      .patient-alert-strip { gap: 5px; }
      .clinical-alert { font-size: 10px; padding: 5px 7px; }
      .patient-vitals-strip { gap: 6px 12px; padding-top: 8px; }
      .patient-vitals-strip > span { margin: 0; padding: 0; border: 0; }
      .patient-vitals-strip > span:nth-child(5), .patient-vitals-strip > span:nth-child(6) { display: none; }
      .patient-vitals-strip strong { font-size: 12px; }
      .patient-vitals-strip small { font-size: 9px; }
      .patient-vitals-strip button { min-height: 28px; font-size: 10px; padding: 4px; }
      .patient-vitals-strip button .material-symbols-rounded { display: none; }
      .consultation-jump-links { gap: 5px; }
      .consultation-jump-links button { padding: 9px 7px; gap: 6px; min-height: 48px; }
      .consultation-jump-links strong { font-size: 11px; }
      .consultation-jump-links small, .consultation-jump-links .material-symbols-rounded { display: none; }
      .consultation-jump-links .stage-number { flex-basis: 22px; height: 22px; font-size: 10px; }
      .consultation-group { padding: 14px; scroll-margin-top: calc(var(--opd-header-height, 180px) + 65px); }
      .group-heading { gap: 8px; }
      .group-heading h2 { font-size: 17px; }
      .vitals-section .clinical-grid, .medicine-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .consultation-footer { gap: 7px; padding: 10px; }
      .consultation-footer .draft-status { flex-basis: 100%; }
      .consultation-footer .ac-btn { flex: 1 1 auto; }
      .medicine-table-row { grid-template-columns: 24px minmax(0, 1fr); gap: 8px; padding: 12px; }
      .medicine-table-row .medicine-card-actions { grid-column: 2; }
    }
    @media (max-width: 400px) {
      .encounter-head { padding: 12px; }
      .medicine-grid { grid-template-columns: 1fr; }
      .investigation-categories { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpdPageComponent implements OnInit {
  protected readonly historyVisit = signal<OpdVisitVm | null>(null);
  protected readonly historyView = signal<'visits' | 'results' | 'documents'>('visits');
  protected readonly historyRecordId = signal('');
  protected readonly historyRecords = computed(() => {
    const visit = this.historyVisit();
    if (!visit) return [];
    return [...(this.historyByPatient()[visit.appointment.patientId] || [])].sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt)).map(record => {
      const sections = buildHistorySections(record.notes || (record.clinicalData ? composeClinicalNotes(restoreClinicalForm(record), this.labTests()) : ''));
      const diagnoses = sections.find(section => section.title === 'Diagnosis');
      const complaints = sections.find(section => section.title === 'Chief complaints');
      return { record, sections, status: humanizeCode(record.statusCode), tone: historyStatusTone(record.statusCode), doctorName: this.doctors().find(doctor => doctor.doctorGuid === record.doctorId)?.fullName || 'Doctor not recorded', preview: (diagnoses || complaints)?.rows.map(row => row.value).join(', ') || 'Consultation record' };
    });
  });
  protected readonly selectedHistoryRecord = computed(() => this.historyRecords().find(item => item.record.id === this.historyRecordId()) || this.historyRecords()[0] || null);
  protected readonly selectedHistoryRecordId = computed(() => { const item = this.selectedHistoryRecord(); return item ? item.record.id : ''; });
  protected readonly reviewOpen = signal(false);
  protected readonly draftSaveStatus = signal('Draft autosave ready');
  protected readonly draftConflict = signal(false);
  protected readonly sendToPharmacyOnComplete = signal(false);
  protected readonly finishing = signal(false);
  protected readonly completedPrescription = signal<PrescriptionPreview | null>(null);
  protected readonly completionSummary = computed(() => buildCompletionSummary(composeClinicalNotes(this.clinicalForm(), this.labTests())));
  protected readonly draftSaving = signal(false);
  protected readonly pendingCompletionLabs = computed(() => this.clinicalForm().labOrders.filter(item => !item.labOrderId).length);
  private readonly destroyRef = inject(DestroyRef);
  private draftTimer: ReturnType<typeof setTimeout> | undefined;
  private lastObservedDraft = '';
  private lastSavedDraft = '';
  private draftSession = 0;
  private destroyed = false;
  protected readonly appointments = signal<AppointmentRecord[]>([]);
  protected readonly queues = signal<AppointmentQueueRecord[]>([]);
  protected readonly patients = signal<PatientSummary[]>([]);
  protected readonly doctors = signal<DoctorSummary[]>([]);
  protected readonly consultations = signal<OpdConsultationRecord[]>([]);
  protected readonly followUps = signal<OpdFollowUpRecord[]>([]);
  protected readonly labTests = signal<OpdLabTestRecord[]>([]);
  protected readonly medicines = signal<OpdMedicineRecord[]>([]);
  protected readonly medicineSuggestionsOpen = signal(false);
  protected readonly medicineCatalogError = signal(false);
  protected readonly pharmacyIntegrationEnabled = signal(true);
  protected readonly pharmacyConfigurationError = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<OpdTab>('dashboard');
  protected readonly activeEncounterSection = signal<OpdEncounterSection>('snapshot');
  private readonly consultationInjector = inject(Injector);
  private readonly consultationHeader = viewChild<ElementRef<HTMLElement>>('consultationHeader');
  protected readonly consultationHeaderHeight = signal(180);
  protected readonly wideConsultation = signal(window.innerWidth > 1250);
  protected readonly diagnosisSuggestionsOpen = signal(false);
  protected readonly consultationStages = [
    { id: 'assessment', label: 'Assessment', description: 'Symptoms, findings & diagnosis', icon: 'stethoscope' },
    { id: 'treatment', label: 'Treatment', description: 'Medicines, tests & advice', icon: 'medication' },
    { id: 'follow-up', label: 'Follow-up', description: 'Review & next steps', icon: 'event_repeat' }
  ];
  protected readonly consultationStage = computed(() => consultationStageForSection(this.activeEncounterSection()));
  protected readonly compactVitals = computed(() => {
    const vitals = this.clinicalForm().vitals;
    return [
      { label: 'BP', value: vitals.bloodPressure, unit: 'mmHg' },
      { label: 'Pulse', value: vitals.pulseRate, unit: 'bpm' },
      { label: 'SpO₂', value: vitals.spo2, unit: '%' },
      { label: 'Temp', value: vitals.temperature, unit: '°F' },
      { label: 'Weight', value: vitals.weight, unit: 'kg' },
      { label: 'BMI', value: this.bmiValue(), unit: '' }
    ];
  });
  protected readonly examinationSystems = computed(() => {
    const specialty = this.selectedVisit()?.doctor?.primarySpecialization || this.selectedVisit()?.departmentName || '';
    return examinationSystemsForSpecialty(specialty);
  });
  protected readonly diagnosisSuggestions = computed(() => {
    const visit = this.selectedVisit();
    const query = this.clinicalForm().diagnosisDraft.diagnosisName.trim().toLowerCase();
    if (!visit || query.length < 2) return [];
    const records = [...this.consultations(), ...(this.historyByPatient()[visit.appointment.patientId] || [])];
    const seen = new Set<string>();
    return records.filter(record => record.doctorId === visit.appointment.doctorId || record.patientId === visit.appointment.patientId)
      .flatMap(record => restoreClinicalForm(record).diagnoses)
      .filter(diagnosis => {
        const key = `${diagnosis.diagnosisCode}|${diagnosis.diagnosisName}`.toLowerCase();
        if (seen.has(key) || !key.includes(query)) return false;
        seen.add(key);
        return true;
      }).slice(0, 8);
  });
  protected readonly selectedVisit = signal<OpdVisitVm | null>(null);
  protected readonly transferVisit = signal<OpdVisitVm | null>(null);
  protected readonly encounterForm = signal<OpdEncounterForm>(emptyEncounterForm());
  protected readonly clinicalForm = signal<OpdClinicalForm>(emptyClinicalForm());
  protected readonly prescriptionPreviewOpen = signal(false);
  protected readonly saveTemplateOpen = signal(false);
  protected readonly printOptionsOpen = signal(false);
  protected readonly interactionReviewOpen = signal(false);
  protected readonly interactionAlerts = signal<OpdDrugInteractionAlert[]>([]);
  protected readonly allergyReviewOpen = signal(false);
  protected readonly allergyAlerts = signal<OpdDrugAllergyAlert[]>([]);
  protected readonly prescriptionStatus = signal<PrescriptionStatus>('DRAFT');
  protected readonly prescriptionSentToPharmacy = signal(false);
  protected readonly prescriptionRevisionNo = signal(1);
  protected readonly customFrequencyMode = signal(false);
  protected readonly customDietAdviceMode = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly doctorFilter = signal('');
  protected transferDoctorId = '';
  protected selectedPrescriptionTemplateId = '';
  protected printOptions: PrescriptionPrintOptions = defaultPrescriptionPrintOptions();
  protected interactionOverrideReason = '';
  protected allergyOverrideReason = '';
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
  protected readonly investigationCategories = [
    { label: 'Laboratory', items: ['CBC', 'Blood Sugar', 'Lipid Profile'] },
    { label: 'Radiology', items: ['X-Ray', 'MRI'] },
    { label: 'Cardiology', items: ['ECG'] }
  ];
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
    { id: 'dashboard', label: 'My Queue', icon: 'queue' },
    { id: 'encounter', label: 'Active Consultation', icon: 'stethoscope' },
    { id: 'completed', label: "Today's Visits", icon: 'task_alt' },
    { id: 'follow-ups', label: 'Follow-ups', icon: 'event_repeat' },

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
  private readonly laboratoryService = inject(LaboratoryService);
  private readonly branchContext = inject(BranchContextService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private interactionReviewResolver: ((allowed: boolean) => void) | null = null;
  private approvedInteractionSignature = '';
  private allergyReviewResolver: ((allowed: boolean) => void) | null = null;
  private approvedAllergySignature = '';

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
    if (this.clinicalForm().prescriptionDraft.medicineId) return [];
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
    const patientMap = new Map([...this.patients(), ...Object.values(this.patientContexts())].map(patient => [patient.patientGuid, patient]));
    const doctorMap = new Map(this.doctors().map(doctor => [doctor.doctorGuid, doctor]));
    const queueMap = new Map<string, AppointmentQueueRecord>();
    this.queues().forEach(queue => {
      const appointmentId = queueAppointmentId(queue);
      if (appointmentId) {
        queueMap.set(appointmentId, queue);
      }
    });
    const consultationMap = new Map([...this.consultations()].sort((a, b) => safeTime(a.createdAt) - safeTime(b.createdAt)).filter(item => item.appointmentId).map(item => [item.appointmentId as string, item]));

    return this.appointments()
      .map(appointment => {
        const appointmentStatus = normalizeCode(appointment.statusCode || 'SCHEDULED');
        const queue = queueMap.get(appointment.id) ?? null;
        const consultation = consultationMap.get(appointment.id) ?? null;
        const consultationStatus = normalizeCode(consultation?.statusCode || appointmentStatus || '-');
        const patient = patientMap.get(appointment.patientId) ?? null;
        const doctor = doctorMap.get(appointment.doctorId) ?? null;
        return {
          appointment,
          queue,
          consultation,
          patient,
          doctor,
          appointmentNo: appointment.appointmentNo || derivedAppointmentNo(appointment.id),
          tokenNumber: queue?.tokenNumber || (isCheckedInStatus(appointmentStatus) ? 'Token pending' : '-'),
          queueNo: queue?.queueNo ?? null,
          priorityCode: priorityLabel(queue?.priorityCode),
          patientName: patient?.fullName ?? 'Unknown patient',
          patientMrn: patient?.medicalRecordNo ?? 'MRN not found',
          doctorName: doctor?.fullName ?? 'Unknown doctor',
          departmentName: appointment.departmentName || doctor?.departmentName || '-',
          branchName: appointment.branchName || doctor?.branchName || 'Main Branch',
          appointmentTime: formatTime(appointment.startsAt),
          arrivalTime: queue?.arrivedAt ? formatTime(queue.arrivedAt) : null,
          statusCode: appointmentStatus,
          consultationStatus
        };
      })
      .filter(visit => isActiveConsultation(visit) || this.matchesSearch(visit))
      .filter(visit => !this.doctorFilter() || visit.appointment.doctorId === this.doctorFilter())
      .sort((a, b) => {
        const rank = (visit: OpdVisitVm) => ({ EMERGENCY: 0, URGENT: 1, HIGH: 1, NORMAL: 2 }[normalizeCode(visit.queue?.priorityCode || 'NORMAL')] ?? 2);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
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
    isQueueVisibleToday(visit)
    && !isTerminalQueueVisit(visit)
    && isWaitingVisit(visit)
    && !isActiveOrCompletedConsultation(visit)
  ));

  protected readonly queueVisits = computed(() => this.visitModels().filter(visit =>
    isQueueVisibleToday(visit)
    && !isTerminalQueueVisit(visit)
  ));

  protected readonly activeConsultations = computed(() => this.visitModels().filter(visit =>
    isActiveConsultation(visit)
  ));

  protected readonly todaysVisits = computed(() => this.visitModels().filter(visit => isToday(visit.appointment.startsAt)));
  protected readonly completedVisits = computed(() => this.visitModels().filter(visit =>
    isCompletedVisit(visit) && isToday(visit.appointment.startsAt)
  ));

  protected readonly noShowVisits = computed(() => this.visitModels().filter(visit =>
    isNoShowStatus(visit.statusCode)
    || isNoShowStatus(normalizeCode(visit.queue?.statusCode || ''))
  ));

  protected readonly encounterCandidates = computed(() => [
    ...this.activeConsultations(),
    ...this.waitingQueue()
  ]);

  protected readonly nextWaitingVisit = computed(() => this.waitingQueue()[0] ?? null);
  protected readonly dashboardFocusVisit = computed(() => this.activeConsultations()[0] ?? this.nextWaitingVisit() ?? null);

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
        && (!this.doctorFilter() || appointment?.doctorId === this.doctorFilter());
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
      { label: 'Waiting', value: formatNumber(stats.waiting), icon: 'queue', color: '#2563eb', bg: '#eff6ff', tab: 'dashboard' as OpdTab },
      { label: 'Current', value: formatNumber(stats.inConsultation), icon: 'clinical_notes', color: '#0f766e', bg: '#f0fdfa', tab: 'encounter' as OpdTab },
      { label: 'Completed', value: formatNumber(stats.completed), icon: 'task_alt', color: '#059669', bg: '#ecfdf5', tab: 'completed' as OpdTab },
      { label: 'Follow-ups', value: formatNumber(stats.followUps), icon: 'event_repeat', color: '#7c3aed', bg: '#f5f3ff', tab: 'follow-ups' as OpdTab }
    ];
  });

  protected tabCount(tabId: OpdTab): string | null {
    const stats = this.stats();
    switch (tabId) {
      case 'dashboard':
      case 'queue':
        return formatNumber(this.waitingQueue().length);
      case 'follow-ups':
        return formatNumber(this.visibleFollowUps().length);
      case 'check-in':
        return formatNumber(this.pendingCheckIns().length);
      case 'encounter':
      case 'active':
        return formatNumber(stats.inConsultation);
      case 'completed':
        return formatNumber(stats.completed);
      default:
        return null;
    }
  }

  protected readonly doctorQueueSummary = computed(() => {
    const doctor = this.doctors().find(item => item.doctorGuid === this.doctorFilter()) ?? null;
    const visits = this.visitModels().filter(visit => !doctor || visit.appointment.doctorId === doctor.doctorGuid);
    return {
      doctorName: doctor ? `${doctor.fullName} · ${doctor.departmentName}` : 'All doctors',
      waiting: formatNumber(visits.filter(visit => this.waitingQueue().some(item => item.appointment.id === visit.appointment.id)).length),
      current: formatNumber(visits.filter(visit => isActiveConsultation(visit)).length),
      completed: formatNumber(visits.filter(visit => this.completedVisits().some(item => item.appointment.id === visit.appointment.id)).length)
    };
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.applyRouteContext();
  }

  private async loadPatients() {
    const first = await this.patientService.search('', '', '', '', '', 1, 100);
    if (!first.success || !first.data) return first;
    const registry = first.data;
    for (let page = 2; registry.patients.length < registry.totalCount; page++) {
      const next = await this.patientService.search('', '', '', '', '', page, 100);
      if (!next.success || !next.data) return next;
      if (!next.data.patients.length) break;
      registry.patients.push(...next.data.patients);
    }
    return first;
  }

  private async loadAll<T>(fetch: (page: number) => Promise<ApiResponse<T[]>>): Promise<ApiResponse<T[]>> {
    const rows: T[] = [];
    for (let page = 1; ; page++) {
      const response = await fetch(page);
      if (!response.success || !response.data) return response;
      rows.push(...response.data);
      if (response.data.length < 100) return { ...response, data: rows };
    }
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const configuration = await this.opdService.getConfiguration().catch(() => null);
      const configured = Boolean(configuration?.success && typeof configuration.data?.pharmacyIntegrationEnabled === 'boolean');
      this.pharmacyConfigurationError.set(!configured);
      this.pharmacyIntegrationEnabled.set(configured ? configuration!.data!.pharmacyIntegrationEnabled : true);
      if (!configured) this.toast.error('Prescribing settings unavailable', 'Retry settings before issuing medicines. Your consultation notes are retained.');
      if (!this.pharmacyIntegrationEnabled()) this.sendToPharmacyOnComplete.set(false);
      const [appointments, queues, patients, doctors, consultations, followUps, labTests, medicines] = await Promise.all([
        this.loadAll(page => this.appointmentService.list(page, 100)),
        this.loadAll(page => this.appointmentService.listQueue(page, 100)),
        this.loadPatients(),
        this.doctorService.search({ searchText: '', departmentName: '', specializationName: '', branchName: '', employmentType: '', statusCode: '', pageNumber: 1, pageSize: 100 }),
        this.loadAll(page => this.opdService.listConsultations(page, 100)),
        this.loadAll(page => this.opdService.listFollowUps(page, 100)),
        this.opdService.listLabTests(1, 100),
        this.loadAll(page => this.opdService.listMedicines(page, 100)).catch(() => ({ success: false, data: null }))
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
        this.medicineCatalogError.set(false);
      } else {
        this.medicines.set([]);
        this.medicineCatalogError.set(true);
      }
    } finally {
      const email = (this.auth.profile()?.email || this.auth.session()?.email || '').toLowerCase();
      const doctor = this.doctors().find(item => item.email?.toLowerCase() === email);
      if (doctor && !this.doctorFilter()) this.doctorFilter.set(doctor.doctorGuid);
      const focus = this.dashboardFocusVisit();
      if (focus) void this.loadPatientContext(focus);
      this.loading.set(false);
    }
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    const email = (this.auth.profile()?.email || this.auth.session()?.email || '').toLowerCase();
    this.doctorFilter.set(this.doctors().find(doctor => doctor.email?.toLowerCase() === email)?.doctorGuid ?? '');
  }

  protected setActiveTab(tab: OpdTab): void {
    if (tab === 'encounter' && (!this.selectedVisit() || isCompletedVisit(this.selectedVisit()!)) && this.activeConsultations()[0]) { this.selectVisit(this.activeConsultations()[0], tab); return; }
    this.activeTab.set(tab);
    persistOpdTab(tab);
  }

  protected openStatCard(tab: OpdTab): void {
    this.setActiveTab(tab);
  }

  protected formatNumberValue(value: number): string {
    return formatNumber(value);
  }

  protected goToAppointments(): void {
    void this.router.navigate(['/appointments']);
  }

  protected selectVisit(visit: OpdVisitVm, tab: OpdTab = 'encounter'): void {
    if (isCompletedVisit(visit) || normalizeCode(visit.consultation?.statusCode) === 'CANCELLED') { this.showHistory(visit); return; }
    const draftState = readEncounterDraftState(visit);
    if (this.saving() || this.finishing()) return;
    if (this.selectedVisit()?.appointment.id === visit.appointment.id) { this.setActiveTab(tab); return; }
    const previous = this.selectedVisit();
    if (previous && !isCompletedVisit(previous)) persistEncounterDraftState(previous, this.activeEncounterSection(), this.clinicalForm());
    this.selectedVisit.set(visit);
    void this.loadPatientContext(visit);
    this.encounterForm.set(toEncounterForm(visit, 'IN_PROGRESS'));
    this.clinicalForm.set(draftState?.form ?? restoreClinicalForm(visit.consultation));
    clearTimeout(this.draftTimer);
    this.draftSession++;
    this.lastObservedDraft = '';
    this.lastSavedDraft = JSON.stringify(restoreClinicalForm(visit.consultation));
    this.draftConflict.set(Boolean(draftState?.baseUpdatedAt && draftState.baseUpdatedAt !== visit.consultation?.updatedAt));
    if (this.draftConflict() && visit.consultation) this.selectedVisit.set({ ...visit, consultation: { ...visit.consultation, updatedAt: draftState!.baseUpdatedAt ?? null } });
    this.draftSaveStatus.set(this.draftConflict() ? 'Another session changed this visit' : draftState ? 'Recovered local draft' : 'Saved to server');
    this.reviewOpen.set(false);
    this.prescriptionStatus.set('DRAFT');
    this.prescriptionSentToPharmacy.set(false);
    this.prescriptionRevisionNo.set(1);
    this.prescriptionPreviewOpen.set(false);
    this.activeEncounterSection.set(draftState?.section ?? 'consultation');
    this.diagnosisSuggestionsOpen.set(false);
    this.setActiveTab(tab);
  }

  protected async quickCheckIn(visit: OpdVisitVm): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.toast.info('Check-in started', 'Adding the patient to the OPD queue. This may take a few seconds.');
    try {
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
      this.setActiveTab('queue');
    } finally {
      this.saving.set(false);
    }
  }

  protected async startEncounter(visit: OpdVisitVm): Promise<void> {
    if (this.saving()) return;
    if (visit.consultation) { this.selectVisit(visit); return; }
    if (!visit.queue) {
      this.toast.warning('Check-in required', 'Add the patient to the OPD queue before starting consultation.');
      return;
    }

    this.saving.set(true);
    try {
      let consultation: OpdConsultationRecord | null = visit.consultation;
      if (!consultation) {
        const response = await this.opdService.createConsultation(this.createStartEncounterForm(visit));
        if (!response.success || !response.data) {
          this.toast.error('Unable to start encounter', getApiErrorMessage(response, 'OPD API failed'));
          return;
        }
        consultation = response.data;
        this.upsertConsultation(consultation);
      }

      if (consultation.statusCode === 'COMPLETED' || consultation.statusCode === 'CANCELLED') { this.applyVisitStatus(visit, consultation.statusCode); this.toast.info('Visit already closed', 'Refresh to see the latest queue.'); return; }
      this.applyVisitStatus(visit, 'IN_CONSULTATION');
      this.completedPatientName.set('');
      const updatedVisit = this.visitModels().find(item => item.appointment.id === visit.appointment.id) ?? { ...visit, consultation };
      this.saving.set(false);
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

  protected consultationStatusLabel(visit: OpdVisitVm): string {
    const status = normalizeCode(visit.consultation?.statusCode || visit.consultationStatus || '');
    const labels: Record<string, string> = {
      DRAFT: 'Draft',
      IN_PROGRESS: 'In Progress',
      IN_CONSULTATION: 'In Consultation',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled'
    };

    return labels[status] ?? humanizeCode(status || 'IN_PROGRESS');
  }

  protected consultationStatusClass(visit: OpdVisitVm): string {
    const status = normalizeCode(visit.consultation?.statusCode || visit.consultationStatus || '');
    if (status === 'COMPLETED') {
      return 'completed';
    }
    if (status === 'DRAFT') {
      return 'draft';
    }
    if (status === 'CANCELLED') {
      return 'cancelled';
    }
    return 'active';
  }

  protected encounterRecordNo(visit: OpdVisitVm): string {
    return visit.consultation?.id ? `OPD-${visit.consultation.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'Not created';
  }

  protected canUseQueueActions(visit: OpdVisitVm): boolean {
    const queueStatus = normalizeCode(visit.queue?.statusCode || visit.statusCode || '');
    const consultationStatus = normalizeCode(visit.consultationStatus || '');
    return Boolean(visit.queue)
      && !['IN_CONSULTATION', 'COMPLETED', 'CANCELLED'].includes(queueStatus)
      && !isNoShowStatus(queueStatus)
      && !['IN_PROGRESS', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'].includes(consultationStatus);
  }

  protected canTransferDoctor(visit: OpdVisitVm): boolean {
    return this.canUseQueueActions(visit)
      && this.doctors().some(doctor => doctor.doctorGuid !== visit.appointment.doctorId);
  }

  protected queueStatusLabel(visit: OpdVisitVm): string {
    const status = normalizeCode(visit.queue?.statusCode || visit.statusCode || '');
    const labels: Record<string, string> = {
      CHECKED_IN: 'Waiting',
      CHECKEDIN: 'Waiting',
      WAITING: 'Waiting',
      SKIPPED: 'Skipped',
      IN_CONSULTATION: 'In Consultation'
    };
    return labels[status] ?? humanizeCode(status || 'WAITING');
  }

  protected queueStatusClass(visit: OpdVisitVm): string {
    const status = normalizeCode(visit.queue?.statusCode || visit.statusCode || '');
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

  protected readonly patientLabReports = signal<Record<string, LabReport[]>>({});
  protected readonly labReportErrors = signal<Record<string, boolean>>({});
  protected readonly downloadingReports = signal<string[]>([]);
  protected readonly patientContexts = signal<Record<string, PatientProfile>>({});
  protected readonly historyByPatient = signal<Record<string, OpdConsultationRecord[]>>({});
  protected readonly contextError = signal('');
  protected readonly averageConsultationMinutes = computed(() => {
    const durations = this.completedVisits().map(visit => visit.consultation).filter(record => record?.startedAt && record.completedAt).map(record => (safeTime(record!.completedAt) - safeTime(record!.startedAt)) / 60000).filter(minutes => minutes >= 0);
    return durations.length ? Math.max(1, Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)) : null;
  });
  protected readonly completedPatientName = signal('');
  private readonly auth = inject(AuthStore);
  private focusPatientId = '';
  constructor() {
    effect(onCleanup => {
      const header = this.consultationHeader()?.nativeElement;
      if (!header) return;
      const observer = new ResizeObserver(() => this.consultationHeaderHeight.set(Math.ceil(header.getBoundingClientRect().height)));
      observer.observe(header);
      onCleanup(() => observer.disconnect());
    });
    const poll = setInterval(() => this.observeDraftChanges(), 1000);
    const retainDraft = () => {
      const visit = this.selectedVisit();
      if (visit && !isCompletedVisit(visit)) persistEncounterDraftState(visit, this.activeEncounterSection(), this.clinicalForm());
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      retainDraft();
      if (this.selectedVisit() && JSON.stringify(this.clinicalForm()) !== this.lastSavedDraft) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    this.destroyRef.onDestroy(() => {
      retainDraft();
      this.destroyed = true;
      clearInterval(poll);
      clearTimeout(this.draftTimer);
      window.removeEventListener('beforeunload', beforeUnload);
    });
    effect(() => {
      const focus = this.dashboardFocusVisit();
      if (focus && this.focusPatientId !== focus.appointment.patientId) {
        this.focusPatientId = focus.appointment.patientId;
        void this.loadPatientContext(focus);
      }
    });
  }

  private observeDraftChanges(): void {
    const visit = this.selectedVisit();
    if (!visit?.consultation || isCompletedVisit(visit) || this.saving() || this.finishing() || this.reviewOpen() || this.draftConflict()) return;
    const serialized = JSON.stringify(this.clinicalForm());
    if (serialized === this.lastSavedDraft || serialized === this.lastObservedDraft) return;
    this.lastObservedDraft = serialized;
    this.clinicalForm.update(form => ({ ...form }));
    this.draftSaveStatus.set('Unsaved changes');
    persistEncounterDraftState(visit, this.activeEncounterSection(), this.clinicalForm());
    clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => { void this.saveClinicalDraft(false); }, 1200);
  }

  private async saveClinicalDraft(showToast: boolean): Promise<boolean> {
    const visit = this.selectedVisit();
    if (!visit?.consultation || isCompletedVisit(visit) || this.saving() || this.destroyed || this.draftConflict()) return false;
    clearTimeout(this.draftTimer);
    const session = this.draftSession;
    const serialized = JSON.stringify(this.clinicalForm());
    this.saving.set(true);
    this.draftSaving.set(true);
    this.draftSaveStatus.set('Saving…');
    try {
      const response = await this.opdService.saveConsultationDraft(visit.consultation.id, serialized,
        composeClinicalNotes(this.clinicalForm(), this.labTests()), visit.consultation.updatedAt);
      if (!response.success || !response.data) throw response;
      if (this.destroyed || session !== this.draftSession) return false;
      this.upsertConsultation(response.data);
      const updatedVisit = { ...visit, consultation: response.data };
      this.selectedVisit.set(updatedVisit);
      this.lastSavedDraft = serialized;
      this.draftSaveStatus.set(JSON.stringify(this.clinicalForm()) === serialized ? 'Saved to server' : 'Unsaved changes');
      persistEncounterDraftState(updatedVisit, 'consultation', this.clinicalForm());
      if (showToast) this.toast.success('Draft saved');
      return true;
    } catch (error) {
      if (isDraftConflict(error)) this.draftConflict.set(true);
      this.draftSaveStatus.set(this.draftConflict() ? 'Another session changed this visit' : 'Couldn’t save · use Save Draft to retry');
      persistEncounterDraftState(visit, this.activeEncounterSection(), this.clinicalForm());
      if (showToast) this.toast.error('Draft not saved', getApiErrorMessage(error as ApiResponse<unknown>, 'Your local draft is retained. Retry saving.'));
      return false;
    } finally { this.draftSaving.set(false); this.saving.set(false); }
  }

  protected jumpToConsultation(section: string): void {
    const sectionId: OpdEncounterSection = section === 'treatment' ? 'prescription' : section === 'follow-up' ? 'follow-up' : 'consultation';
    this.setEncounterStep(sectionId);
    this.medicineSuggestionsOpen.set(false);
    this.diagnosisSuggestionsOpen.set(false);
    afterNextRender(() => {
      const element = document.getElementById(`opd-${section}`);
      element?.scrollIntoView({ block: 'start', behavior: 'instant' });
      const heading = element?.querySelector('h2');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }, { injector: this.consultationInjector });
  }

  protected moveConsultationStage(direction: number): void {
    const index = this.consultationStages.findIndex(stage => stage.id === this.consultationStage());
    const next = this.consultationStages[index + direction];
    if (next) this.jumpToConsultation(next.id);
  }

  protected focusConsultationField(stage: string, name: string): void {
    this.jumpToConsultation(stage);
    afterNextRender(() => {
      const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`.clinical-board [name="${name}"]`);
      const details = field?.closest('details');
      if (details) details.open = true;
      field?.focus();
    }, { injector: this.consultationInjector });
  }

  protected hasRecordedAllergies(visit: OpdVisitVm): boolean {
    const recorded = visit.patient?.knownAllergies?.trim() || '';
    return Boolean(this.patientContexts()[visit.appointment.patientId]?.allergies.some(item => item.statusCode === 'ACTIVE')
      || (recorded && !/^(none|nil|nka|nkda|no known( drug)? allergies|not recorded)\.?$/i.test(recorded)));
  }

  protected recordedConditions(visit: OpdVisitVm): string {
    const conditions = visit.patient?.knownConditions?.trim() || '';
    return /^(none|nil|not recorded|unknown|n\/a)\.?$/i.test(conditions) ? '' : conditions;
  }

  protected appendStructuredHistory(): void {
    this.clinicalForm.update(form => ({ ...form, history: { ...form.history,
      presentIllness: appendHistoryDetails(form.history) } }));
  }

  protected addExaminationSystem(system: string): void {
    this.clinicalForm.update(form => ({ ...form, examination: { ...form.examination,
      systemExamination: form.examination.systemExamination.includes(`${system}:`)
        ? form.examination.systemExamination : [form.examination.systemExamination, `${system}: `].filter(Boolean).join('\n') } }));
    afterNextRender(() => document.querySelector<HTMLTextAreaElement>('[name="systemExamination"]')?.focus(), { injector: this.consultationInjector });
  }

  protected selectDiagnosisSuggestion(diagnosis: OpdDiagnosisForm): void {
    this.clinicalForm.update(form => ({ ...form, diagnosisDraft: { ...form.diagnosisDraft,
      diagnosisName: diagnosis.diagnosisName, diagnosisCode: diagnosis.diagnosisCode } }));
    this.diagnosisSuggestionsOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected onConsultationShortcut(event: KeyboardEvent): void {
    if (this.activeTab() !== 'encounter' || this.reviewOpen() || this.historyVisit() || document.querySelector('[role="dialog"]')
      || this.saving() || this.finishing() || event.altKey || event.repeat) return;
    const shortcut = (event.ctrlKey || event.metaKey) ? event.key.toLowerCase() : event.key;
    if ((event.ctrlKey || event.metaKey) && shortcut === 's') {
      event.preventDefault(); void this.saveEncounterDraft();
    } else if ((event.ctrlKey || event.metaKey) && shortcut === 'enter') {
      event.preventDefault(); void this.openCompletionReview();
    } else if (!event.ctrlKey && !event.metaKey && ['F2', 'F3', 'F4'].includes(shortcut)) {
      event.preventDefault();
      this.focusConsultationField(shortcut === 'F2' ? 'assessment' : 'treatment', shortcut === 'F2' ? 'diagnosisName' : shortcut === 'F3' ? 'medicine' : 'investigationDraft');
    }
  }

  @HostListener('window:resize')
  protected resizeConsultation(): void { this.wideConsultation.set(window.innerWidth > 1250); }

  protected async loadLatestDraft(): Promise<void> {
    const visit = this.selectedVisit();
    if (!visit?.consultation || this.saving()) return;
    this.saving.set(true);
    try {
      const response = await this.opdService.getConsultation(visit.consultation.id);
      if (!response.success || !response.data) throw response;
      // Retain the conflicted draft separately before replacing the editor with the server version.
      localStorage.setItem(`${encounterDraftStorageKey(visit)}.recovery`, JSON.stringify(this.clinicalForm()));
      clearEncounterDraftState(visit);
      this.upsertConsultation(response.data);
      this.selectedVisit.set(null);
      this.saving.set(false);
      if (normalizeCode(response.data.statusCode) === 'COMPLETED' || normalizeCode(response.data.statusCode) === 'CANCELLED') {
        this.setActiveTab('dashboard');
        this.showHistory({ ...visit, consultation: response.data });
      } else {
        this.selectVisit({ ...visit, consultation: response.data });
      }
      this.toast.info('Latest version loaded', 'Your previous local draft is retained in browser recovery storage.');
    } catch (error) { this.toast.error('Unable to reload visit', getApiErrorMessage(error as ApiResponse<unknown>, 'Your local draft is retained.')); }
    finally { this.saving.set(false); }
  }

  protected downloadLocalDraft(): void {
    const blob = new Blob([composeClinicalNotes(this.clinicalForm(), this.labTests())], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'opd-local-clinical-notes.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected openAdmissionWorkspace(visit: OpdVisitVm): void {
    persistEncounterDraftState(visit, this.activeEncounterSection(), this.clinicalForm());
    void this.router.navigate(['/ipd'], { queryParams: { patientGuid: visit.appointment.patientId, action: 'admit', consultationId: visit.consultation?.id } });
  }

  protected async openCompletionReview(): Promise<void> {
    if (this.saving() || this.draftConflict()) return;
    clearTimeout(this.draftTimer);
    this.commitAllConsultationDrafts();
    this.clinicalForm.update(form => ({ ...form }));
    if (!this.validateCompletion()) return;
    if (!await this.saveClinicalDraft(false)) return;
    this.sendToPharmacyOnComplete.set(false);
    this.reviewOpen.set(true);
  }

  private commitAllConsultationDrafts(): void {
    const originalSection = this.activeEncounterSection();
    for (const section of ['consultation', 'diagnosis', 'lab-orders', 'procedures', 'prescription'] as OpdEncounterSection[]) {
      this.activeEncounterSection.set(section);
      this.commitActiveEncounterStepDraft();
    }
    this.activeEncounterSection.set(originalSection);
  }

  private validateCompletion(): boolean {
    const form = this.clinicalForm();
    if (!form.complaints.length && !form.clinicalNotes.trim() && !form.history.presentIllness.trim()) {
      this.toast.warning('Clinical assessment required', 'Record a complaint, present illness, or clinical note before completing.');
      this.jumpToConsultation('assessment');
      return false;
    }
    if (form.followUp.followUpRequired && !form.followUp.followUpDate) {
      this.toast.warning('Follow-up date required', 'Choose a review date or turn off follow-up.');
      this.jumpToConsultation('follow-up');
      return false;
    }
    if (form.followUp.followUpRequired && form.followUp.createAppointment && !form.followUp.appointmentTime) {
      this.toast.warning('Appointment time required', 'Select a follow-up appointment time or leave booking to reception.');
      this.jumpToConsultation('follow-up');
      return false;
    }
    return this.validatePrescriptionDetails();
  }

  protected medicineValidationIssues(item: OpdPrescriptionItemForm): string[] {
    return prescriptionItemIssues(item, this.pharmacyIntegrationEnabled());
  }

  private validatePrescriptionDetails(): boolean {
    const items = this.clinicalForm().prescriptions;
    if (items.length && this.pharmacyConfigurationError()) {
      this.toast.warning('Prescribing settings unavailable', 'Retry settings before issuing medicines.');
      return false;
    }
    const index = items.findIndex(item => prescriptionItemIssues(item, this.pharmacyIntegrationEnabled()).length > 0);
    if (index < 0) return true;
    this.toast.warning('Complete medicine details', `Medicine ${index + 1} (${items[index].medicine || 'unnamed'}): ${prescriptionItemIssues(items[index], this.pharmacyIntegrationEnabled()).join(', ')}. Use Edit on this medicine to correct it.`);
    this.jumpToConsultation('treatment');
    return false;
  }

  protected async refreshMedicineCatalog(): Promise<void> {
    try {
      const response = await this.loadAll(page => this.opdService.listMedicines(page, 100));
      if (!response.success || !response.data) throw new Error('Catalog unavailable');
      this.medicines.set(response.data);
      this.medicineCatalogError.set(false);
    } catch {
      this.medicineCatalogError.set(true);
      this.toast.error('Medicine catalog unavailable', 'Retry or ask Pharmacy to check the hospital catalog. Your consultation is retained.');
    }
  }

  private async loadPatientContext(visit: OpdVisitVm): Promise<void> {
    const id = visit.appointment.patientId;
    void this.loadLabReports(id);
    this.contextError.set('');
    try {
      const [profile, history] = await Promise.all([this.patientService.get(id), this.opdService.patientHistory(id)]);
      if (profile.success && profile.data) this.patientContexts.update(all => ({ ...all, [id]: profile.data! }));
      if (history.success && history.data) this.historyByPatient.update(all => ({ ...all, [id]: history.data! }));
      if (!profile.success || !history.success) this.contextError.set('Some patient context could not be loaded. Open the patient record or refresh to retry.');
    } catch { this.contextError.set('Patient context unavailable. Refresh to retry.'); }
  }

  protected async loadLabReports(patientId: string): Promise<void> {
    this.labReportErrors.update(all => ({ ...all, [patientId]: false }));
    try {
      const response = await this.laboratoryService.reports(patientId);
      if (!response.success || !response.data) throw new Error('Reports unavailable');
      this.patientLabReports.update(all => ({ ...all, [patientId]: response.data!.filter(report => report.patientId === patientId && report.statusCode === 'REPORT_RELEASED') }));
    } catch {
      this.labReportErrors.update(all => ({ ...all, [patientId]: true }));
    }
  }

  protected async downloadLabReport(report: LabReport): Promise<void> {
    if (this.downloadingReports().includes(report.id)) return;
    this.downloadingReports.update(ids => [...ids, report.id]);
    try {
      const blob = await this.laboratoryService.reportPdf(report.id, report.currentVersion);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.reportNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}-v${report.currentVersion}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.toast.error('Unable to download lab report', 'Please retry. Your session or report download permission may need to be checked.');
    } finally {
      this.downloadingReports.update(ids => ids.filter(id => id !== report.id));
    }
  }

  protected previousVisitCount(visit: OpdVisitVm): string {
    const history = this.historyByPatient()[visit.appointment.patientId];
    return history ? String(history.filter(record => record.id !== visit.consultation?.id && record.statusCode === 'COMPLETED').length) : 'Loading…';
  }

  protected previousConsultation(visit: OpdVisitVm): OpdConsultationRecord | null {
    return this.historyByPatient()[visit.appointment.patientId]?.find(record => record.id !== visit.consultation?.id && record.statusCode === 'COMPLETED') ?? null;
  }

  protected allergySummary(visit: OpdVisitVm): string {
    const allergies = this.patientContexts()[visit.appointment.patientId]?.allergies.filter(item => item.statusCode === 'ACTIVE').map(item => item.allergen + (item.isCritical ? ' (critical)' : ''));
    return allergies?.length ? allergies.join(', ') : visit.patient?.knownAllergies || 'Not recorded — verify with patient';
  }

  protected pendingLabCount(visit: OpdVisitVm): string {
    const profile = this.patientContexts()[visit.appointment.patientId];
    return profile ? String(profile.labOrders.filter(item => !['COMPLETED', 'CANCELLED', 'REPORTED', 'VERIFIED', 'RELEASED', 'REPORT_RELEASED'].includes(item.statusCode)).length) : 'Unavailable';
  }

  protected recordedMedicationSummary(visit: OpdVisitVm): string {
    const previous = this.previousConsultation(visit);
    const items = previous ? parseClinicalNoteSections(previous.notes).get('prescription') : null;
    return items?.length ? items.join('; ') + ' (previous prescription; confirm current use)' : 'Not reconciled';
  }

  protected waitingTime(visit: OpdVisitVm): string {
    const arrival = safeTime(visit.queue?.arrivedAt);
    return arrival ? Math.max(0, Math.floor((Date.now() - arrival) / 60000)) + ' min waiting' : 'Arrival not recorded';
  }

  protected radiologyDocuments(visit: OpdVisitVm) {
    return this.patientContexts()[visit.appointment.patientId]?.documents.filter(document => /radiology|imaging|x.ray|mri|ultrasound|ct.scan/i.test(document.documentType + ' ' + document.documentName)) ?? [];
  }

  protected patientNameFor(id: string): string { return this.patients().find(patient => patient.patientGuid === id)?.fullName ?? 'Patient'; }
  protected openPatientProfile(id: string): void { void this.router.navigate(['/patients', id]); }
  protected showHistory(visit: OpdVisitVm): void { this.historyView.set('visits'); this.historyRecordId.set(''); this.historyVisit.set(visit); void this.loadPatientContext(visit); }
  protected retryHistoryContext(): void { const visit = this.historyVisit(); if (visit) void this.loadPatientContext(visit); }
  protected selectHistoryRecord(id: string): void { this.historyRecordId.set(id); document.querySelector('.history-detail')?.scrollTo({ top: 0 }); }
  private applyVisitStatus(visit: OpdVisitVm, statusCode: string): void {
    this.upsertAppointment({ ...visit.appointment, statusCode });
    if (visit.queue) this.upsertQueue({ ...visit.queue, statusCode });
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

  protected patientInitials(visit: OpdVisitVm): string {
    return visit.patientName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || 'PT';
  }

  protected clinicalSummaryPreview(notes: string | null | undefined): ClinicalSummaryPreview {
    return buildClinicalSummaryPreview(notes);
  }

  protected encounterStepNumber(sectionId: OpdEncounterSection): number {
    return this.encounterStepIndex(sectionId) + 1;
  }

  protected encounterStepStatus(sectionId: OpdEncounterSection): string {
    const currentIndex = this.encounterStepIndex(this.activeEncounterSection());
    const sectionIndex = this.encounterStepIndex(sectionId);
    if (sectionIndex < currentIndex) {
      return 'Saved';
    }
    if (sectionIndex === currentIndex) {
      return this.saving() ? 'Saving...' : 'Current';
    }
    return 'Next';
  }

  protected isEncounterStepComplete(sectionId: OpdEncounterSection): boolean {
    return this.encounterStepIndex(sectionId) < this.encounterStepIndex(this.activeEncounterSection());
  }

  protected isFirstEncounterStep(): boolean {
    return this.encounterStepIndex(this.activeEncounterSection()) === 0;
  }

  protected isLastEncounterStep(): boolean {
    return this.encounterStepIndex(this.activeEncounterSection()) === this.encounterSections.length - 1;
  }

  protected async goToEncounterStep(sectionId: OpdEncounterSection): Promise<void> {
    const currentIndex = this.encounterStepIndex(this.activeEncounterSection());
    const targetIndex = this.encounterStepIndex(sectionId);
    if (targetIndex < 0 || targetIndex === currentIndex) {
      return;
    }

    if (targetIndex > currentIndex && !await this.saveEncounterDraft(false)) {
      return;
    }

    this.setEncounterStep(sectionId);
  }

  protected goToPreviousEncounterStep(): void {
    const previousStep = this.encounterSections[this.encounterStepIndex(this.activeEncounterSection()) - 1];
    if (previousStep) {
      this.setEncounterStep(previousStep.id);
    }
  }

  protected async saveDraftAndNextEncounterStep(): Promise<void> {
    const currentIndex = this.encounterStepIndex(this.activeEncounterSection());
    const nextStep = this.encounterSections[currentIndex + 1];
    if (!nextStep) {
      return;
    }

    if (await this.saveEncounterDraft(false)) {
      this.setEncounterStep(nextStep.id);
      this.toast.success('Draft saved', `Continue with ${nextStep.label}.`);
    }
  }

  protected async saveEncounterDraft(showToast = true): Promise<boolean> {
    return this.saveClinicalDraft(showToast);
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
    this.medicineSuggestionsOpen.set(true);
    this.clinicalForm.update(form => ({
      ...form,
      prescriptionDraft: {
        ...form.prescriptionDraft,
        medicine: value,
        medicineId: value.trim().toLowerCase() === form.prescriptionDraft.medicine.trim().toLowerCase() ? form.prescriptionDraft.medicineId : null
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
        frequency: isCustom ? '' : value,
        isPrn: value === 'As Needed' || Boolean(form.prescriptionDraft.isPrn)
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
    if (!medicine.id) {
      this.toast.warning('Catalog medicine required', 'Choose a medicine from the hospital catalog so allergy checks and Pharmacy can identify it.');
      return;
    }
    this.medicineSuggestionsOpen.set(false);
    if (medicine.formularyStatus === 'RESTRICTED') {
      this.toast.warning(
        medicine.approvalRequired ? 'Restricted medicine — approval required' : 'Restricted formulary medicine',
        medicine.restrictionReason || 'Review the hospital formulary policy before prescribing.');
    }
    this.clinicalForm.update(form => ({
      ...form,
      prescriptionDraft: {
        ...form.prescriptionDraft,
        medicineId: medicine.id,
        medicine: medicine.name,
        strength: medicine.strength,
        dosageForm: medicine.form,
        route: medicine.route || form.prescriptionDraft.route
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
    if (this.pharmacyConfigurationError()) { this.toast.warning('Prescribing settings unavailable', 'Retry settings before adding medicines.'); return; }
    const issues = prescriptionItemIssues(draft, this.pharmacyIntegrationEnabled());
    if (issues.length) {
      this.toast.warning('Complete medicine details', `${draft.medicine || 'This medicine'}: ${issues.join(', ')}.`);
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

  protected editPrescriptionItem(index: number): void {
    if (!this.ensurePrescriptionEditable()) return;
    if (this.clinicalForm().prescriptionDraft.medicine.trim()) {
      this.toast.warning('Medicine entry in progress', 'Add or clear the medicine you are entering before editing another row.');
      return;
    }
    const item = this.clinicalForm().prescriptions[index];
    if (!item) return;
    this.clinicalForm.update(form => ({ ...form, prescriptionDraft: { ...item, isPrn: isAsNeededPrescription(item) }, prescriptions: form.prescriptions.filter((_, itemIndex) => itemIndex !== index) }));
    this.jumpToConsultation('treatment');
    this.markPrescriptionChanged();
  }

  protected removePrescriptionItem(index: number): void {
    if (!this.ensurePrescriptionEditable()) {
      return;
    }
    const removed = this.clinicalForm().prescriptions[index];
    this.clinicalForm.update(form => ({ ...form, prescriptions: form.prescriptions.filter((_, itemIndex) => itemIndex !== index), removedPrescriptionItemIds: removed?.id ? [...(form.removedPrescriptionItemIds || []), removed.id] : form.removedPrescriptionItemIds }));
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

  protected hasBlockingAllergy(): boolean {
    return this.allergyAlerts().some(alert => alert.behaviorCode === 'BLOCK');
  }

  protected cancelAllergyReview(): void {
    const resolve = this.allergyReviewResolver;
    this.allergyReviewResolver = null;
    this.allergyReviewOpen.set(false);
    this.allergyAlerts.set([]);
    this.allergyOverrideReason = '';
    resolve?.(false);
  }

  protected async continueAfterAllergyReview(): Promise<void> {
    if (this.hasBlockingAllergy() || this.allergyOverrideReason.trim().length < 5) {
      return;
    }

    const visit = this.selectedVisit();
    if (!visit) {
      this.cancelAllergyReview();
      return;
    }

    this.saving.set(true);
    try {
      for (const alert of this.allergyAlerts()) {
        const response = await this.opdService.recordDrugAllergyOverride({
          mappingId: alert.mappingId,
          patientAllergyId: alert.patientAllergyId,
          patientId: visit.appointment.patientId,
          medicineId: alert.medicineId,
          consultationId: visit.consultation?.id || this.encounterForm().consultationId || null,
          prescriptionId: this.clinicalForm().prescriptionId || null,
          overrideReason: this.allergyOverrideReason.trim()
        });
        if (!response.success || !response.data) {
          throw response;
        }
      }

      this.approvedAllergySignature = this.currentAllergySignature();
      const resolve = this.allergyReviewResolver;
      this.allergyReviewResolver = null;
      this.allergyReviewOpen.set(false);
      this.allergyAlerts.set([]);
      this.allergyOverrideReason = '';
      resolve?.(true);
    } catch (error) {
      this.toast.error('Allergy override could not be recorded', getApiErrorMessage(error as ApiResponse<unknown>, 'Medication-allergy audit failed'));
    } finally {
      this.saving.set(false);
    }
  }

  protected hasBlockingInteraction(): boolean {
    return this.interactionAlerts().some(alert => alert.behaviorCode === 'BLOCK');
  }

  protected requiresInteractionOverride(): boolean {
    return this.interactionAlerts().some(alert => alert.behaviorCode === 'REQUIRE_OVERRIDE');
  }

  protected interactionLabel(value: string): string {
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
  }

  protected cancelInteractionReview(): void {
    const resolve = this.interactionReviewResolver;
    this.interactionReviewResolver = null;
    this.interactionReviewOpen.set(false);
    this.interactionAlerts.set([]);
    this.interactionOverrideReason = '';
    resolve?.(false);
  }

  protected async continueAfterInteractionReview(): Promise<void> {
    if (this.hasBlockingInteraction()) {
      return;
    }

    const visit = this.selectedVisit();
    const reason = this.interactionOverrideReason.trim();
    const overrideAlerts = this.interactionAlerts().filter(alert => alert.behaviorCode === 'REQUIRE_OVERRIDE');
    if (overrideAlerts.length && (!visit || reason.length < 5)) {
      this.toast.warning('Clinical reason required', 'Enter at least 5 characters explaining why prescribing should continue.');
      return;
    }

    this.saving.set(true);
    try {
      for (const alert of overrideAlerts) {
        const response = await this.opdService.recordDrugInteractionOverride({
          interactionId: alert.interactionId,
          medicineAId: alert.medicineAId,
          medicineBId: alert.medicineBId,
          patientId: visit!.appointment.patientId,
          consultationId: visit!.consultation?.id || this.encounterForm().consultationId || null,
          prescriptionId: this.clinicalForm().prescriptionId || null,
          overrideReason: reason
        });
        if (!response.success || !response.data) {
          throw response;
        }
      }

      this.approvedInteractionSignature = this.currentInteractionSignature();
      const resolve = this.interactionReviewResolver;
      this.interactionReviewResolver = null;
      this.interactionReviewOpen.set(false);
      this.interactionAlerts.set([]);
      this.interactionOverrideReason = '';
      resolve?.(true);
    } catch (error) {
      this.toast.error('Override could not be recorded', getApiErrorMessage(error as ApiResponse<unknown>, 'Medication-safety audit failed'));
    } finally {
      this.saving.set(false);
    }
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

  protected async sendPrescriptionToPharmacy(): Promise<void> {
    if (!this.pharmacyIntegrationEnabled() || this.pharmacyConfigurationError()) {
      this.toast.warning('Pharmacy integration unavailable', 'Check hospital prescribing settings or print the prescription for the patient.');
      return;
    }
    if (this.prescriptionSentToPharmacy()) {
      return;
    }
    this.commitPrescriptionDraft();
    if (!this.validatePrescriptionDetails()) return;
    if (!await this.finalizePrescription(false)) {
      return;
    }
    const prescriptionId = this.clinicalForm().prescriptionId;
    if (!prescriptionId) {
      this.toast.error('Prescription unavailable', 'Save the prescription before sending it to Pharmacy.');
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.opdService.sendPrescriptionToPharmacy(prescriptionId);
      if (!response.success || !response.data) {
        this.toast.error('Unable to send prescription', getApiErrorMessage(response, 'Pharmacy handoff failed'));
        return;
      }
      this.prescriptionSentToPharmacy.set(true);
      this.toast.success('Prescription sent to Pharmacy', `${response.data.prescriptionNumber} is now in the pharmacy work queue.`);
    } catch (error) {
      this.toast.error('Unable to send prescription', getApiErrorMessage(error as ApiResponse<unknown>, 'Pharmacy handoff failed'));
    } finally {
      this.saving.set(false);
    }
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
    this.prescriptionSentToPharmacy.set(false);
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
      const selectedTests = pendingOrders.map(item => this.labTests().find(test => test.id === item.testId)).filter((test): test is OpdLabTestRecord => Boolean(test));
      if (selectedTests.length !== pendingOrders.length) {
        this.toast.error('Test catalog changed', 'Remove unavailable tests and select them again before submitting.');
        return;
      }
      const batchId = this.clinicalForm().pendingLabBatchId || crypto.randomUUID();
      this.clinicalForm.update(form => ({ ...form, pendingLabBatchId: batchId }));
      persistEncounterDraftState(visit, this.activeEncounterSection(), this.clinicalForm());
      const orderPriority = pendingOrders.some(item => item.priority === 'STAT') ? 'STAT' : pendingOrders.some(item => item.priority === 'Urgent' || item.priority === 'URGENT') ? 'URGENT' : 'ROUTINE';
      const clinicalNotes = pendingOrders.map(item => item.notes).filter(Boolean).join(' · ');
      const orderResponse = await this.opdService.createLabOrder(visit.appointment.patientId, consultation.id, selectedTests, orderPriority, clinicalNotes, visit.appointment.doctorId, batchId);
      if (!orderResponse.success || !orderResponse.data) {
        this.toast.error('Unable to create lab order', getApiErrorMessage(orderResponse, 'Laboratory API failed'));
        return;
      }

      this.clinicalForm.update(form => ({
        ...form,
        pendingLabBatchId: undefined,
        labOrders: form.labOrders.map(item => item.labOrderId ? item : { ...item, labOrderId: orderResponse.data?.id })
      }));
      this.toast.success('Lab order created', 'Selected tests were sent to the laboratory queue.');
    } finally {
      this.saving.set(false);
    }
    await this.saveClinicalDraft(false);
  }

  protected async createFollowUp(visit: OpdVisitVm): Promise<void> {
    const form = this.clinicalForm().followUp;
    if (!form.followUpRequired || !form.followUpDate) {
      this.toast.warning('Follow-up details required', 'Enable follow-up and select a follow-up date.');
      return;
    }

    this.saving.set(true);
    try {
      if (!form.recordId) {
        const response = await this.opdService.saveConsultationFollowUp(visit.consultation!.id, form.followUpDate, form.notes);
        if (!response.success || !response.data) {
          this.toast.error('Unable to create follow-up', getApiErrorMessage(response, 'Follow-up API failed'));
          return;
        }
        this.followUps.update(items => [response.data!, ...items]);
        this.clinicalForm.update(current => ({ ...current, followUp: { ...current.followUp, recordId: response.data!.id } }));
      }

      if (form.createAppointment && !form.appointmentId) {
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
          appointmentTime: form.appointmentTime || '',
          appointmentType: 'FOLLOW_UP',
          statusCode: 'SCHEDULED',
          reason: form.reason?.trim() || 'Follow-up OPD visit',
          notes: form.notes
        } satisfies AppointmentForm);

        if (appointmentResponse.success && appointmentResponse.data) {
          this.upsertAppointment(appointmentResponse.data);
          this.clinicalForm.update(current => ({ ...current, followUp: { ...current.followUp, appointmentId: appointmentResponse.data!.id } }));
        } else {
          this.toast.error('Follow-up appointment not booked', getApiErrorMessage(appointmentResponse, 'Please retry scheduling.'));
          return;
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

  protected async saveEncounter(statusCode: 'IN_PROGRESS' | 'COMPLETED', showToast = true): Promise<OpdConsultationRecord | null> {
    const visit = this.selectedVisit();
    if (!visit || isCompletedVisit(visit) || this.saving()) return null;

    this.saving.set(true);
    try {
      const notes = composeClinicalNotes(this.clinicalForm(), this.labTests());
      const form = {
        ...this.encounterForm(),
        notes,
        clinicalData: JSON.stringify(this.clinicalForm()),
        expectedUpdatedAt: visit.consultation?.updatedAt ?? null,
        statusCode: statusCode === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS'
      } satisfies OpdEncounterForm;
      const response = form.consultationId
        ? await this.opdService.updateConsultation(form)
        : await this.opdService.createConsultation(form);

      if (!response.success || !response.data) {
        if (isDraftConflict(response)) this.draftConflict.set(true);
        this.toast.error('Unable to save encounter', getApiErrorMessage(response, 'OPD API failed'));
        return null;
      }

      this.upsertConsultation(response.data);
      this.encounterForm.update(current => ({ ...current, consultationId: response.data!.id }));
      this.selectedVisit.set({ ...visit, consultation: response.data });
      if (statusCode !== 'COMPLETED') {
        await this.createClinicalChildRecords(response.data, visit);
        const persisted = await this.opdService.updateConsultation({ ...form, consultationId: response.data.id, expectedUpdatedAt: response.data.updatedAt, clinicalData: JSON.stringify(this.clinicalForm()) });
        if (isDraftConflict(persisted)) this.draftConflict.set(true);
        if (!persisted.success || !persisted.data) throw new Error('Unable to persist clinical draft. Please retry saving.');
        response.data = persisted.data;
      }
      this.upsertConsultation(response.data);
      const updatedVisit = { ...visit, consultation: response.data };
      this.selectedVisit.set(updatedVisit);
      this.encounterForm.set(toEncounterForm(updatedVisit, response.data.statusCode === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS'));
      this.lastSavedDraft = JSON.stringify(this.clinicalForm());
      this.lastObservedDraft = this.lastSavedDraft;
      this.draftSaveStatus.set('Saved to server');
      if (statusCode === 'COMPLETED') {
        clearEncounterDraftState(updatedVisit);
      } else {
        persistEncounterDraftState(updatedVisit, this.activeEncounterSection(), this.clinicalForm());
      }
      const prescriptionReady = this.clinicalForm().prescriptions.length > 0 && Boolean(this.clinicalForm().prescriptionId);
      if (showToast) {
        this.toast.success(
          statusCode === 'COMPLETED' ? 'Clinical record completed' : 'Draft saved',
          statusCode === 'IN_PROGRESS' && prescriptionReady ? 'Prescription generated and ready to preview.' : undefined
        );
      }
      return response.data;
    } catch (error) {
      persistEncounterDraftState(this.selectedVisit() ?? visit, this.activeEncounterSection(), this.clinicalForm());
      this.toast.error('Unable to save consultation', error instanceof Error ? error.message : 'Your draft is retained. Please retry.');
      return null;
    } finally {
      this.saving.set(false);
    }
  }

  protected async completeVisit(): Promise<void> {
    const visit = this.selectedVisit();
    if (!visit || this.saving() || this.finishing() || this.draftConflict() || isCompletedVisit(visit) || !this.validateCompletion() || this.pendingCompletionLabs() > 0) return;
    clearTimeout(this.draftTimer);
    this.finishing.set(true);
    this.reviewOpen.set(false);
    try {
    if (!await this.reviewDrugAllergies() || !await this.reviewDrugInteractions()) return;
    const draft = await this.saveEncounter('IN_PROGRESS', false);
    if (!draft) return;
    if (this.clinicalForm().followUp.followUpRequired) {
      await this.createFollowUp(visit);
      const followUp = this.clinicalForm().followUp;
      if (!followUp.recordId || (followUp.createAppointment && !followUp.appointmentId)) return;
      if (!await this.saveClinicalDraft(false)) return;
    }
    if (this.pharmacyIntegrationEnabled() && this.sendToPharmacyOnComplete() && this.clinicalForm().prescriptions.length) {
      await this.sendPrescriptionToPharmacy();
      if (!this.prescriptionSentToPharmacy()) return;
    }
    const consultation = await this.saveEncounter('COMPLETED');
    if (!consultation) {
      return;
    }

    try { await this.generateEncounterBill(visit); } catch { this.toast.warning('Consultation completed', 'Billing could not be generated. Please retry from billing.'); }

    this.applyVisitStatus(visit, 'COMPLETED');
    this.completedPatientName.set(visit.patientName);
    this.completedPrescription.set(hasPrescriptionContent(this.clinicalForm(), this.labTests()) ? this.prescriptionPreview() : null);
    this.selectedVisit.set(null);
    const next = this.dashboardFocusVisit();
    if (next) void this.loadPatientContext(next);
    this.setActiveTab('dashboard');
    } finally { this.finishing.set(false); }
  }

  protected printCompletedPrescription(): void {
    const prescription = this.completedPrescription();
    if (prescription && !openPrescriptionDocument(prescription, true, this.printOptions)) this.toast.error('Unable to print', 'Allow pop-ups for this site and try again.');
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

    if (!this.validatePrescriptionDetails()) return false;

    if (!await this.reviewDrugAllergies() || !await this.reviewDrugInteractions()) {
      return false;
    }

    return Boolean(await this.saveEncounter('IN_PROGRESS'));
  }

  private async reviewDrugAllergies(): Promise<boolean> {
    if (!this.pharmacyIntegrationEnabled()) return true;
    const visit = this.selectedVisit();
    const medicineIds = [...new Set(this.clinicalForm().prescriptions.map(item => item.medicineId).filter((id): id is string => Boolean(id)))];
    if (!visit || medicineIds.length === 0) {
      return true;
    }

    const signature = `${visit.appointment.patientId}|${medicineIds.slice().sort().join('|')}`;
    if (signature === this.approvedAllergySignature) {
      return true;
    }

    try {
      const response = await this.opdService.checkDrugAllergies(visit.appointment.patientId, medicineIds);
      if (!response.success || !response.data) {
        this.toast.error('Allergy safety check failed', getApiErrorMessage(response, 'Allergy service did not return a result.'));
        return false;
      }
      if (!response.data.length) {
        this.approvedAllergySignature = signature;
        return true;
      }

      this.allergyAlerts.set(response.data);
      this.allergyOverrideReason = '';
      this.allergyReviewOpen.set(true);
      return await new Promise<boolean>(resolve => {
        this.allergyReviewResolver = resolve;
      });
    } catch (error) {
      this.toast.error('Allergy safety check failed', getApiErrorMessage(error as ApiResponse<unknown>, 'Prescription was not issued because allergy validation is unavailable.'));
      return false;
    }
  }

  private currentAllergySignature(): string {
    const patientId = this.selectedVisit()?.appointment.patientId || '';
    const medicines = [...new Set(this.clinicalForm().prescriptions.map(item => item.medicineId).filter((id): id is string => Boolean(id)))].sort().join('|');
    return `${patientId}|${medicines}`;
  }

  private async reviewDrugInteractions(): Promise<boolean> {
    if (!this.pharmacyIntegrationEnabled()) return true;
    const medicineIds = [...new Set(this.clinicalForm().prescriptions.map(item => item.medicineId).filter((id): id is string => Boolean(id)))];
    if (medicineIds.length < 2) {
      return true;
    }

    const signature = medicineIds.slice().sort().join('|');
    if (signature === this.approvedInteractionSignature) {
      return true;
    }

    try {
      const response = await this.opdService.checkDrugInteractions(medicineIds);
      if (!response.success || !response.data) {
        this.toast.error('Medication safety check failed', getApiErrorMessage(response, 'Interaction service did not return a result.'));
        return false;
      }
      if (!response.data.length) {
        this.approvedInteractionSignature = signature;
        return true;
      }

      this.interactionAlerts.set(response.data);
      this.interactionOverrideReason = '';
      this.interactionReviewOpen.set(true);
      return await new Promise<boolean>(resolve => {
        this.interactionReviewResolver = resolve;
      });
    } catch (error) {
      this.toast.error('Medication safety check failed', getApiErrorMessage(error as ApiResponse<unknown>, 'Prescription was not issued because interaction validation is unavailable.'));
      return false;
    }
  }

  private currentInteractionSignature(): string {
    return [...new Set(this.clinicalForm().prescriptions.map(item => item.medicineId).filter((id): id is string => Boolean(id)))].sort().join('|');
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
    this.approvedInteractionSignature = '';
    this.approvedAllergySignature = '';
    this.prescriptionSentToPharmacy.set(false);
    this.prescriptionStatus.set('DRAFT');
  }

  private ensurePrescriptionEditable(): boolean {
    if (!this.prescriptionLocked()) {
      return true;
    }

    this.toast.warning('Prescription is issued', 'Create a revised prescription before changing finalized medical instructions.');
    return false;
  }

  private encounterStepIndex(sectionId: OpdEncounterSection): number {
    return this.encounterSections.findIndex(section => section.id === sectionId);
  }

  private setEncounterStep(sectionId: OpdEncounterSection): void {
    if (!this.encounterSections.some(section => section.id === sectionId)) {
      return;
    }

    this.activeEncounterSection.set(sectionId);
    const visit = this.selectedVisit();
    if (visit) {
      persistEncounterDraftState(visit, sectionId, this.clinicalForm());
    }
  }

  private commitActiveEncounterStepDraft(): void {
    if (this.prescriptionLocked()) {
      return;
    }

    const section = this.activeEncounterSection();
    this.clinicalForm.update(form => {
      if (section === 'consultation' && form.complaintDraft.complaint.trim()) {
        return {
          ...form,
          complaints: [...form.complaints, { ...form.complaintDraft }],
          complaintDraft: emptyComplaintForm()
        };
      }

      if (section === 'diagnosis' && (form.diagnosisDraft.diagnosisName.trim() || form.diagnosisDraft.diagnosisCode.trim())) {
        return {
          ...form,
          diagnoses: [...form.diagnoses, { ...form.diagnosisDraft }],
          diagnosisDraft: emptyDiagnosisForm()
        };
      }

      if (section === 'lab-orders' && form.labOrderDraft.testId) {
        return {
          ...form,
          labOrders: [...form.labOrders, { ...form.labOrderDraft }],
          labOrderDraft: emptyLabOrderForm()
        };
      }

      if (section === 'procedures' && form.procedureDraft.procedure.trim()) {
        return {
          ...form,
          procedures: [...form.procedures, { ...form.procedureDraft }],
          procedureDraft: emptyProcedureForm()
        };
      }

      if (section === 'prescription') {
        let nextForm = form.prescriptionDraft.medicine.trim()
          ? {
              ...form,
              prescriptions: [...form.prescriptions, { ...form.prescriptionDraft }],
              prescriptionDraft: emptyPrescriptionItemForm()
            }
          : form;

        if (nextForm.investigationDraft.trim()) {
          nextForm = {
            ...nextForm,
            prescriptionInvestigations: [...nextForm.prescriptionInvestigations, nextForm.investigationDraft.trim()],
            investigationDraft: ''
          };
        }

        if (nextForm.adviceDraft.trim()) {
          nextForm = {
            ...nextForm,
            adviceList: [...nextForm.adviceList, nextForm.adviceDraft.trim()],
            adviceDraft: ''
          };
        }

        if (nextForm.dietAdviceDraft.trim()) {
          nextForm = {
            ...nextForm,
            dietAdviceList: [...nextForm.dietAdviceList, nextForm.dietAdviceDraft.trim()],
            dietAdviceDraft: ''
          };
          this.customDietAdviceMode.set(false);
        }

        return nextForm;
      }

      return form;
    });

    if (section === 'prescription') {
      this.customFrequencyMode.set(false);
    }
    this.markPrescriptionChanged();
  }

  private async createClinicalChildRecords(consultation: OpdConsultationRecord, visit: OpdVisitVm): Promise<void> {
    const form = this.clinicalForm();
    for (const id of form.removedPrescriptionItemIds || []) {
      const response = await this.opdService.deletePrescriptionItem(id);
      if (!response.success && response.statusCode !== 404) throw new Error('Unable to remove prescription item.');
      this.clinicalForm.update(current => ({ ...current, removedPrescriptionItemIds: (current.removedPrescriptionItemIds || []).filter(item => item !== id) }));
    }
    const complaints = [...form.complaints];
    for (const complaint of complaints.filter(item => !item.id)) {
      const response = await this.opdService.createSymptom(consultation.id, formatComplaint(complaint));
      if (response.success && response.data) {
        complaint.id = response.data.id;
      } else { throw new Error('Unable to save symptom.'); }
    }

    const diagnoses = [...form.diagnoses];
    for (const diagnosis of diagnoses.filter(item => !item.id)) {
      const response = await this.opdService.createDiagnosis(consultation.id, diagnosis);
      if (response.success && response.data) {
        diagnosis.id = response.data.id;
      } else { throw new Error('Unable to save diagnosis.'); }
    }

    let prescriptionId = form.prescriptionId;
    let prescriptionNo = form.prescriptionNo;
    if (hasPrescriptionContent(form, this.labTests()) && !prescriptionId) {
      prescriptionNo = prescriptionNo || buildPrescriptionNo(visit, consultation);
      const context = buildPrescriptionContext(visit, consultation, prescriptionNo, this.prescriptionStatusLabel(), this.prescriptionRevisionNo());
      const response = await this.opdService.createPrescription(
        consultation.id,
        visit.appointment.patientId,
        visit.appointment.doctorId,
        prescriptionNo,
        form.diagnoses.map(item => [item.diagnosisCode,item.diagnosisName].filter(Boolean).join(' - ')).join('; '),
        buildPrescriptionInstructions(form, this.labTests(), context, form.includeVitalsInPrescription ? buildPrescriptionVitals(form) : [])
      );
      if (response.success && response.data) {
        prescriptionId = response.data.id;
        this.clinicalForm.update(current => ({ ...current, prescriptionId, prescriptionNo }));
      } else { throw new Error('Unable to save prescription.'); }
    }

    const prescriptions = [...form.prescriptions];
    if (prescriptionId) {
      for (const item of prescriptions) {
        const response = await this.opdService.createPrescriptionItem(prescriptionId, item);
        if (response.success && response.data) {
          item.id = response.data.id;
        } else { throw new Error('Unable to save prescription item.'); }
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
    const chargeIds: string[] = [];
    for (const [index, service] of services.entries()) {
      const category = service.description.startsWith('Lab Test') ? 'Laboratory' : service.description.startsWith('Procedure') ? 'Procedure' : 'Consultation';
      const department = category === 'Laboratory' ? 'Laboratory' : 'OPD';
      const chargeResponse = await this.opdService.createBillableCharge(
        visit.appointment.patientId,
        visit.consultation?.id || visit.appointment.id,
        `${visit.appointment.id}-${index + 1}`,
        category === 'Consultation' ? 'OPD-CONSULT' : category === 'Laboratory' ? `OPD-LAB-${index + 1}` : `OPD-PROC-${index + 1}`,
        service.description,
        department,
        category,
        service.quantity,
        service.rate
      );
      if (!chargeResponse.success || !chargeResponse.data) {
        this.toast.error('Unable to generate OPD charge', getApiErrorMessage(chargeResponse, 'Billing charge service failed'));
        return;
      }
      chargeIds.push(chargeResponse.data.id);
    }

    const invoiceResponse = await this.opdService.createInvoiceFromCharges(
      visit.appointment.patientId,
      visit.consultation?.id || visit.appointment.id,
      chargeIds
    );
    if (!invoiceResponse.success || !invoiceResponse.data) {
      this.toast.error('Unable to generate OPD bill', getApiErrorMessage(invoiceResponse, 'Billing API failed'));
      return;
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
    const search = this.searchQuery().trim().toLowerCase();
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
    const appointmentId = queueAppointmentId(queue);
    this.queues.update(queues => queues.some(item => item.id === queue.id || queueAppointmentId(item) === appointmentId)
      ? queues.map(item => item.id === queue.id || queueAppointmentId(item) === appointmentId ? queue : item)
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

interface ClinicalSummaryPreview {
  caption: string;
  sections: ClinicalSummarySection[];
}

interface ClinicalSummarySection {
  title: string;
  icon: string;
  items: string[];
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

interface EncounterDraftState {
  section: OpdEncounterSection;
  form: OpdClinicalForm;
  updatedAt: string;
  baseUpdatedAt?: string | null;
}

function isDraftConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const response = error as { status?: number; statusCode?: number; problem?: { status?: number }; error?: { problem?: { status?: number }; message?: string }; message?: string };
  return response.status === 409 || response.statusCode === 409 || response.problem?.status === 409 || response.error?.problem?.status === 409 || /another session|changed in another session/i.test(response.message || response.error?.message || '');
}

const PRESCRIPTION_TEMPLATE_STORAGE_KEY = 'care360.opd.prescriptionTemplates';
const OPD_ENCOUNTER_DRAFT_STORAGE_PREFIX = 'care360.opd.encounterDraft.';
const OPD_ACTIVE_TAB_STORAGE_KEY = 'care360.opd.activeTab';
const VALID_OPD_TABS: OpdTab[] = ['dashboard', 'queue', 'check-in', 'active', 'completed', 'encounter'];

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

function readStoredOpdTab(): OpdTab {
  try {
    const storedTab = typeof localStorage === 'undefined' ? null : localStorage.getItem(OPD_ACTIVE_TAB_STORAGE_KEY);
    return isOpdTab(storedTab) ? storedTab : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

function persistOpdTab(tab: OpdTab): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(OPD_ACTIVE_TAB_STORAGE_KEY, tab);
  } catch {
    // Remembering the active tab is a convenience only.
  }
}

function readEncounterDraftState(visit: OpdVisitVm): EncounterDraftState | null {
  if (normalizeCode(visit.consultation?.statusCode || visit.consultationStatus) === 'COMPLETED') {
    clearEncounterDraftState(visit);
    return null;
  }

  try {
    const rawDraft = typeof localStorage === 'undefined' ? null : localStorage.getItem(encounterDraftStorageKey(visit));
    if (!rawDraft) {
      return null;
    }

    const parsed = JSON.parse(rawDraft) as EncounterDraftState;
    if (!isEncounterSection(parsed.section) || !isClinicalDraftForm(parsed.form)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function persistEncounterDraftState(visit: OpdVisitVm, section: OpdEncounterSection, form: OpdClinicalForm): void {
  if (normalizeCode(visit.consultation?.statusCode || visit.consultationStatus) === 'COMPLETED') {
    clearEncounterDraftState(visit);
    return;
  }

  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(encounterDraftStorageKey(visit), JSON.stringify({
      section,
      form,
      updatedAt: new Date().toISOString(),
      baseUpdatedAt: visit.consultation?.updatedAt ?? null
    } satisfies EncounterDraftState));
  } catch {
    // Local resume support should never block saving the server-side OPD draft.
  }
}

function clearEncounterDraftState(visit: OpdVisitVm): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(encounterDraftStorageKey(visit));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function encounterDraftStorageKey(visit: OpdVisitVm): string {
  return `${OPD_ENCOUNTER_DRAFT_STORAGE_PREFIX}${visit.appointment.id}`;
}

function isOpdTab(value: unknown): value is OpdTab {
  return VALID_OPD_TABS.includes(value as OpdTab);
}

function isEncounterSection(value: unknown): value is OpdEncounterSection {
  return ['snapshot', 'vitals', 'consultation', 'diagnosis', 'lab-orders', 'procedures', 'notes', 'prescription', 'follow-up'].includes(String(value));
}

function isClinicalDraftForm(value: unknown): value is OpdClinicalForm {
  const form = value as Partial<OpdClinicalForm> | null;
  return Boolean(
    form &&
    typeof form === 'object' &&
    form.vitals &&
    Array.isArray(form.complaints) &&
    Array.isArray(form.diagnoses) &&
    Array.isArray(form.prescriptions) &&
    Array.isArray(form.labOrders) &&
    Array.isArray(form.procedures) &&
    form.followUp
  );
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

function consultationStageForSection(section: OpdEncounterSection): 'assessment' | 'treatment' | 'follow-up' {
  if (section === 'follow-up') return 'follow-up';
  return ['prescription', 'lab-orders', 'procedures'].includes(section) ? 'treatment' : 'assessment';
}

function examinationSystemsForSpecialty(specialty: string): string[] {
  const systems = ['Cardiovascular', 'Respiratory', 'Abdomen', 'Neurological', 'Musculoskeletal'];
  const preferred = /ortho|rheumat|physio/i.test(specialty) ? 'Musculoskeletal'
    : /cardio/i.test(specialty) ? 'Cardiovascular' : /neuro/i.test(specialty) ? 'Neurological'
    : /pulmon|respir/i.test(specialty) ? 'Respiratory' : null;
  return preferred ? [preferred, ...systems.filter(system => system !== preferred)] : systems;
}

function appendHistoryDetails(history: OpdClinicalForm['history']): string {
  const details = [
    ['Location', history.location], ['Onset', history.onset], ['Character', history.character],
    ['Associated symptoms', history.associatedSymptoms], ['Aggravating factors', history.aggravatingFactors],
    ['Relieving factors', history.relievingFactors]
  ].filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value!.trim()}`);
  const existing = history.presentIllness.trim();
  return [existing, ...details.filter(detail => !existing.includes(detail))].filter(Boolean).join('\n');
}

function emptyComplaintForm(): OpdComplaintForm {
  return { complaint: '', duration: '', severity: 'Moderate', notes: '' };
}

function emptyDiagnosisForm(): OpdDiagnosisForm {
  return { diagnosisCode: '', diagnosisName: '', diagnosisType: 'PRIMARY', notes: '' };
}

function emptyPrescriptionItemForm(): OpdPrescriptionItemForm {
  return { medicine: '', strength: '', dosageForm: 'Tablet', dosage: '', route: 'Oral', frequency: '', duration: '', quantity: '', instructions: '', isPrn: false, prnReason: '' };
}

function emptyLabOrderForm() {
  return { testCategory: '', testId: '', priority: 'Routine', notes: '' };
}

function emptyProcedureForm(): OpdProcedureForm {
  return { procedure: '', notes: '', charge: '' };
}

const clinicalSummaryDisplaySections: Array<{ title: string; icon: string; keys: string[]; maxItems: number }> = [
  { title: 'Vitals', icon: 'monitor_heart', keys: ['vitals'], maxItems: 6 },
  { title: 'Complaints', icon: 'sick', keys: ['chief complaints'], maxItems: 3 },
  { title: 'Diagnosis', icon: 'diagnosis', keys: ['diagnosis'], maxItems: 3 },
  { title: 'Prescription', icon: 'medication', keys: ['prescription'], maxItems: 3 },
  { title: 'Clinical Notes', icon: 'clinical_notes', keys: ['clinical notes'], maxItems: 4 },
  { title: 'Advice', icon: 'health_and_safety', keys: ['advice', 'diet advice'], maxItems: 4 },
  { title: 'Follow-up', icon: 'event_repeat', keys: ['follow-up'], maxItems: 4 }
];

function buildClinicalSummaryPreview(notes: string | null | undefined): ClinicalSummaryPreview {
  const trimmedNotes = (notes ?? '').trim();
  if (!trimmedNotes) {
    return { caption: 'Awaiting clinical documentation.', sections: [] };
  }

  const parsedSections = parseClinicalNoteSections(trimmedNotes);
  const displaySections = clinicalSummaryDisplaySections
    .map(section => ({
      title: section.title,
      icon: section.icon,
      items: compactSummaryItems(section.keys.flatMap(key => parsedSections.get(key) ?? []), section.maxItems)
    }))
    .filter(section => section.items.length);

  if (displaySections.length) {
    return { caption: 'Latest saved encounter details.', sections: displaySections };
  }

  return {
    caption: 'Free-form clinical note.',
    sections: [{
      title: 'Notes',
      icon: 'clinical_notes',
      items: compactSummaryItems(trimmedNotes.split(/\n+/), 3)
    }]
  };
}

// Completion must show every entered item, including examination and ordered tests.
function buildCompletionSummary(notes: string): ClinicalSummaryPreview {
  const titles = ['Vitals', 'Chief Complaints', 'Clinical History', 'Examination', 'Diagnosis', 'Prescription', 'Prescription Investigations', 'Lab Orders', 'Procedures', 'Advice', 'Diet Advice', 'Follow-up', 'Clinical Notes'];
  const parsed = parseClinicalNoteSections(notes);
  return {
    caption: 'Full consultation for review.',
    sections: titles.map(title => ({ title, icon: '', items: (parsed.get(title.toLowerCase()) || []).filter(item => item !== '-' && !/:\s*-$/.test(item)) })).filter(section => section.items.length > 0)
  };
}

interface HistoryClinicalSection {
  title: string;
  kind: 'metrics' | 'medicines' | 'list';
  rows: Array<{ label: string; value: string; details: string[] }>;
}

function historyStatusTone(status: string): 'success' | 'pending' | 'active' | 'neutral' {
  switch (normalizeCode(status)) {
    case 'COMPLETED': return 'success';
    case 'DRAFT': return 'pending';
    case 'IN_PROGRESS':
    case 'IN_CONSULTATION': return 'active';
    default: return 'neutral';
  }
}

function buildHistorySections(notes: string): HistoryClinicalSection[] {
  const blocks: Array<{ title: string; lines: string[] }> = [];
  let current = { title: 'Clinical notes', lines: [] as string[] };
  for (const line of notes.split(/\r?\n/)) {
    const heading = line.match(/^\s*##\s+(.+?)\s*$/);
    if (heading) { if (current.lines.length) blocks.push(current); current = { title: heading[1], lines: [] }; continue; }
    const text = line.replace(/^\s*-\s*/, '').trim();
    if (!text) continue;
    // Wrapped narrative lines belong to the preceding entry, rather than becoming separate fields.
    if (!/^\s*-\s/.test(line) && current.lines.length) current.lines[current.lines.length - 1] += `\n${text}`;
    else current.lines.push(text);
  }
  if (current.lines.length) blocks.push(current);
  return blocks.map(block => {
    const key = block.title.toLowerCase();
    const kind: HistoryClinicalSection['kind'] = key === 'vitals' ? 'metrics' : key === 'prescription' ? 'medicines' : 'list';
    const title = block.title.charAt(0).toUpperCase() + block.title.slice(1).toLowerCase();
    const rows = block.lines.filter(isMeaningfulSummaryLine).map(line => {
      if (['vitals', 'clinical history', 'examination', 'follow-up'].includes(key)) {
        const colon = line.indexOf(':');
        if (colon >= 0) return { label: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim(), details: [] };
      }
      if (['chief complaints', 'prescription'].includes(key)) {
        const parts = line.split('|').map(part => part.trim()).filter(Boolean);
        return { label: '', value: parts[0], details: parts.slice(1) };
      }
      return { label: '', value: line, details: [] };
    });
    return { title, kind, rows };
  }).filter(section => section.rows.length > 0);
}

function parseClinicalNoteSections(notes: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  const blocks = notes.replace(/\r\n/g, '\n').split(/\n(?=##\s+)/g);

  blocks.forEach(block => {
    const match = block.match(/^##\s+(.+?)(?:\n|$)([\s\S]*)/);
    if (!match) {
      return;
    }

    const title = match[1].trim();
    const key = title.toLowerCase();
    const body = match[2].trim();
    if (key === 'clinical notes' && /(^|\n)##\s+\w+/.test(body)) {
      return;
    }

    const items = body
      .split('\n')
      .map(line => line.replace(/^\s*-\s*/, '').trim())
      .filter(isMeaningfulSummaryLine);

    if (items.length && !sections.has(key)) {
      sections.set(key, items);
    }
  });

  return sections;
}

function compactSummaryItems(items: string[], maxItems: number): string[] {
  const cleanedItems = items
    .map(item => item.replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim())
    .filter(isMeaningfulSummaryLine);

  if (cleanedItems.length <= maxItems) {
    return cleanedItems;
  }

  return [...cleanedItems.slice(0, maxItems - 1), `+${cleanedItems.length - maxItems + 1} more`];
}

function isMeaningfulSummaryLine(line: string): boolean {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized === '-' || normalized === '- -') {
    return false;
  }

  const valueOnly = normalized
    .replace(/^[^:]+:\s*/g, '')
    .replace(/[-|/\s]/g, '');

  return Boolean(valueOnly);
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
      `Present Illness: ${appendHistoryDetails(form.history) || '-'}`,
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
    `- Appointment: ${context.appointmentNo}`,
    `- OPD Encounter: ${context.opdEncounterNo}`,
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
  route?: string;
  key: string;
  id: string | null;
  label: string;
  name: string;
  genericName?: string;
  strength: string;
  form: string;
  formularyStatus?: 'APPROVED' | 'RESTRICTED';
  approvalRequired?: boolean;
  restrictionReason?: string | null;
}

function findMedicineSuggestions(query: string, medicines: OpdMedicineRecord[]): MedicineSuggestion[] {
  const normalized = normalizeSearchText(query);
  if (normalized.length < 2) {
    return [];
  }

  const catalog = medicines.map(toMedicineSuggestion);
  const merged = dedupeMedicineSuggestions(catalog.filter(item => item.id));
  return merged
    .map(item => ({ item, score: medicineSuggestionScore(normalized, item) }))
    .filter(match => match.score !== null)
    .sort((a, b) => a.score! - b.score!)
    .map(match => match.item);
}

function medicineSuggestionScore(query: string, medicine: MedicineSuggestion): number | null {
  const name = normalizeSearchText(medicine.name);
  const generic = normalizeSearchText(medicine.genericName || '');
  if (name.includes(query)) return 0;
  if (generic.includes(query)) return 1;
  if (normalizeSearchText([medicine.label, medicine.strength, medicine.form].join(' ')).includes(query)) return 2;

  // Close spellings are suggestions only: the doctor still explicitly selects the product.
  const words = [name, generic].join(' ').split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = query.split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return null;
  let edits = 0;
  for (const token of tokens) {
    if (words.some(word => word.includes(token))) continue;
    if (token.length < 5 || !/^[a-z]+$/.test(token)) return null;
    const limit = token.length >= 8 ? 2 : 1;
    const distances = words.filter(word => word.length >= 5).map(word => Math.min(
      medicineSpellingDistance(token, word),
      medicineSpellingDistance(token, word.slice(0, token.length))
    ));
    const distance = Math.min(...distances);
    if (distance > limit) return null;
    edits += distance;
  }
  return 3 + edits;
}

function medicineSpellingDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  rows[0] = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[left.length][right.length];
}

function toMedicineSuggestion(record: OpdMedicineRecord): MedicineSuggestion {
  const parsed = parseMedicineLabel([record.name, record.unit].filter(Boolean).join(' '));
  const strength = record.strength?.trim() || parsed.strength;
  const form = record.dosageForm?.trim() || parsed.form || record.unit || '';
  const label = [record.name, record.strength?.trim(), record.dosageForm?.trim()].filter(Boolean).join(' ').trim();
  return {
    key: record.id,
    id: record.id,
    label,
    name: record.name,
    genericName: record.genericName || '',
    route: record.route?.trim() || '',
    strength,
    form,
    formularyStatus: record.formularyStatus,
    approvalRequired: record.approvalRequired,
    restrictionReason: record.restrictionReason
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

function queueAppointmentId(queue: AppointmentQueueRecord): string {
  const record = queue as AppointmentQueueRecord & Record<string, unknown>;
  const value = record.appointmentId
    ?? record['appointmentID']
    ?? record['appointmentGuid']
    ?? record['appointmentGUID']
    ?? record['appointment_id']
    ?? record['AppointmentId'];
  return typeof value === 'string' ? value : '';
}

function normalizeCode(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

function isCheckedInStatus(status: string): boolean {
  return ['CHECKED_IN', 'CHECKEDIN', 'WAITING'].includes(normalizeCode(status));
}

function isNoShowStatus(status: string): boolean {
  return ['NO_SHOW', 'NOSHOW'].includes(normalizeCode(status));
}

function isActiveConsultation(visit: OpdVisitVm): boolean {
  return !isCompletedVisit(visit) && !isTerminalQueueVisit(visit) && ['DRAFT', 'IN_PROGRESS', 'IN_CONSULTATION'].includes(normalizeCode(visit.consultation?.statusCode || visit.consultationStatus));
}

function isActiveOrCompletedConsultation(visit: OpdVisitVm): boolean {
  return isActiveConsultation(visit) || normalizeCode(visit.consultation?.statusCode || visit.consultationStatus) === 'COMPLETED';
}

function isCompletedVisit(visit: OpdVisitVm): boolean {
  return normalizeCode(visit.consultation?.statusCode || visit.consultationStatus) === 'COMPLETED' || normalizeCode(visit.statusCode) === 'COMPLETED';
}

function isWaitingVisit(visit: OpdVisitVm): boolean {
  const queueStatus = normalizeCode(visit.queue?.statusCode || '');
  return isCheckedInStatus(queueStatus) || isCheckedInStatus(visit.statusCode);
}

function isTerminalQueueVisit(visit: OpdVisitVm): boolean {
  const queueStatus = normalizeCode(visit.queue?.statusCode || '');
  return ['COMPLETED', 'CANCELLED'].includes(queueStatus)
    || isNoShowStatus(queueStatus)
    || ['COMPLETED', 'CANCELLED'].includes(normalizeCode(visit.statusCode))
    || isNoShowStatus(visit.statusCode);
}

function isQueueVisibleToday(visit: OpdVisitVm): boolean {
  if (visit.queue) {
    const queueDay = dateKey(visit.queue.arrivedAt);
    return queueDay ? queueDay === todayInputValue() : isToday(visit.appointment.startsAt);
  }

  return isCheckedInStatus(visit.statusCode) && isToday(visit.appointment.startsAt);
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

function restoreClinicalForm(consultation: OpdConsultationRecord | null): OpdClinicalForm {
  try {
    const data: unknown = JSON.parse(consultation?.clinicalData || '{}');
    if (isClinicalDraftForm(data)) return data;
  } catch { /* Legacy visits keep their narrative notes. */ }
  return emptyClinicalForm(consultation?.notes ?? '');
}
