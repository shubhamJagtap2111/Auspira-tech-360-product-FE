import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AppointmentCheckInForm, AppointmentForm, AppointmentQueueRecord, AppointmentRecord, appointmentPriorityOptions } from '../appointments/appointment-management.models';
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
  OpdPrescriptionItemForm,
  OpdProcedureForm,
  OpdStats,
  OpdTab,
  OpdVisitVm
} from './opd-management.models';
import { OpdManagementService } from './opd-management.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent],
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
          <article class="stat-card ac-card">
            <span class="stat-icon material-symbols-rounded" [style.background]="card.bg" [style.color]="card.color">{{ card.icon }}</span>
            <div>
              <strong>{{ card.value }}</strong>
              <span>{{ card.label }}</span>
            </div>
          </article>
        }
      </div>

      <section class="opd-shell ac-card">
        <div class="opd-tabs">
          @for (tab of tabs; track tab.id) {
            <button type="button" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
              <span class="material-symbols-rounded">{{ tab.icon }}</span>
              {{ tab.label }}
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
          <div class="loader-state">
            <span class="material-symbols-rounded">stethoscope</span>
            <strong>Loading OPD workspace...</strong>
          </div>
        } @else {
          @switch (activeTab()) {
            @case ('dashboard') {
              <section class="dashboard-grid">
                <article class="panel doctor-queue-panel">
                  <div class="panel-head">
                    <span class="material-symbols-rounded">stethoscope</span>
                    <div>
                      <p class="ac-eyebrow">Doctor view</p>
                      <h2>My Queue</h2>
                      <small>{{ doctorQueueSummary().doctorName }}</small>
                    </div>
                  </div>
                  <div class="doctor-metrics">
                    <span>
                      <small>Waiting</small>
                      <strong>{{ doctorQueueSummary().waiting }}</strong>
                    </span>
                    <span>
                      <small>Current</small>
                      <strong>{{ doctorQueueSummary().current }}</strong>
                    </span>
                    <span>
                      <small>Completed</small>
                      <strong>{{ doctorQueueSummary().completed }}</strong>
                    </span>
                  </div>
                </article>

                <article class="panel">
                  <div class="panel-head">
                    <span class="material-symbols-rounded">queue</span>
                    <div>
                      <p class="ac-eyebrow">Today's Queue</p>
                      <h2>Waiting for doctor</h2>
                    </div>
                  </div>
                  <div class="compact-list">
                    @for (visit of waitingQueue().slice(0, 5); track visit.appointment.id) {
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

                <article class="panel">
                  <div class="panel-head">
                    <span class="material-symbols-rounded">clinical_notes</span>
                    <div>
                      <p class="ac-eyebrow">Active Consultations</p>
                      <h2>In progress</h2>
                    </div>
                  </div>
                  <div class="compact-list">
                    @for (visit of activeConsultations().slice(0, 5); track visit.appointment.id) {
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
                            @case ('complaints') {
                              <div class="section-title">
                                <h3>Chief Complaint</h3>
                                <p>Multiple complaints can be captured for one encounter.</p>
                              </div>
                              <div class="clinical-grid">
                                <label class="field"><span>Complaint</span><input name="complaint" [(ngModel)]="clinicalForm().complaintDraft.complaint" placeholder="Body pain" /></label>
                                <label class="field"><span>Duration</span><input name="complaintDuration" [(ngModel)]="clinicalForm().complaintDraft.duration" placeholder="2 days" /></label>
                                <label class="field"><span>Severity</span><select name="complaintSeverity" [(ngModel)]="clinicalForm().complaintDraft.severity"><option>Low</option><option>Moderate</option><option>High</option><option>Critical</option></select></label>
                                <label class="field wide"><span>Notes</span><input name="complaintNotes" [(ngModel)]="clinicalForm().complaintDraft.notes" placeholder="Associated symptoms or trigger" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" (click)="addComplaint()"><span class="material-symbols-rounded">add</span>Add Complaint</button>
                              <div class="chip-list">
                                @for (item of clinicalForm().complaints; track $index) {
                                  <span>{{ item.complaint }} · {{ item.severity }} <button type="button" (click)="removeComplaint($index)">Remove</button></span>
                                }
                              </div>
                            }
                            @case ('history') {
                              <div class="section-title"><h3>Clinical History</h3><p>Present illness and relevant medical background.</p></div>
                              <div class="clinical-grid single">
                                <label class="field"><span>Present Illness</span><textarea rows="3" name="presentIllness" [(ngModel)]="clinicalForm().history.presentIllness"></textarea></label>
                                <label class="field"><span>Past History</span><textarea rows="3" name="pastHistory" [(ngModel)]="clinicalForm().history.pastHistory"></textarea></label>
                                <label class="field"><span>Family History</span><textarea rows="3" name="familyHistory" [(ngModel)]="clinicalForm().history.familyHistory"></textarea></label>
                                <label class="field"><span>Surgical History</span><textarea rows="3" name="surgicalHistory" [(ngModel)]="clinicalForm().history.surgicalHistory"></textarea></label>
                              </div>
                            }
                            @case ('examination') {
                              <div class="section-title"><h3>Examination</h3><p>General, system, and observational findings.</p></div>
                              <div class="clinical-grid single">
                                <label class="field"><span>General Examination</span><textarea rows="3" name="generalExamination" [(ngModel)]="clinicalForm().examination.generalExamination"></textarea></label>
                                <label class="field"><span>System Examination</span><textarea rows="3" name="systemExamination" [(ngModel)]="clinicalForm().examination.systemExamination"></textarea></label>
                                <label class="field"><span>Observations</span><textarea rows="3" name="observations" [(ngModel)]="clinicalForm().examination.observations"></textarea></label>
                              </div>
                            }
                            @case ('diagnosis') {
                              <div class="section-title"><h3>Diagnosis</h3><p>Primary and secondary diagnoses are supported.</p></div>
                              <div class="clinical-grid">
                                <label class="field"><span>Diagnosis Code</span><input name="diagnosisCode" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisCode" placeholder="ICD / internal code" /></label>
                                <label class="field"><span>Diagnosis Name</span><input name="diagnosisName" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisName" placeholder="Viral fever" /></label>
                                <label class="field"><span>Type</span><select name="diagnosisType" [(ngModel)]="clinicalForm().diagnosisDraft.diagnosisType"><option value="PRIMARY">Primary</option><option value="SECONDARY">Secondary</option></select></label>
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
                              <div class="clinical-grid">
                                <label class="field"><span>Medicine</span><input name="medicine" [(ngModel)]="clinicalForm().prescriptionDraft.medicine" placeholder="Paracetamol" /></label>
                                <label class="field"><span>Dosage</span><input name="dosage" [(ngModel)]="clinicalForm().prescriptionDraft.dosage" placeholder="500 mg" /></label>
                                <label class="field"><span>Route</span><input name="route" [(ngModel)]="clinicalForm().prescriptionDraft.route" placeholder="Oral" /></label>
                                <label class="field"><span>Frequency</span><input name="frequency" [(ngModel)]="clinicalForm().prescriptionDraft.frequency" placeholder="Twice Daily" /></label>
                                <label class="field"><span>Duration</span><input name="duration" [(ngModel)]="clinicalForm().prescriptionDraft.duration" placeholder="5 Days" /></label>
                                <label class="field wide"><span>Instructions</span><input name="instructions" [(ngModel)]="clinicalForm().prescriptionDraft.instructions" placeholder="After Food" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" (click)="addPrescriptionItem()"><span class="material-symbols-rounded">add</span>Add Medicine</button>
                              <div class="record-list">
                                @for (item of clinicalForm().prescriptions; track $index) {
                                  <span><strong>{{ item.medicine }}</strong><small>{{ item.dosage }} · {{ item.route }} · {{ item.frequency }} · {{ item.duration }}</small><button type="button" (click)="removePrescriptionItem($index)">Remove</button></span>
                                }
                              </div>
                            }
                            @case ('lab-orders') {
                              <div class="section-title"><h3>Lab Orders</h3><p>Submitted tests create a laboratory queue order.</p></div>
                              <div class="clinical-grid">
                                <label class="field"><span>Test Category</span><input name="testCategory" [(ngModel)]="clinicalForm().labOrderDraft.testCategory" placeholder="Hematology" /></label>
                                <label class="field"><span>Test</span><ac-dropdown name="labTest" [(ngModel)]="clinicalForm().labOrderDraft.testId" [options]="labTestOptions()" /></label>
                                <label class="field"><span>Priority</span><select name="labPriority" [(ngModel)]="clinicalForm().labOrderDraft.priority"><option>Routine</option><option>Urgent</option><option>STAT</option></select></label>
                                <label class="field wide"><span>Notes</span><input name="labNotes" [(ngModel)]="clinicalForm().labOrderDraft.notes" /></label>
                              </div>
                              <button class="ac-btn ac-btn-secondary" type="button" (click)="addLabOrderDraft()"><span class="material-symbols-rounded">add</span>Add Test</button>
                              <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="createLabOrder(visit)"><span class="material-symbols-rounded">biotech</span>Create Lab Order</button>
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
                      @if (visit.consultation) {
                        <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="saveEncounter('IN_PROGRESS')">
                          <span class="material-symbols-rounded">save</span>
                          Save Clinical Record
                        </button>
                        <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="admitPatient(visit)">
                          <span class="material-symbols-rounded">bed</span>
                          Admit Patient
                        </button>
                        <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="completeVisit()">
                          <span class="material-symbols-rounded">task_alt</span>
                          Complete Consultation
                        </button>
                      } @else {
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
    .opd-page { display: grid; gap: 14px; animation: slideUp .24s ease; }
    .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .page-desc { margin: 6px 0 0; max-width: 760px; color: var(--ac-muted); }
    .header-actions, .queue-actions, .encounter-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .stats-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .stat-card { min-height: 76px; display: flex; gap: 12px; align-items: center; padding: 14px 16px; }
    .stat-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; font-size: 22px; }
    .stat-card strong { display: block; color: var(--ac-text); font-size: 24px; line-height: 1; }
    .stat-card span:last-child { display: block; margin-top: 4px; color: var(--ac-muted); font-size: 12.5px; font-weight: 750; }
    .opd-shell { display: grid; gap: 12px; padding: 14px; overflow: visible; }
    .opd-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 6px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-subtle); scrollbar-color: color-mix(in srgb, var(--ac-primary) 30%, #cbd5e1) transparent; scrollbar-width: thin; }
    .opd-tabs button { min-height: 40px; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 9px; padding: 0 12px; white-space: nowrap; background: transparent; color: var(--ac-muted); font: inherit; font-weight: 850; cursor: pointer; }
    .opd-tabs button.active { background: var(--ac-surface); color: var(--ac-primary); box-shadow: 0 10px 22px rgba(15, 23, 42, .08); }
    .toolbar { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(180px, 260px) 40px; gap: 8px; align-items: center; }
    .search-field { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 12px; border: 1px solid var(--ac-border); border-radius: 9px; background: var(--ac-surface); color: var(--ac-muted); }
    .search-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ac-text); font: inherit; font-weight: 750; }
    .icon-btn { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 9px; background: var(--ac-surface); color: var(--ac-muted); cursor: pointer; }
    .loader-state, .empty-state { min-height: 240px; display: grid; place-items: center; align-content: center; gap: 10px; color: var(--ac-muted); text-align: center; }
    .loader-state span { width: 58px; height: 58px; display: grid; place-items: center; border-radius: 16px; background: color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)); color: var(--ac-primary); font-size: 34px; animation: loaderPulse 1.15s ease-in-out infinite; }
    @keyframes loaderPulse { 0%, 100% { transform: translateY(0); opacity: .72; } 50% { transform: translateY(-2px); opacity: 1; } }
    .dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .panel, .encounter-card, .encounter-list, .queue-card { border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface); box-shadow: 0 16px 34px rgba(15, 23, 42, .05); }
    .panel { padding: 16px; }
    .panel-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .panel-head > span { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; background: var(--ac-primary-light); color: var(--ac-primary); }
    .panel h2, .encounter-list h2, .encounter-card h2 { margin: 0; color: var(--ac-text); }
    .panel-head small { display: block; margin-top: 3px; color: var(--ac-muted); font-weight: 800; }
    .doctor-queue-panel { background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 7%, var(--ac-surface)), var(--ac-surface)); }
    .doctor-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .doctor-metrics span { min-height: 86px; display: grid; align-content: center; gap: 6px; padding: 14px; border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border)); border-radius: 11px; background: var(--ac-surface); }
    .doctor-metrics small { color: var(--ac-muted); font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
    .doctor-metrics strong { color: var(--ac-text); font-size: 28px; line-height: 1; }
    .compact-list, .queue-workspace { display: grid; gap: 10px; }
    .visit-row, .encounter-list button { width: 100%; min-width: 0; display: grid; gap: 4px; border: 1px solid var(--ac-border); border-radius: 10px; padding: 11px; background: color-mix(in srgb, var(--ac-surface) 88%, transparent); color: var(--ac-text); text-align: left; cursor: pointer; }
    .visit-row:hover, .encounter-list button:hover, .encounter-list button.active { border-color: color-mix(in srgb, var(--ac-primary) 38%, var(--ac-border)); box-shadow: 0 12px 24px color-mix(in srgb, var(--ac-primary) 8%, transparent); }
    .token-pill { width: fit-content; border-radius: 999px; padding: 4px 9px; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 900; }
    .token-pill.consultation { background: #f0fdfa; color: #0f766e; }
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
    .encounter-layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 12px; align-items: start; }
    .encounter-list { display: grid; gap: 10px; padding: 14px; max-height: 640px; overflow: auto; }
    .encounter-card { padding: 16px; min-height: 420px; }
    .encounter-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
    .encounter-head span { color: var(--ac-muted); }
    .status-badge { display: inline-flex; min-height: 28px; align-items: center; border-radius: 999px; padding: 4px 10px; background: #f0fdfa; color: #0f766e; font-size: 12px; font-weight: 900; }
    .summary-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .summary-strip span { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-subtle); }
    .summary-strip strong { color: var(--ac-text); }
    .encounter-workspace { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 12px; align-items: start; }
    .patient-snapshot { position: sticky; top: 10px; display: grid; gap: 12px; padding: 14px; border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border)); border-radius: 12px; background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), var(--ac-surface)); }
    .snapshot-head { display: flex; gap: 10px; align-items: center; }
    .snapshot-head > span { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; background: var(--ac-primary-light); color: var(--ac-primary); }
    .snapshot-head h3, .section-title h3 { margin: 0; color: var(--ac-text); }
    .snapshot-grid, .snapshot-detail-grid { display: grid; gap: 8px; }
    .snapshot-grid span, .snapshot-detail-grid span, .metric-tile { display: grid; gap: 3px; min-width: 0; padding: 10px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); }
    .snapshot-grid small, .snapshot-detail-grid small, .metric-tile small { color: var(--ac-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .03em; }
    .snapshot-grid strong, .snapshot-detail-grid strong, .metric-tile strong { color: var(--ac-text); overflow-wrap: anywhere; }
    .snapshot-detail-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .clinical-board { min-width: 0; display: grid; gap: 10px; }
    .encounter-section-tabs { display: flex; gap: 7px; overflow-x: auto; padding: 6px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-subtle); scrollbar-color: color-mix(in srgb, var(--ac-primary) 24%, #cbd5e1) transparent; scrollbar-width: thin; }
    .encounter-section-tabs button { min-height: 38px; display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 9px; padding: 0 11px; white-space: nowrap; background: transparent; color: var(--ac-muted); font: inherit; font-size: 12px; font-weight: 900; cursor: pointer; }
    .encounter-section-tabs button.active { background: var(--ac-surface); color: var(--ac-primary); box-shadow: 0 10px 22px rgba(15, 23, 42, .08); }
    .encounter-section-tabs .material-symbols-rounded { font-size: 19px; }
    .section-panel { min-height: 360px; padding: 14px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface); }
    .section-title { margin-bottom: 12px; }
    .section-title p { margin: 4px 0 0; color: var(--ac-muted); }
    .clinical-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
    .clinical-grid.single { grid-template-columns: 1fr; }
    .field, .check-field { min-width: 0; display: grid; gap: 7px; color: var(--ac-muted); font-weight: 850; }
    .field.wide { grid-column: span 2; }
    .field input, .field select { width: 100%; min-height: 42px; border: 1px solid var(--ac-border); border-radius: 10px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text); font: inherit; font-weight: 760; outline: 0; }
    .field input:focus, .field select:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent); }
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
    @media (max-width: 1180px) {
      .stats-row, .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .toolbar, .encounter-layout, .encounter-workspace { grid-template-columns: 1fr; }
      .patient-snapshot { position: static; }
      .transfer-panel { grid-template-columns: 1fr; }
      .table-head { display: none; }
      .table-row { grid-template-columns: 1fr; }
      .clinical-grid, .snapshot-detail-grid { grid-template-columns: 1fr; }
      .field.wide { grid-column: auto; }
    }
    @media (max-width: 720px) {
      .page-header, .header-actions { flex-direction: column; align-items: stretch; }
      .stats-row, .dashboard-grid, .summary-strip, .doctor-metrics { grid-template-columns: 1fr; }
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
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<OpdTab>('dashboard');
  protected readonly activeEncounterSection = signal<OpdEncounterSection>('snapshot');
  protected readonly selectedVisit = signal<OpdVisitVm | null>(null);
  protected readonly transferVisit = signal<OpdVisitVm | null>(null);
  protected readonly encounterForm = signal<OpdEncounterForm>(emptyEncounterForm());
  protected readonly clinicalForm = signal<OpdClinicalForm>(emptyClinicalForm());
  protected searchQuery = '';
  protected doctorFilter = '';
  protected transferDoctorId = '';

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
    { id: 'complaints', label: 'Chief Complaint', icon: 'record_voice_over' },
    { id: 'history', label: 'History', icon: 'history_edu' },
    { id: 'examination', label: 'Examination', icon: 'health_and_safety' },
    { id: 'diagnosis', label: 'Diagnosis', icon: 'diagnosis' },
    { id: 'prescription', label: 'Prescription', icon: 'medication' },
    { id: 'lab-orders', label: 'Lab Orders', icon: 'biotech' },
    { id: 'procedures', label: 'Procedures', icon: 'medical_services' },
    { id: 'notes', label: 'Clinical Notes', icon: 'clinical_notes' },
    { id: 'follow-up', label: 'Follow-up', icon: 'event_repeat' }
  ];

  private readonly appointmentService = inject(AppointmentManagementService);
  private readonly patientService = inject(PatientManagementService);
  private readonly doctorService = inject(DoctorManagementService);
  private readonly opdService = inject(OpdManagementService);
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
          ? new Date(a.appointment.startsAt).getTime() - new Date(b.appointment.startsAt).getTime()
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
    isToday(visit.appointment.startsAt)
    && ['NO_SHOW', 'NOSHOW'].includes(visit.statusCode)
  ));

  protected readonly encounterCandidates = computed(() => [
    ...this.activeConsultations(),
    ...this.waitingQueue()
  ]);

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
    completed: this.completedVisits().filter(visit => isToday(visit.appointment.startsAt) || (visit.queue?.arrivedAt && isToday(visit.queue.arrivedAt))).length,
    followUps: this.visibleFollowUps().length,
    noShows: this.noShowVisits().length
  }));

  protected readonly statCards = computed(() => {
    const stats = this.stats();
    return [
      { label: 'Waiting', value: formatNumber(stats.waiting), icon: 'queue', color: '#2563eb', bg: '#eff6ff' },
      { label: 'In Consultation', value: formatNumber(stats.inConsultation), icon: 'clinical_notes', color: '#0f766e', bg: '#f0fdfa' },
      { label: 'Completed', value: formatNumber(stats.completed), icon: 'task_alt', color: '#059669', bg: '#ecfdf5' },
      { label: 'Follow-ups', value: formatNumber(stats.followUps), icon: 'event_repeat', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'No Shows', value: formatNumber(stats.noShows), icon: 'event_busy', color: '#dc2626', bg: '#fef2f2' }
    ];
  });

  protected readonly doctorQueueSummary = computed(() => {
    const doctor = this.doctors().find(item => item.doctorGuid === this.doctorFilter) ?? null;
    const visits = this.visitModels().filter(visit => !doctor || visit.appointment.doctorId === doctor.doctorGuid);
    return {
      doctorName: doctor ? `${doctor.fullName} · ${doctor.departmentName}` : 'All doctors',
      waiting: formatNumber(visits.filter(visit => this.waitingQueue().some(item => item.appointment.id === visit.appointment.id)).length),
      current: formatNumber(visits.filter(visit => ['DRAFT', 'IN_PROGRESS', 'IN_CONSULTATION'].includes(visit.consultationStatus)).length),
      completed: formatNumber(visits.filter(visit => (visit.consultationStatus === 'COMPLETED' || visit.statusCode === 'COMPLETED') && (isToday(visit.appointment.startsAt) || (visit.queue?.arrivedAt && isToday(visit.queue.arrivedAt)))).length)
    };
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.applyRouteContext();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [appointments, queues, patients, doctors, consultations, followUps, labTests] = await Promise.all([
        this.appointmentService.list(1, 100),
        this.appointmentService.listQueue(1, 100),
        this.patientService.search('', '', '', '', '', 1, 100),
        this.doctorService.search({ searchText: '', departmentName: '', specializationName: '', branchName: '', employmentType: '', statusCode: '', pageNumber: 1, pageSize: 100 }),
        this.opdService.listConsultations(1, 100),
        this.opdService.listFollowUps(1, 100),
        this.opdService.listLabTests(1, 100)
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
    } finally {
      this.loading.set(false);
    }
  }

  protected clearFilters(): void {
    this.searchQuery = '';
    this.doctorFilter = '';
  }

  protected goToAppointments(): void {
    void this.router.navigate(['/appointments']);
  }

  protected selectVisit(visit: OpdVisitVm, tab: OpdTab = 'encounter'): void {
    this.selectedVisit.set(visit);
    this.encounterForm.set(toEncounterForm(visit, 'IN_PROGRESS'));
    this.clinicalForm.set(emptyClinicalForm(visit.consultation?.notes ?? ''));
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
  }

  protected removePrescriptionItem(index: number): void {
    this.clinicalForm.update(form => ({ ...form, prescriptions: form.prescriptions.filter((_, itemIndex) => itemIndex !== index) }));
  }

  protected addLabOrderDraft(): void {
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
  }

  protected removeLabOrder(index: number): void {
    this.clinicalForm.update(form => ({ ...form, labOrders: form.labOrders.filter((_, itemIndex) => itemIndex !== index) }));
  }

  protected addProcedure(): void {
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
  }

  protected removeProcedure(index: number): void {
    this.clinicalForm.update(form => ({ ...form, procedures: form.procedures.filter((_, itemIndex) => itemIndex !== index) }));
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

      await this.createClinicalChildRecords(response.data);
      this.upsertConsultation(response.data);
      this.encounterForm.set(toEncounterForm({ ...visit, consultation: response.data }, response.data.statusCode === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS'));
      this.toast.success(statusCode === 'COMPLETED' ? 'Clinical record completed' : 'Clinical record saved');
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

  private async createClinicalChildRecords(consultation: OpdConsultationRecord): Promise<void> {
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
    if (form.prescriptions.length > 0 && !prescriptionId) {
      const response = await this.opdService.createPrescription(consultation.id, buildPrescriptionInstructions(form.prescriptions));
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
      prescriptionId
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
    labOrders: [],
    labOrderDraft: emptyLabOrderForm(),
    procedures: [],
    procedureDraft: emptyProcedureForm(),
    clinicalNotes: notes,
    followUp: {
      followUpRequired: false,
      followUpDate: '',
      preferredDoctorId: '',
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
  return { medicine: '', dosage: '', route: 'Oral', frequency: '', duration: '', instructions: '' };
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
    ['Prescription', form.prescriptions.map(item => [item.medicine, item.dosage, item.route, item.frequency, item.duration, item.instructions].filter(Boolean).join(' | '))],
    ['Lab Orders', form.labOrders.map(item => {
      const test = labTests.find(testItem => testItem.id === item.testId);
      return [item.testCategory, test?.name ?? 'Selected test', item.priority, item.notes].filter(Boolean).join(' | ');
    })],
    ['Procedures', form.procedures.map(item => [item.procedure, item.charge ? formatCurrency(toAmount(item.charge)) : '', item.notes].filter(Boolean).join(' | '))],
    ['Follow-up', [
      `Required: ${form.followUp.followUpRequired ? 'Yes' : 'No'}`,
      `Date: ${form.followUp.followUpDate || '-'}`,
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

function buildPrescriptionInstructions(items: OpdPrescriptionItemForm[]): string {
  return items.map(item => [item.medicine, item.dosage, item.route, item.frequency, item.duration, item.instructions].filter(Boolean).join(' | ')).join('\n');
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
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
}

function timeInputValue(date: Date): string {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(11, 16);
}

function dateKey(value: string): string {
  return inputValue(new Date(value));
}

function isToday(value: string): boolean {
  return dateKey(value) === todayInputValue();
}

function isDateTodayOrFuture(value: string): boolean {
  return dateKey(value) >= todayInputValue();
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
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
