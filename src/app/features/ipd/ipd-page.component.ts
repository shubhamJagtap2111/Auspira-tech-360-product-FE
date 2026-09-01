import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { LabTest } from '../laboratory/laboratory.models';
import { LaboratoryService } from '../laboratory/laboratory.service';
import {
  CreateIpdAdmissionRequest,
  IpdAdmissionListItem,
  IpdBedStatus,
  IpdDashboard,
  IpdDoctorRound,
  IpdOption,
  IpdRoom,
  IpdVitalRecord,
  IpdWardOccupancy,
  SaveIpdBedRequest,
  SaveIpdDoctorRoundRequest,
  SaveIpdRoomRequest,
  SaveIpdVitalRequest,
  SaveIpdWardRequest
} from './ipd-management.models';
import { IpdManagementService } from './ipd-management.service';

type IpdTab = 'dashboard' | 'admissions' | 'beds' | 'patients' | 'care' | 'transfers' | 'billing' | 'discharge' | 'reports';
type IpdDetailTab = 'overview' | 'clinical' | 'rounds' | 'nursing' | 'vitals' | 'medication' | 'orders' | 'lab' | 'procedures' | 'transfers' | 'billing' | 'documents' | 'discharge' | 'activity';
type FacilityTab = 'wards' | 'rooms' | 'beds';

interface IpdTabItem {
  key: IpdTab;
  label: string;
  icon: string;
}

interface IpdDetailTabItem {
  key: IpdDetailTab;
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
                      <div class="donut-center">
                        <strong>{{ model.summary.totalBeds }}</strong>
                        <span>Total beds</span>
                      </div>
                    </div>
                    <div class="legend">
                      <span>
                        <i class="occupied"></i>
                        <em><strong>Occupied</strong><small>{{ bedStatusPercent(model.summary.occupiedBeds) }} used</small></em>
                        <b>{{ model.summary.occupiedBeds }}</b>
                      </span>
                      <span>
                        <i class="available"></i>
                        <em><strong>Available</strong><small>{{ bedStatusPercent(model.summary.availableBeds) }} free</small></em>
                        <b>{{ model.summary.availableBeds }}</b>
                      </span>
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
                    <h2>IPD admissions</h2>
                  </div>
                  <div class="inline-actions">
                    <button class="ac-btn ac-btn-primary" type="button" (click)="openAdmissionPanel()">
                      <span class="material-symbols-rounded">add</span>
                      New Admission
                    </button>
                  </div>
                </div>

                <div class="admission-filters">
                  <div class="search-field">
                    <span class="material-symbols-rounded">search</span>
                    <input type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Search patient, MRN, or admission ID" />
                  </div>
                  <ac-dropdown name="admissionStatus" [ngModel]="admissionStatusFilter()" (ngModelChange)="admissionStatusFilter.set($event)" [options]="statusFilterOptions" />
                  <ac-dropdown name="admissionWard" [ngModel]="admissionWardFilter()" (ngModelChange)="admissionWardFilter.set($event)" [options]="wardFilterOptions()" />
                  <ac-dropdown name="admissionDoctor" [ngModel]="admissionDoctorFilter()" (ngModelChange)="admissionDoctorFilter.set($event)" [options]="doctorFilterOptions()" />
                  <ac-dropdown name="admissionDateRange" [ngModel]="admissionDateFilter()" (ngModelChange)="admissionDateFilter.set($event)" [options]="dateRangeOptions" />
                </div>

                @if (admissionPanelOpen()) {
                  <article class="admission-wizard">
                    <div class="wizard-head">
                      <div>
                        <p class="ac-eyebrow">New admission</p>
                        <h3>{{ admissionWizardTitle() }}</h3>
                      </div>
                      <button class="icon-btn" type="button" (click)="closeAdmissionPanel()" aria-label="Close admission workflow">
                        <span class="material-symbols-rounded">close</span>
                      </button>
                    </div>

                    <div class="admission-stepper">
                      @for (step of admissionSteps; track step.label; let index = $index) {
                        <button type="button" class="admission-step" [class.done]="index + 1 < admissionStep()" [class.active]="index + 1 === admissionStep()" (click)="goAdmissionStep(index + 1)">
                          <span>{{ index + 1 }}</span>
                          <strong>{{ step.label }}</strong>
                        </button>
                      }
                    </div>

                    @switch (admissionStep()) {
                      @case (1) {
                        <div class="wizard-grid patient-step">
                          <label class="wide-field" [class.invalid]="fieldError('patientId')">
                            <span>Patient *</span>
                            <ac-dropdown name="patientId" [(ngModel)]="admissionForm.patientId" [options]="patientOptions(model.patients)" />
                            @if (fieldError('patientId')) { <small>{{ fieldError('patientId') }}</small> }
                          </label>
                          @if (selectedAdmissionPatient(); as patient) {
                            <article class="selected-patient-card">
                              <div class="avatar">{{ initials(patient.label) }}</div>
                              <div>
                                <strong>{{ patient.label }}</strong>
                                <span>{{ patient.meta }} · {{ patient.age || '-' }} yrs · {{ patient.gender || 'Not specified' }}</span>
                              </div>
                              <b>{{ patient.bloodGroup || 'Blood group NA' }}</b>
                              <small>{{ patient.mobileNo || 'Mobile not captured' }}</small>
                            </article>
                          }
                          <div class="wizard-actions-inline">
                            <button class="ac-btn ac-btn-secondary" type="button">
                              <span class="material-symbols-rounded">person_search</span>
                              Select Existing Patient
                            </button>
                            <button class="ac-btn ac-btn-secondary" type="button" (click)="registerPatientFromAdmission()">
                              <span class="material-symbols-rounded">person_add</span>
                              Register New Patient
                            </button>
                          </div>
                        </div>
                      }
                      @case (2) {
                        <div class="wizard-grid">
                          <label [class.invalid]="fieldError('source')">
                            <span>Admission Source *</span>
                            <ac-dropdown name="source" [(ngModel)]="admissionForm.source" [options]="sourceOptions" />
                            @if (fieldError('source')) { <small>{{ fieldError('source') }}</small> }
                          </label>
                          <label [class.invalid]="fieldError('admittedAt')">
                            <span>Admission Date / Time *</span>
                            <input name="admittedAt" type="datetime-local" [ngModel]="dateTimeLocalValue(admissionForm.admittedAt)" (ngModelChange)="setAdmissionDate($event)" />
                            @if (fieldError('admittedAt')) { <small>{{ fieldError('admittedAt') }}</small> }
                          </label>
                          <label [class.invalid]="fieldError('admissionType')">
                            <span>Admission Type *</span>
                            <ac-dropdown name="admissionType" [(ngModel)]="admissionForm.admissionType" [options]="admissionTypeOptions" />
                            @if (fieldError('admissionType')) { <small>{{ fieldError('admissionType') }}</small> }
                          </label>
                          <label>
                            <span>Referred From</span>
                            <ac-dropdown name="referredFrom" [(ngModel)]="admissionForm.referredFrom" [options]="referralOptions" />
                          </label>
                          <label class="wide-field">
                            <span>Previous Encounter</span>
                            <input name="previousEncounter" [(ngModel)]="admissionForm.previousEncounter" placeholder="OPD encounter ID or handoff note" />
                          </label>
                          <label class="wide-field" [class.invalid]="fieldError('reason')">
                            <span>Admission Reason *</span>
                            <textarea name="reason" [(ngModel)]="admissionForm.reason" rows="3" placeholder="Clinical reason, source handoff, or admission instruction"></textarea>
                            @if (fieldError('reason')) { <small>{{ fieldError('reason') }}</small> }
                          </label>
                        </div>
                      }
                      @case (3) {
                        <div class="wizard-grid">
                          <label><span>Primary Diagnosis</span><input name="primaryDiagnosis" [(ngModel)]="admissionForm.primaryDiagnosis" placeholder="Flexible diagnosis" /></label>
                          <label><span>Secondary Diagnosis</span><input name="secondaryDiagnosis" [(ngModel)]="admissionForm.secondaryDiagnosis" placeholder="Optional" /></label>
                          <label><span>Known Allergies</span><input name="knownAllergies" [(ngModel)]="admissionForm.knownAllergies" placeholder="None recorded" /></label>
                          <label><span>Blood Group</span><input name="bloodGroup" [(ngModel)]="admissionForm.bloodGroup" placeholder="O-, AB+, etc." /></label>
                          <label><span>Current Medication</span><input name="currentMedication" [(ngModel)]="admissionForm.currentMedication" placeholder="Medication at admission" /></label>
                          <label><span>Infection Risk</span><ac-dropdown name="infectionRisk" [(ngModel)]="admissionForm.infectionRisk" [options]="infectionRiskOptions" /></label>
                          <label class="wide-field"><span>Presenting Complaint</span><textarea name="presentingComplaint" [(ngModel)]="admissionForm.presentingComplaint" rows="3"></textarea></label>
                          <label class="wide-field"><span>Medical History</span><textarea name="medicalHistory" [(ngModel)]="admissionForm.medicalHistory" rows="3"></textarea></label>
                          <label class="wide-field"><span>Admission Notes</span><textarea name="admissionNotes" [(ngModel)]="admissionForm.admissionNotes" rows="3"></textarea></label>
                        </div>
                      }
                      @case (4) {
                        <div class="wizard-grid">
                          <label [class.invalid]="fieldError('departmentName')">
                            <span>Department *</span>
                            <ac-dropdown name="departmentName" [(ngModel)]="admissionForm.departmentName" [options]="departmentOptions()" />
                            @if (fieldError('departmentName')) { <small>{{ fieldError('departmentName') }}</small> }
                          </label>
                          <label [class.invalid]="fieldError('doctorId')">
                            <span>Attending Doctor *</span>
                            <ac-dropdown name="doctorId" [(ngModel)]="admissionForm.doctorId" [options]="doctorOptions(model.doctors)" />
                            @if (fieldError('doctorId')) { <small>{{ fieldError('doctorId') }}</small> }
                          </label>
                          <label>
                            <span>Consulting Doctor</span>
                            <ac-dropdown name="consultingDoctor" [(ngModel)]="consultingDoctorId" [options]="doctorOptions(model.doctors)" />
                          </label>
                          <label [class.invalid]="fieldError('priority')">
                            <span>Admission Priority *</span>
                            <ac-dropdown name="priority" [(ngModel)]="admissionForm.priority" [options]="priorityOptions" />
                            @if (fieldError('priority')) { <small>{{ fieldError('priority') }}</small> }
                          </label>
                        </div>
                      }
                      @case (5) {
                        <div class="wizard-grid">
                          <label>
                            <span>Ward *</span>
                            <ac-dropdown name="bedWard" [ngModel]="selectedWardName()" (ngModelChange)="selectWard($event)" [options]="wardSelectionOptions()" />
                          </label>
                          <label>
                            <span>Room *</span>
                            <ac-dropdown name="bedRoom" [ngModel]="selectedRoomName()" (ngModelChange)="selectRoom($event)" [options]="roomSelectionOptions()" />
                          </label>
                          <div class="bed-picker wide-field">
                            @for (bed of workflowBeds(); track bed.bedId) {
                              <button type="button" class="bed-choice" [class.selected]="admissionForm.bedId === bed.bedId" [class.disabled]="bed.statusCode.toUpperCase() !== 'AVAILABLE' && admissionForm.bedId !== bed.bedId" (click)="selectAdmissionBed(bed)">
                                <span class="material-symbols-rounded">bed</span>
                                <strong>{{ bed.bedNo }}</strong>
                                <small>{{ admissionForm.bedId === bed.bedId ? 'Reserved' : statusText(bed.statusCode) }}</small>
                              </button>
                            } @empty {
                              <div class="empty-state">Select a ward and room to view available beds.</div>
                            }
                          </div>
                        </div>
                      }
                      @case (6) {
                        <div class="review-grid">
                          <span><b>Patient</b>{{ selectedAdmissionPatient()?.label || '-' }} · {{ selectedAdmissionPatient()?.meta || '-' }}</span>
                          <span><b>Admission</b>{{ admissionForm.departmentName || '-' }} · {{ statusText(admissionForm.source) }}</span>
                          <span><b>Doctor</b>{{ selectedDoctorName() }}</span>
                          <span><b>Priority</b>{{ statusText(admissionForm.priority) }}</span>
                          <span class="wide-review"><b>Reason</b>{{ admissionForm.reason || '-' }}</span>
                          <span><b>Ward</b>{{ selectedBed()?.wardName || '-' }}</span>
                          <span><b>Bed</b>{{ selectedBed()?.bedNo || '-' }}</span>
                        </div>
                      }
                    }

                    <div class="wizard-footer">
                      <button class="ac-btn ac-btn-secondary" type="button" [disabled]="admissionStep() === 1 || saving()" (click)="previousAdmissionStep()">
                        <span class="material-symbols-rounded">arrow_back</span>
                        Back
                      </button>
                      <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="saveAdmissionDraft()">
                        <span class="material-symbols-rounded">save</span>
                        Save as Draft
                      </button>
                      @if (admissionStep() < 6) {
                        <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="nextAdmissionStep()">
                          <span class="material-symbols-rounded">arrow_forward</span>
                          Next
                        </button>
                      } @else {
                        <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="confirmAdmission()">
                          <span class="material-symbols-rounded">{{ saving() ? 'progress_activity' : 'task_alt' }}</span>
                          Confirm Admission
                        </button>
                      }
                    </div>
                  </article>
                }
                <div class="records-table">
                  <div class="table-head admissions-head">
                    <span>Admission ID</span><span>Patient</span><span>Doctor</span><span>Ward / Bed</span><span>Admitted On</span><span>Status</span><span>Action</span>
                  </div>
                  @for (admission of filteredAdmissions(); track admission.admissionId) {
                    <div class="table-row admissions-row">
                      <span><strong>{{ admission.admissionNo }}</strong><small>{{ statusText(admission.admissionSource) }}</small></span>
                      <span><strong>{{ admission.patientName }}</strong><small>{{ admission.medicalRecordNo }} · day {{ admission.stayDays }}</small></span>
                      <span>{{ admission.doctorName }}<small>{{ admission.departmentName }}</small></span>
                      <span>{{ admission.wardName || 'Allocation pending' }} <small>{{ admission.bedNo || '-' }}</small></span>
                      <span>{{ formatDate(admission.admittedAt) }}</span>
                      <span><b class="status-pill">{{ statusText(admission.statusCode) }}</b></span>
                      <span><button class="ac-btn ac-btn-secondary" type="button" (click)="openAdmissionRecord(admission)">{{ admission.statusCode === 'DRAFT' || admission.statusCode === 'PENDING_ADMISSION' ? 'Continue' : 'View' }}</button></span>
                    </div>
                  } @empty {
                    <div class="empty-state">No admissions match the current search.</div>
                  }
                </div>
              </section>
            }

            @case ('beds') {
              <section class="facility-workspace">
                <article class="panel">
                  <div class="section-toolbar">
                    <div>
                      <p class="ac-eyebrow">Ward, room & bed management</p>
                      <h2>Hospital bed structure</h2>
                    </div>
                    <div class="facility-tabs">
                      <button type="button" [class.active]="facilityTab() === 'wards'" (click)="facilityTab.set('wards')">Wards</button>
                      <button type="button" [class.active]="facilityTab() === 'rooms'" (click)="facilityTab.set('rooms')">Rooms</button>
                      <button type="button" [class.active]="facilityTab() === 'beds'" (click)="facilityTab.set('beds')">Beds</button>
                    </div>
                  </div>

                  @switch (facilityTab()) {
                    @case ('wards') {
                      <form class="facility-form" (ngSubmit)="saveWard()">
                        <label><span>Ward Name *</span><input name="wardName" [(ngModel)]="wardForm.wardName" placeholder="General Ward" /></label>
                        <label><span>Ward Code *</span><input name="wardCode" [(ngModel)]="wardForm.wardCode" placeholder="GEN" /></label>
                        <label><span>Ward Type</span><ac-dropdown name="wardType" [(ngModel)]="wardForm.wardType" [options]="wardTypeOptions" /></label>
                        <label><span>Department</span><input name="department" [(ngModel)]="wardForm.department" placeholder="General Medicine" /></label>
                        <label><span>Floor</span><input name="wardFloor" [(ngModel)]="wardForm.floor" placeholder="Ground" /></label>
                        <label><span>Capacity</span><input name="wardCapacity" type="number" min="0" [(ngModel)]="wardForm.capacity" /></label>
                        <label><span>Status</span><ac-dropdown name="wardStatus" [(ngModel)]="wardForm.statusCode" [options]="facilityStatusOptions" /></label>
                        <label class="wide-field"><span>Description</span><textarea name="wardDescription" rows="2" [(ngModel)]="wardForm.description"></textarea></label>
                        <div class="form-actions compact-actions">
                          <button class="ac-btn ac-btn-secondary" type="button" (click)="resetWardForm()">Clear</button>
                          <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">Save Ward</button>
                        </div>
                      </form>
                      <div class="facility-grid">
                        @for (ward of model.wards; track ward.wardId) {
                          <article class="facility-card">
                            <div>
                              <p class="ac-eyebrow">{{ ward.wardType }}</p>
                              <h3>{{ ward.wardName }}</h3>
                              <span>{{ ward.wardCode }} · {{ ward.department }} · {{ ward.floor }}</span>
                            </div>
                            <b>{{ ward.totalBeds }}/{{ ward.capacity || ward.totalBeds }} beds</b>
                            <small>{{ ward.occupiedBeds }} occupied · {{ ward.availableBeds }} available</small>
                            <div class="inline-actions">
                              <button class="link-btn" type="button" (click)="editWard(ward)">Edit</button>
                              <button class="link-btn danger" type="button" (click)="deleteWard(ward)">Delete</button>
                            </div>
                          </article>
                        }
                      </div>
                    }
                    @case ('rooms') {
                      <form class="facility-form" (ngSubmit)="saveRoom()">
                        <label><span>Ward *</span><ac-dropdown name="roomWardId" [(ngModel)]="roomForm.wardId" [options]="wardIdOptions()" /></label>
                        <label><span>Room Number *</span><input name="roomNumber" [(ngModel)]="roomForm.roomNumber" placeholder="Room 101" /></label>
                        <label><span>Room Type</span><ac-dropdown name="roomType" [(ngModel)]="roomForm.roomType" [options]="roomTypeOptions" /></label>
                        <label><span>Floor</span><input name="roomFloor" [(ngModel)]="roomForm.floor" placeholder="Ground" /></label>
                        <label><span>Capacity</span><input name="roomCapacity" type="number" min="0" [(ngModel)]="roomForm.capacity" /></label>
                        <label><span>Status</span><ac-dropdown name="roomStatus" [(ngModel)]="roomForm.statusCode" [options]="facilityStatusOptions" /></label>
                        <div class="form-actions compact-actions">
                          <button class="ac-btn ac-btn-secondary" type="button" (click)="resetRoomForm()">Clear</button>
                          <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">Save Room</button>
                        </div>
                      </form>
                      <div class="facility-grid">
                        @for (room of model.rooms; track room.roomId) {
                          <article class="facility-card">
                            <div>
                              <p class="ac-eyebrow">{{ room.wardName }}</p>
                              <h3>{{ room.roomNumber }}</h3>
                              <span>{{ statusText(room.roomType) }} · {{ room.floor }}</span>
                            </div>
                            <b>{{ room.totalBeds }}/{{ room.capacity || room.totalBeds }} beds</b>
                            <small>{{ room.occupiedBeds }} occupied · {{ room.availableBeds }} available</small>
                            <div class="inline-actions">
                              <button class="link-btn" type="button" (click)="editRoom(room)">Edit</button>
                              <button class="link-btn danger" type="button" (click)="deleteRoom(room)">Delete</button>
                            </div>
                          </article>
                        }
                      </div>
                    }
                    @case ('beds') {
                      <form class="facility-form" (ngSubmit)="saveBed()">
                        <label><span>Ward *</span><ac-dropdown name="bedWardId" [(ngModel)]="bedForm.wardId" [options]="wardIdOptions()" /></label>
                        <label><span>Room *</span><ac-dropdown name="bedRoomId" [(ngModel)]="bedForm.roomId" [options]="roomIdOptions(bedForm.wardId)" /></label>
                        <label><span>Bed Number *</span><input name="bedNumber" [(ngModel)]="bedForm.bedNumber" placeholder="G-101-A" /></label>
                        <label><span>Bed Type</span><ac-dropdown name="bedType" [(ngModel)]="bedForm.bedType" [options]="bedTypeOptions" /></label>
                        <label><span>Status</span><ac-dropdown name="bedStatus" [(ngModel)]="bedForm.statusCode" [options]="bedStatusOptions" /></label>
                        <label><span>Daily Charge</span><input name="dailyCharge" type="number" min="0" [(ngModel)]="bedForm.dailyCharge" /></label>
                        <div class="form-actions compact-actions">
                          <button class="ac-btn ac-btn-secondary" type="button" (click)="resetBedForm()">Clear</button>
                          @if (isSelectedBedCleaning()) {
                            <button class="ac-btn ac-btn-secondary" type="button" [disabled]="saving()" (click)="markSelectedBedAvailable()">
                              <span class="material-symbols-rounded">cleaning_services</span>
                              Mark Cleaned & Available
                            </button>
                          }
                          <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">Save Bed</button>
                        </div>
                      </form>
                      <div class="bed-layout compact-bed-layout">
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
                                <button type="button" class="bed-tile" [class]="bedStatusClass(bed)" (click)="editBed(bed)">
                                  <span class="material-symbols-rounded">bed</span>
                                  <strong>{{ bed.bedNo }}</strong>
                                  <small>{{ bed.roomNumber }} · {{ bed.currentPatientName || statusText(bed.statusCode) }}</small>
                                </button>
                              }
                            </div>
                          </article>
                        } @empty {
                          <article class="panel"><div class="empty-state">No beds configured for IPD.</div></article>
                        }
                      </div>
                    }
                  }
                </article>
              </section>
            }

            @case ('patients') {
              @if (activePatientDetailOpen() && selectedAdmission(); as selected) {
                <section class="admission-workspace">
                  <article class="panel admission-hero">
                    <div class="hero-nav">
                      <button class="link-btn back-link" type="button" (click)="closeInpatientDetail()">
                        <span class="material-symbols-rounded">arrow_back</span>
                        IPD Admissions
                      </button>
                      <button class="ac-btn ac-btn-secondary" type="button" (click)="printAdmissionSummary()">
                        <span class="material-symbols-rounded">print</span>
                        Print
                      </button>
                    </div>
                    <div class="admission-identity">
                      <div class="avatar large">{{ initials(selected.patientName) }}</div>
                      <div>
                        <p class="ac-eyebrow">IPD Admission Detail</p>
                        <h2>{{ selected.patientName }}</h2>
                        <p>{{ selected.medicalRecordNo }} · {{ selected.admissionNo }} · {{ statusText(selected.statusCode) }}</p>
                      </div>
                      <span class="status-pill">{{ statusText(selected.statusCode) }}</span>
                    </div>
                    <div class="admission-meta-line">
                      <span><b>Ward</b>{{ selected.wardName || 'Ward pending' }}</span>
                      <span><b>Bed</b>{{ selected.bedNo || 'Bed pending' }}</span>
                      <span><b>Doctor</b>{{ selected.doctorName || 'Unassigned' }}</span>
                      <span><b>Stay</b>Day {{ selected.stayDays || 1 }}</span>
                    </div>
                  </article>

                  <section class="detail-kpis">
                    <article>
                      <span class="material-symbols-rounded">event_available</span>
                      <div><strong>{{ selected.stayDays || 1 }} Days</strong><small>Admission Day</small></div>
                    </article>
                    <article>
                      <span class="material-symbols-rounded">bed</span>
                      <div><strong>{{ selected.bedNo || 'Pending' }}</strong><small>Current Bed</small></div>
                    </article>
                    <article>
                      <span class="material-symbols-rounded">receipt_long</span>
                      <div><strong>{{ formatMoney(selected.outstanding || 0) }}</strong><small>Outstanding</small></div>
                    </article>
                    <article>
                      <span class="material-symbols-rounded">assignment</span>
                      <div><strong>{{ selected.activeOrders || 0 }}</strong><small>Active Orders</small></div>
                    </article>
                  </section>

                  <nav class="detail-tabs" aria-label="IPD admission detail tabs">
                    @for (tab of detailTabs; track tab.key) {
                      <button type="button" [class.active]="activeDetailTab() === tab.key" (click)="setDetailTab(tab.key)">
                        <span class="material-symbols-rounded">{{ tab.icon }}</span>
                        {{ tab.label }}
                      </button>
                    }
                  </nav>

                  @switch (activeDetailTab()) {
                    @case ('overview') {
                      <section class="overview-workspace">
                        <article class="panel overview-section">
                          <p class="ac-eyebrow">Section 1</p>
                          <h2>Admission Summary</h2>
                          <div class="overview-list">
                            <span><b>Admission ID</b>{{ selected.admissionNo }}</span>
                            <span><b>Admitted On</b>{{ formatDate(selected.admittedAt) }}, {{ formatTime(selected.admittedAt) }}</span>
                            <span><b>Source</b>{{ statusText(selected.admissionSource) }}</span>
                            <span><b>Department</b>{{ selected.departmentName || 'General Medicine' }}</span>
                            <span><b>Attending Doctor</b>{{ selected.doctorName || 'Unassigned' }}</span>
                          </div>
                        </article>

                        <article class="panel overview-section">
                          <p class="ac-eyebrow">Section 2</p>
                          <h2>Current Location</h2>
                          <div class="location-strip">
                            <span><b>Ward</b>{{ selected.wardName || 'Pending' }}</span>
                            <span><b>Room</b>{{ selected.roomNumber || roomFromBed(selected.bedNo) || 'Pending' }}</span>
                            <span><b>Bed</b>{{ selected.bedNo || 'Pending' }}</span>
                          </div>
                        </article>

                        <article class="panel overview-section">
                          <p class="ac-eyebrow">Section 3</p>
                          <h2>Clinical Snapshot</h2>
                          <div class="clinical-snapshot">
                            <span><b>Primary Diagnosis</b>{{ selected.primaryDiagnosis || 'Not captured' }}</span>
                            <span><b>Allergies</b>{{ selected.knownAllergies || 'No known allergies' }}</span>
                            <span><b>Blood Group</b>{{ selected.bloodGroup || 'Not recorded' }}</span>
                          </div>
                        </article>

                        <article class="panel overview-section">
                          <p class="ac-eyebrow">Section 4</p>
                          <h2>Latest Vitals</h2>
                          <div class="vitals-strip">
                            <span><b>Temperature</b>{{ latestVitalValue('temperature') }}</span>
                            <span><b>Blood Pressure</b>{{ latestVitalValue('bloodPressure') }}</span>
                            <span><b>Pulse</b>{{ latestVitalValue('pulse') }}</span>
                            <span><b>SpO2</b>{{ latestVitalValue('spo2') }}</span>
                          </div>
                        </article>

                        <article class="panel overview-section timeline-panel">
                          <div class="panel-head">
                            <div>
                              <p class="ac-eyebrow">Section 5</p>
                              <h2>Recent Activity Timeline</h2>
                            </div>
                            <span class="soft-pill">{{ overviewTimeline(selected).length }} events</span>
                          </div>
                          <div class="timeline-list">
                            @for (item of overviewTimeline(selected); track item.label) {
                              <span>
                                <b>{{ item.time }}</b>
                                <i></i>
                                <strong>{{ item.label }}</strong>
                              </span>
                            }
                          </div>
                        </article>
                      </section>
                    }
                    @case ('clinical') {
                      <section class="panel">
                        <p class="ac-eyebrow">Clinical profile</p>
                        <h2>Initial clinical information</h2>
                        <div class="summary-grid">
                          <span class="wide-review"><b>Admission reason</b>{{ selected.admissionReason || 'Not captured' }}</span>
                          <span><b>Department</b>{{ selected.departmentName || 'General Medicine' }}</span>
                          <span><b>Priority</b>{{ statusText(selected.priorityCode) }}</span>
                          <span><b>Source</b>{{ statusText(selected.admissionSource) }}</span>
                          <span><b>Admission type</b>{{ statusText(selected.admissionType) }}</span>
                        </div>
                      </section>
                    }
                    @case ('rounds') {
                      <section class="rounds-workspace">
                        <article class="panel">
                          <div class="panel-head">
                            <div>
                              <p class="ac-eyebrow">Doctor rounds</p>
                              <h2>Doctor Round Note</h2>
                            </div>
                            <span class="soft-pill">{{ selected.doctorName || 'Unassigned doctor' }}</span>
                          </div>
                          <div class="round-form">
                            <label>
                              <span>Round Date & Time *</span>
                              <input name="roundAt" type="datetime-local" [ngModel]="dateTimeLocalValue(doctorRoundForm.roundAt)" (ngModelChange)="setDoctorRoundDate($event)" />
                            </label>
                            <label>
                              <span>Doctor *</span>
                              <ac-dropdown name="roundDoctor" [(ngModel)]="doctorRoundForm.doctorId" [options]="doctorOptions(workspace()?.doctors ?? [])" />
                            </label>
                            <label>
                              <span>Patient Condition *</span>
                              <ac-dropdown name="patientCondition" [(ngModel)]="doctorRoundForm.patientCondition" [options]="patientConditionOptions" />
                            </label>
                            <label class="wide-field">
                              <span>Clinical Notes *</span>
                              <textarea rows="4" [(ngModel)]="doctorRoundForm.clinicalNotes" name="roundClinicalNotes" placeholder="Patient responding to treatment, pain reduced, appetite improving"></textarea>
                            </label>
                            <label>
                              <span>Diagnosis Update</span>
                              <textarea rows="3" [(ngModel)]="doctorRoundForm.diagnosisUpdate" name="roundDiagnosisUpdate" placeholder="Updated diagnosis or differential"></textarea>
                            </label>
                            <label>
                              <span>Treatment Plan</span>
                              <textarea rows="3" [(ngModel)]="doctorRoundForm.treatmentPlan" name="roundTreatmentPlan" placeholder="Continue current medication, review CBC tomorrow"></textarea>
                            </label>
                            <label>
                              <span>Medication Changes</span>
                              <textarea rows="3" [(ngModel)]="doctorRoundForm.medicationChanges" name="roundMedicationChanges" placeholder="Add, stop, or change medication"></textarea>
                            </label>
                            <label>
                              <span>Investigation Orders</span>
                              <textarea rows="3" [(ngModel)]="doctorRoundForm.investigationOrders" name="roundInvestigationOrders" placeholder="CBC, CRP, X-ray, ultrasound"></textarea>
                            </label>
                            <label>
                              <span>Procedure Recommendation</span>
                              <textarea rows="3" [(ngModel)]="doctorRoundForm.procedureRecommendation" name="roundProcedureRecommendation" placeholder="Procedure advice if required"></textarea>
                            </label>
                            <label>
                              <span>Follow-up Instructions</span>
                              <textarea rows="3" [(ngModel)]="doctorRoundForm.followUpInstructions" name="roundFollowUpInstructions" placeholder="Observation, escalation, next review notes"></textarea>
                            </label>
                            <label>
                              <span>Next Round Date</span>
                              <input name="nextRoundAt" type="datetime-local" [ngModel]="dateTimeLocalValue(doctorRoundForm.nextRoundAt)" (ngModelChange)="setNextRoundDate($event)" />
                            </label>
                          </div>
                          <div class="inline-actions end">
                            <button class="ac-btn ac-btn-secondary" type="button" (click)="saveCareDraft()"><span class="material-symbols-rounded">save</span>Save Draft</button>
                            <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="saveDoctorRound()"><span class="material-symbols-rounded">add_task</span>Record Doctor Round</button>
                          </div>
                        </article>

                        <article class="panel rounds-timeline">
                          <div class="panel-head">
                            <div>
                              <p class="ac-eyebrow">Clinical timeline</p>
                              <h2>Recent Rounds</h2>
                            </div>
                            @if (roundsLoading()) { <span class="soft-pill">Loading...</span> }
                            @else { <span class="soft-pill">{{ doctorRoundRecords().length }} rounds</span> }
                          </div>
                          <div class="round-list">
                            @for (round of doctorRoundRecords(); track round.roundId) {
                              <article class="round-card">
                                <div>
                                  <strong>{{ round.doctorName }}</strong>
                                  <small>{{ formatDate(round.roundAt) }} · {{ formatTime(round.roundAt) }}</small>
                                </div>
                                <span [ngClass]="conditionClass(round.patientCondition)">{{ round.patientConditionName }}</span>
                                <p>{{ round.clinicalNotes }}</p>
                                <div class="round-sections">
                                  @for (item of roundDetails(round); track item.label) {
                                    <span><b>{{ item.label }}</b>{{ item.value }}</span>
                                  }
                                </div>
                                @if (round.nextRoundAt) {
                                  <footer>Next round: {{ formatDate(round.nextRoundAt) }}, {{ formatTime(round.nextRoundAt) }}</footer>
                                }
                              </article>
                            } @empty {
                              <div class="empty-state">No doctor rounds recorded yet.</div>
                            }
                          </div>
                        </article>
                      </section>
                    }
                    @case ('nursing') {
                      <section class="panel">
                        <p class="ac-eyebrow">Nursing care</p>
                        <h2>Care note</h2>
                        <label class="note-field">
                          <span>Nursing note</span>
                          <textarea rows="8" [(ngModel)]="nursingNote" name="detailNursingNote" placeholder="Vitals, intake/output, observation, care provided, and escalation"></textarea>
                        </label>
                        <div class="inline-actions end">
                          <button class="ac-btn ac-btn-secondary" type="button" (click)="saveCareDraft()"><span class="material-symbols-rounded">save</span>Save Draft</button>
                          <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="saveCareNotes()"><span class="material-symbols-rounded">assignment_turned_in</span>Save Nursing Note</button>
                        </div>
                      </section>
                    }
                    @case ('vitals') {
                      <section class="vitals-workspace">
                        <article class="panel vitals-latest-panel">
                          <div class="panel-head">
                            <div>
                              <p class="ac-eyebrow">Latest values</p>
                              <h2>Vitals Snapshot</h2>
                            </div>
                            <span class="soft-pill">{{ latestVital() ? formatTime(latestVital()!.recordedAt) : 'No readings' }}</span>
                          </div>
                          <div class="latest-vitals-grid">
                            <span><b>Temperature</b>{{ latestVitalValue('temperature') }}</span>
                            <span><b>Blood Pressure</b>{{ latestVitalValue('bloodPressure') }}</span>
                            <span><b>Pulse</b>{{ latestVitalValue('pulse') }}</span>
                            <span><b>SpO2</b>{{ latestVitalValue('spo2') }}</span>
                          </div>
                        </article>

                        <article class="panel">
                          <div class="panel-head">
                            <div>
                              <p class="ac-eyebrow">Record vitals</p>
                              <h2>Record Vitals</h2>
                            </div>
                            <button class="ac-btn ac-btn-secondary" type="button" (click)="resetVitalForm()">
                              <span class="material-symbols-rounded">refresh</span>
                              Clear
                            </button>
                          </div>
                          <div class="vital-form">
                            <label>
                              <span>Date & Time</span>
                              <input name="vitalRecordedAt" type="datetime-local" [ngModel]="dateTimeLocalValue(vitalForm.recordedAt)" (ngModelChange)="setVitalDate($event)" />
                            </label>
                            <label>
                              <span>Temperature</span>
                              <input name="temperature" type="number" step="0.1" [(ngModel)]="vitalForm.temperature" placeholder="98.6 °F" />
                            </label>
                            <label>
                              <span>Pulse Rate</span>
                              <input name="pulseRate" type="number" [(ngModel)]="vitalForm.pulseRate" placeholder="78 bpm" />
                            </label>
                            <label>
                              <span>Respiratory Rate</span>
                              <input name="respiratoryRate" type="number" [(ngModel)]="vitalForm.respiratoryRate" placeholder="20 / min" />
                            </label>
                            <label>
                              <span>BP Systolic</span>
                              <input name="bloodPressureSystolic" type="number" [(ngModel)]="vitalForm.bloodPressureSystolic" placeholder="120" />
                            </label>
                            <label>
                              <span>BP Diastolic</span>
                              <input name="bloodPressureDiastolic" type="number" [(ngModel)]="vitalForm.bloodPressureDiastolic" placeholder="80" />
                            </label>
                            <label>
                              <span>SpO2</span>
                              <input name="spo2" type="number" [(ngModel)]="vitalForm.spo2" placeholder="98%" />
                            </label>
                            <label>
                              <span>Height</span>
                              <input name="height" type="number" step="0.1" [(ngModel)]="vitalForm.height" placeholder="cm" />
                            </label>
                            <label>
                              <span>Weight</span>
                              <input name="weight" type="number" step="0.1" [(ngModel)]="vitalForm.weight" placeholder="kg" />
                            </label>
                            <label>
                              <span>Pain Score</span>
                              <input name="painScore" type="number" min="0" max="10" [(ngModel)]="vitalForm.painScore" placeholder="0-10" />
                            </label>
                            <label>
                              <span>Blood Glucose</span>
                              <input name="bloodGlucose" type="number" step="0.1" [(ngModel)]="vitalForm.bloodGlucose" placeholder="mg/dL" />
                            </label>
                            <label>
                              <span>Recorded By</span>
                              <input name="recordedBy" [(ngModel)]="vitalForm.recordedBy" placeholder="Nurse / doctor name" />
                            </label>
                            <label class="wide-field">
                              <span>Notes</span>
                              <textarea name="vitalNotes" rows="3" [(ngModel)]="vitalForm.notes" placeholder="Observation, escalation, or context"></textarea>
                            </label>
                          </div>
                          <div class="inline-actions end">
                            <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="saveVitals()">
                              <span class="material-symbols-rounded">{{ saving() ? 'progress_activity' : 'monitor_heart' }}</span>
                              Save Vitals
                            </button>
                          </div>
                        </article>

                        <article class="panel trend-panel">
                          <div class="panel-head">
                            <div>
                              <p class="ac-eyebrow">Trend</p>
                              <h2>Vitals Trend</h2>
                            </div>
                            <span class="soft-pill">{{ vitalRecords().length }} readings</span>
                          </div>
                          <div class="trend-grid">
                            <div class="trend-card temperature">
                              <div class="trend-card-head">
                                <span class="material-symbols-rounded">thermostat</span>
                                <div>
                                  <b>Temperature</b>
                                  <strong>{{ latestVitalValue('temperature') }}</strong>
                                </div>
                              </div>
                              <div class="sparkline" aria-label="Temperature trend">
                                @for (point of trendPoints('temperature'); track point.index) {
                                  <i [style.height.%]="point.height"></i>
                                } @empty {
                                  <em>No trend yet</em>
                                }
                              </div>
                              <small>{{ trendSummary('temperature') }}</small>
                            </div>
                            <div class="trend-card pulse">
                              <div class="trend-card-head">
                                <span class="material-symbols-rounded">favorite</span>
                                <div>
                                  <b>Pulse</b>
                                  <strong>{{ latestVitalValue('pulse') }}</strong>
                                </div>
                              </div>
                              <div class="sparkline" aria-label="Pulse trend">
                                @for (point of trendPoints('pulse'); track point.index) {
                                  <i [style.height.%]="point.height"></i>
                                } @empty {
                                  <em>No trend yet</em>
                                }
                              </div>
                              <small>{{ trendSummary('pulse') }}</small>
                            </div>
                            <div class="trend-card spo2">
                              <div class="trend-card-head">
                                <span class="material-symbols-rounded">air</span>
                                <div>
                                  <b>SpO2</b>
                                  <strong>{{ latestVitalValue('spo2') }}</strong>
                                </div>
                              </div>
                              <div class="sparkline" aria-label="SpO2 trend">
                                @for (point of trendPoints('spo2'); track point.index) {
                                  <i [style.height.%]="point.height"></i>
                                } @empty {
                                  <em>No trend yet</em>
                                }
                              </div>
                              <small>{{ trendSummary('spo2') }}</small>
                            </div>
                          </div>
                        </article>

                        <article class="panel">
                          <div class="panel-head">
                            <div>
                              <p class="ac-eyebrow">History</p>
                              <h2>Historical Vitals</h2>
                            </div>
                            @if (vitalsLoading()) { <span class="soft-pill">Loading...</span> }
                          </div>
                          <div class="records-table vitals-table">
                            <div class="table-head vitals-head">
                              <span>Date & Time</span><span>Temp</span><span>BP</span><span>Pulse</span><span>SpO2</span><span>Pain</span><span>By</span><span>Action</span>
                            </div>
                            @for (record of vitalRecords(); track record.vitalId) {
                              <div class="table-row vitals-row">
                                <span><strong>{{ formatDate(record.recordedAt) }}</strong><small>{{ formatTime(record.recordedAt) }}</small></span>
                                <span>{{ valueWithUnit(record.temperature, '°F') }}</span>
                                <span>{{ bloodPressureText(record) }}</span>
                                <span>{{ valueWithUnit(record.pulseRate, 'bpm') }}</span>
                                <span>{{ valueWithUnit(record.spo2, '%') }}</span>
                                <span>{{ record.painScore ?? '-' }}</span>
                                <span>{{ record.recordedBy || '-' }}</span>
                                <span class="row-actions">
                                  <button class="link-btn" type="button" (click)="editVitals(record)">Edit</button>
                                  <button class="link-btn danger" type="button" (click)="deleteVitals(record)">Delete</button>
                                </span>
                              </div>
                            } @empty {
                              <div class="empty-state">No vitals recorded yet.</div>
                            }
                          </div>
                        </article>
                      </section>
                    }
                    @case ('transfers') {
                      <section class="panel">
                        <div class="section-toolbar">
                          <div>
                            <p class="ac-eyebrow">Transfers</p>
                            <h2>Bed allocation and transfer</h2>
                          </div>
                          <span class="soft-pill">{{ selected.wardName || 'No ward' }} · {{ selected.bedNo || 'No bed' }}</span>
                        </div>
                        <div class="transfer-box">
                          <div class="transfer-patient">
                            <strong>{{ selected.patientName }}</strong>
                            <span>{{ selected.wardName || 'No ward' }} · {{ selected.bedNo || 'No bed' }}</span>
                          </div>
                          <ac-dropdown name="detailTransferBed" [(ngModel)]="transferBedId" [options]="availableBedOptions()" placeholder="Choose available bed" />
                          <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="allocateBed()">
                            <span class="material-symbols-rounded">swap_horiz</span>
                            Save Allocation
                          </button>
                        </div>
                      </section>
                    }
                    @case ('billing') {
                      <section class="panel billing-panel">
                        <p class="ac-eyebrow">Billing accumulation</p>
                        <h2>Financial readiness</h2>
                        <div class="billing-grid">
                          <span><b>{{ formatMoney(selected.outstanding || 0) }}</b> outstanding</span>
                          <span><b>{{ selected.stayDays || 1 }}</b> billable stay days</span>
                          <span><b>{{ selected.activeOrders || 0 }}</b> active orders</span>
                          <span><b>{{ selected.bedNo || 'Pending' }}</b> bed charge stream</span>
                        </div>
                        <p class="helper-text">Room rent, procedures, investigations, pharmacy issues, payments, and discharge clearance can be accumulated against this admission.</p>
                      </section>
                    }
                    @case ('discharge') {
                      <section class="panel">
                        <div class="section-toolbar">
                          <div>
                            <p class="ac-eyebrow">Discharge planning</p>
                            <h2>Final bill and discharge summary</h2>
                          </div>
                          <button class="ac-btn ac-btn-secondary" type="button" (click)="printDischargeSummary()"><span class="material-symbols-rounded">print</span>Print</button>
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
                            <textarea rows="9" [(ngModel)]="dischargeSummary" name="detailDischargeSummary" placeholder="Diagnosis, treatment given, condition at discharge, medication advice, follow-up, and billing clearance"></textarea>
                          </label>
                        </div>
                        <div class="inline-actions end">
                          <button class="ac-btn ac-btn-secondary" type="button" (click)="saveDischargeDraft()"><span class="material-symbols-rounded">save</span>Save Draft</button>
                          <button class="ac-btn ac-btn-primary" type="button" [disabled]="saving()" (click)="finalizeDischarge()"><span class="material-symbols-rounded">task_alt</span>Finalize Discharge</button>
                        </div>
                      </section>
                    }
                    @case ('lab') {
                      <section class="panel detail-form-card">
                        <div class="section-toolbar">
                          <div><p class="ac-eyebrow">Clinical orders</p><h2>New laboratory order</h2><p>{{ selected.wardName || 'Ward pending' }} · {{ selected.bedNo || 'Bed pending' }}</p></div>
                          <ac-dropdown name="ipdLabPriority" [(ngModel)]="ipdLabPriority" [options]="labPriorityOptions" />
                        </div>
                        <div class="choice-grid">
                          @for (test of ipdLabTests(); track test.id) {
                            <label class="choice-card"><input type="checkbox" [checked]="ipdSelectedLabTests().includes(test.id)" (change)="toggleIpdLabTest(test.id)" /><span><strong>{{ test.name }}</strong><small>{{ test.code }} · {{ test.category }} · {{ test.price | currency:'INR' }}</small></span></label>
                          } @empty { <div class="empty-state">No active laboratory tests are configured.</div> }
                        </div>
                        <label class="note-field"><span>Clinical notes</span><textarea rows="3" [(ngModel)]="ipdLabNotes" name="ipdLabNotes" placeholder="Clinical indication and special instructions"></textarea></label>
                        <div class="inline-actions end"><button class="ac-btn ac-btn-primary" type="button" [disabled]="saving() || !ipdSelectedLabTests().length" (click)="createIpdLabOrder(selected)"><span class="material-symbols-rounded">biotech</span>Create Lab Order</button></div>
                      </section>
                    }
                    @default {
                      <section class="panel tab-placeholder">
                        <span class="material-symbols-rounded">{{ detailTabIcon(activeDetailTab()) }}</span>
                        <div>
                          <p class="ac-eyebrow">{{ detailTabLabel(activeDetailTab()) }}</p>
                          <h2>{{ selected.patientName }} care workspace</h2>
                          <p>{{ detailTabHelp(activeDetailTab()) }}</p>
                        </div>
                      </section>
                    }
                  }
                </section>
              } @else {
                <section class="panel">
                  <div class="section-toolbar">
                    <div>
                      <p class="ac-eyebrow">Active inpatients</p>
                      <h2>Current inpatient stay</h2>
                    </div>
                    <button class="ac-btn ac-btn-secondary" type="button" (click)="exportActivePatients()">
                      <span class="material-symbols-rounded">download</span>
                      Export
                    </button>
                  </div>
                  <div class="active-filters">
                    <div class="search-field">
                      <span class="material-symbols-rounded">search</span>
                      <input type="text" [ngModel]="activeSearchQuery()" (ngModelChange)="activeSearchQuery.set($event)" placeholder="Search patient, MRN, admission ID" />
                    </div>
                    <ac-dropdown name="activeWardFilter" [ngModel]="activeWardFilter()" (ngModelChange)="activeWardFilter.set($event)" [options]="activeWardOptions()" />
                    <ac-dropdown name="activeDoctorFilter" [ngModel]="activeDoctorFilter()" (ngModelChange)="activeDoctorFilter.set($event)" [options]="activeDoctorOptions()" />
                    <ac-dropdown name="activeDepartmentFilter" [ngModel]="activeDepartmentFilter()" (ngModelChange)="activeDepartmentFilter.set($event)" [options]="activeDepartmentOptions()" />
                    <ac-dropdown name="activePriorityFilter" [ngModel]="activePriorityFilter()" (ngModelChange)="activePriorityFilter.set($event)" [options]="activePriorityOptions()" />
                  </div>
                  <div class="records-table active-table">
                    <div class="table-head active-head">
                      <span>Patient</span><span>Admission ID</span><span>Ward</span><span>Bed</span><span>Doctor</span><span>Stay</span><span>Status</span>
                    </div>
                    @for (admission of filteredActiveInpatients(); track admission.admissionId) {
                      <button type="button" class="table-row active-row" (click)="openInpatientDetail(admission)">
                        <span><strong>{{ admission.patientName }}</strong><small>{{ admission.medicalRecordNo }} · {{ statusText(admission.priorityCode) }}</small></span>
                        <span><strong>{{ admission.admissionNo }}</strong><small>{{ statusText(admission.admissionSource) }}</small></span>
                        <span>{{ admission.wardName || 'Ward pending' }}</span>
                        <span>{{ admission.bedNo || 'Bed pending' }}</span>
                        <span><strong>{{ admission.doctorName || 'Unassigned' }}</strong><small>{{ admission.departmentName || 'General Medicine' }}</small></span>
                        <span>Day {{ admission.stayDays || 1 }}</span>
                        <span><b class="status-pill">{{ statusText(admission.statusCode) }}</b></span>
                      </button>
                    } @empty {
                      <div class="empty-state">No active inpatients found.</div>
                    }
                  </div>
                </section>
              }
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
                  <div class="inline-actions">
                    <button class="ac-btn ac-btn-secondary" type="button" (click)="openAdmissionDetailTab(selected, 'rounds')">
                      <span class="material-symbols-rounded">stethoscope</span>
                      Open Doctor Rounds
                    </button>
                  </div>
                  } @else {
                    <div class="empty-state">Select an active inpatient to record care.</div>
                  }
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
                      Save Nursing Note
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
    .ipd-page { padding: 16px 24px 28px; display: grid; gap: 10px; }
    .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .ipd-page .ac-page-title { font-size: 27px; line-height: 1.05; }
    .page-desc { color: var(--ac-muted); font-size: 13.5px; margin-top: 1px; line-height: 1.3; }
    .header-actions, .inline-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .header-actions .ac-btn { min-height: 38px; padding: 0 14px; }
    .inline-actions.end { justify-content: flex-end; margin-top: 14px; }
    .spin { animation: spin 900ms linear infinite; }

    .kpi-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .kpi-card {
      --tone: #2563EB;
      min-height: 66px;
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, var(--tone) 24%, var(--ac-border));
      border-radius: 10px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 7%, var(--ac-surface)), var(--ac-surface));
      box-shadow: var(--ac-sh-sm);
    }
    .kpi-icon {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 9px;
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 12%, transparent);
      font-size: 20px;
      flex: 0 0 auto;
    }
    .kpi-card strong { display: block; color: var(--ac-text); font-size: 22px; line-height: 1; }
    .kpi-card span:not(.kpi-icon) { display: block; margin-top: 2px; color: var(--ac-text-3); font-size: 12.5px; font-weight: 850; line-height: 1.2; }
    .kpi-card small { color: var(--ac-muted); font-size: 11px; font-weight: 700; line-height: 1.2; }

    .journey-card {
      display: grid;
      grid-template-columns: repeat(11, minmax(76px, 1fr));
      gap: 0;
      padding: 10px 12px;
      overflow-x: auto;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      border-radius: 10px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .journey-step {
      position: relative;
      min-width: 76px;
      display: grid;
      justify-items: center;
      gap: 3px;
      color: var(--ac-muted);
      isolation: isolate;
    }
    .journey-step::before {
      content: '';
      position: absolute;
      top: 17px;
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
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      border: 2px solid var(--ac-border);
      background: var(--ac-surface);
      color: var(--ac-muted);
      font-weight: 900;
      font-size: 13px;
      box-shadow: 0 6px 14px rgba(15,23,42,.06);
    }
    .journey-step.done .journey-dot { background: var(--ac-success); border-color: var(--ac-success); color: #fff; }
    .journey-step.active .journey-dot { background: var(--ac-primary); border-color: var(--ac-primary); color: #fff; box-shadow: 0 8px 18px rgba(37,99,235,.24); }
    .journey-step strong { font-size: 11px; color: var(--ac-text); text-align: center; line-height: 1.1; }
    .journey-step small { font-size: 10px; color: var(--ac-muted); font-weight: 800; line-height: 1.05; }
    .journey-step.done strong, .journey-step.done small { color: var(--ac-success-text); }
    .journey-step.active strong, .journey-step.active small { color: var(--ac-primary); }

    .module-tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 6px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .module-tabs button {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 0 12px;
      border: 1px solid transparent;
      border-radius: 9px;
      color: var(--ac-muted);
      font-size: 13px;
      font-weight: 850;
      white-space: nowrap;
    }
    .module-tabs button .material-symbols-rounded { font-size: 19px; }
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

    .donut-wrap {
      display: grid;
      grid-template-columns: minmax(128px, 156px) minmax(180px, 1fr);
      align-items: center;
      justify-content: center;
      gap: 18px;
      min-height: 178px;
      padding: 8px 10px 4px;
    }
    .donut {
      --occupied: 0deg;
      --available: 0deg;
      width: clamp(126px, 11vw, 148px);
      height: clamp(126px, 11vw, 148px);
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: conic-gradient(var(--ac-primary) 0deg var(--occupied), var(--ac-success) var(--occupied) calc(var(--occupied) + var(--available)), var(--ac-border) 0);
      position: relative;
      justify-self: end;
      box-shadow: 0 16px 34px rgba(15,23,42,.1);
    }
    .donut::after {
      content: '';
      position: absolute;
      inset: 31%;
      border-radius: 50%;
      background: var(--ac-surface);
    }
    .donut-center {
      position: relative;
      z-index: 1;
      display: grid;
      justify-items: center;
      gap: 1px;
      text-align: center;
    }
    .donut-center strong { font-size: 25px; line-height: 1; color: var(--ac-text); }
    .donut-center span { color: var(--ac-muted); font-size: 9.5px; font-weight: 900; text-transform: uppercase; }
    .legend { display: grid; gap: 9px; width: min(100%, 230px); }
    .legend span {
      display: grid;
      grid-template-columns: 12px 1fr auto;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 9px 10px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: color-mix(in srgb, var(--ac-surface) 84%, var(--ac-surface-2));
      font-weight: 800;
      color: var(--ac-text-3);
    }
    .legend em { display: grid; gap: 2px; font-style: normal; }
    .legend em strong { font-size: 13px; color: var(--ac-text); }
    .legend em small { font-size: 11px; color: var(--ac-muted); font-weight: 800; }
    .legend i { width: 10px; height: 10px; border-radius: 50%; }
    .legend i.occupied { background: var(--ac-primary); }
    .legend i.available { background: var(--ac-success); }
    .legend b {
      min-width: 30px;
      height: 28px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: var(--ac-surface);
      border: 1px solid var(--ac-border);
      color: var(--ac-text);
    }

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

    .admission-filters {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) repeat(4, minmax(160px, .35fr));
      gap: 10px;
      margin-bottom: 14px;
    }

    .admission-wizard {
      display: grid;
      gap: 14px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      border-radius: 12px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary-light) 42%, var(--ac-surface)), var(--ac-surface));
    }
    .wizard-head, .wizard-footer, .wizard-actions-inline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .wizard-head h3 { font-size: 22px; }
    .icon-btn {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      color: var(--ac-muted);
    }
    .admission-stepper {
      display: grid;
      grid-template-columns: repeat(6, minmax(116px, 1fr));
      overflow-x: auto;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
    }
    .admission-step {
      min-height: 72px;
      display: grid;
      grid-template-columns: 34px 1fr;
      align-items: center;
      gap: 10px;
      padding: 12px;
      color: var(--ac-muted);
      border-right: 1px solid var(--ac-border);
      text-align: left;
    }
    .admission-step:last-child { border-right: 0; }
    .admission-step span {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      border: 1px solid var(--ac-border);
      background: var(--ac-surface);
      font-weight: 900;
    }
    .admission-step strong { font-size: 13px; line-height: 1.15; }
    .admission-step.done span { border-color: var(--ac-success); background: var(--ac-success); color: #fff; }
    .admission-step.done strong { color: var(--ac-success-text); }
    .admission-step.active { background: var(--ac-primary-light); color: var(--ac-primary); }
    .admission-step.active span { border-color: var(--ac-primary); background: var(--ac-primary); color: #fff; }
    .admission-step.active strong { color: var(--ac-primary); }
    .wizard-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .patient-step { grid-template-columns: minmax(280px, .75fr) minmax(320px, 1fr); align-items: start; }
    label { display: grid; gap: 7px; color: var(--ac-text-3); font-size: 12px; font-weight: 900; }
    label.invalid textarea, label.invalid input { border-color: var(--ac-error); background: var(--ac-error-light); }
    label.invalid small { color: var(--ac-error); font-size: 12px; font-weight: 850; }
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
    .wide-field { grid-column: 1 / -1; }
    .selected-patient-card {
      display: grid;
      grid-template-columns: 48px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 14px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
    }
    .selected-patient-card strong, .selected-patient-card span, .selected-patient-card small { display: block; }
    .selected-patient-card span, .selected-patient-card small { color: var(--ac-muted); font-weight: 750; }
    .selected-patient-card b { color: var(--ac-primary); }
    .bed-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .bed-choice {
      min-height: 108px;
      display: grid;
      align-content: center;
      gap: 6px;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
      text-align: left;
    }
    .bed-choice.selected { border-color: var(--ac-success); background: var(--ac-success-light); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-success) 12%, transparent); }
    .bed-choice.disabled { opacity: .48; cursor: not-allowed; }
    .bed-choice .material-symbols-rounded { color: var(--ac-primary); }
    .bed-choice small { color: var(--ac-muted); font-weight: 800; }
    .review-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .review-grid span {
      display: grid;
      gap: 4px;
      min-height: 76px;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      font-weight: 850;
    }
    .review-grid b { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; }
    .wide-review { grid-column: span 2; }

    .records-table { border: 1px solid var(--ac-border); border-radius: 12px; overflow: hidden; }
    .table-head, .table-row { display: grid; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--ac-border); }
    .table-head { background: var(--ac-surface-2); color: var(--ac-muted); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .table-row:last-child { border-bottom: 0; }
    .table-row strong, .table-row small { display: block; }
    .table-row small { color: var(--ac-muted); font-weight: 700; }
    .admissions-head, .admissions-row { grid-template-columns: .9fr 1.15fr 1fr 1fr .8fr .75fr .6fr; }
    .status-pill { display: inline-flex; align-items: center; width: fit-content; border-radius: 999px; padding: 5px 10px; color: var(--ac-primary); background: var(--ac-primary-light); font-size: 12px; }

    .active-filters {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) repeat(4, minmax(150px, .32fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .active-head, .active-row { grid-template-columns: 1.2fr .85fr .85fr .75fr 1.05fr .55fr .75fr; }
    .active-row {
      width: 100%;
      text-align: left;
      background: var(--ac-surface);
      cursor: pointer;
    }
    .active-row:hover { background: color-mix(in srgb, var(--ac-primary-light) 62%, var(--ac-surface)); }
    .active-table .empty-state { margin: 12px; }

    .admission-workspace { display: grid; gap: 14px; }
    .admission-hero {
      display: grid;
      gap: 14px;
      border-top: 3px solid var(--ac-primary);
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary-light) 32%, var(--ac-surface)), var(--ac-surface));
    }
    .hero-nav, .admission-identity, .admission-meta-line { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; }
    .admission-identity { justify-content: flex-start; }
    .avatar.large { width: 58px; height: 58px; border-radius: 16px; font-size: 20px; }
    .admission-identity h2 { font-size: 26px; }
    .admission-identity p:not(.ac-eyebrow) { color: var(--ac-muted); font-weight: 800; }
    .admission-identity .status-pill { margin-left: auto; }
    .admission-meta-line {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .admission-meta-line span, .summary-grid span {
      display: grid;
      gap: 4px;
      min-height: 68px;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: rgba(255,255,255,.72);
      font-weight: 850;
    }
    .admission-meta-line b, .summary-grid b { color: var(--ac-muted); font-size: 11px; text-transform: uppercase; }
    .detail-kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .detail-kpis article {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .detail-kpis span {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      color: var(--ac-primary);
      background: var(--ac-primary-light);
    }
    .detail-kpis strong, .detail-kpis small { display: block; }
    .detail-kpis strong { font-size: 20px; line-height: 1.1; }
    .detail-kpis small { margin-top: 4px; color: var(--ac-muted); font-weight: 800; }
    .detail-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 8px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .detail-tabs button {
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 0 12px;
      border: 1px solid transparent;
      border-radius: 10px;
      color: var(--ac-muted);
      font-weight: 900;
      white-space: nowrap;
    }
    .detail-tabs button.active {
      color: var(--ac-primary);
      border-color: color-mix(in srgb, var(--ac-primary) 32%, var(--ac-border));
      background: var(--ac-primary-light);
    }
    .detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .overview-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(360px, .95fr);
      gap: 14px;
    }
    .overview-section { min-height: 210px; }
    .overview-section h2 { margin-bottom: 14px; }
    .overview-list, .clinical-snapshot, .location-strip, .vitals-strip {
      display: grid;
      gap: 10px;
    }
    .overview-list span, .clinical-snapshot span, .location-strip span, .vitals-strip span {
      display: grid;
      grid-template-columns: minmax(136px, .42fr) 1fr;
      gap: 12px;
      align-items: center;
      min-height: 42px;
      padding: 10px 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: color-mix(in srgb, var(--ac-surface-2) 70%, var(--ac-surface));
      font-weight: 850;
    }
    .overview-list b, .clinical-snapshot b, .location-strip b, .vitals-strip b {
      color: var(--ac-muted);
      font-size: 11px;
      text-transform: uppercase;
    }
    .location-strip {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .location-strip span {
      grid-template-columns: 1fr;
      min-height: 92px;
      align-content: center;
      border-color: color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary-light) 42%, var(--ac-surface)), var(--ac-surface));
      font-size: 18px;
    }
    .clinical-snapshot span {
      min-height: 70px;
      grid-template-columns: 1fr;
      align-content: center;
    }
    .vitals-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .vitals-strip span {
      grid-template-columns: 1fr;
      align-content: center;
      min-height: 78px;
      color: var(--ac-muted);
    }
    .timeline-panel { grid-column: 1 / -1; min-height: 0; }
    .timeline-list { display: grid; gap: 0; }
    .timeline-list span {
      display: grid;
      grid-template-columns: 86px 18px 1fr;
      gap: 12px;
      align-items: center;
      min-height: 44px;
      color: var(--ac-text);
      font-weight: 850;
    }
    .timeline-list b { color: var(--ac-muted); font-size: 12px; }
    .timeline-list i {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--ac-primary);
      box-shadow: 0 0 0 5px var(--ac-primary-light);
    }
    .tab-placeholder {
      min-height: 220px;
      display: flex;
      align-items: center;
      gap: 18px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary-light) 18%, var(--ac-surface)), var(--ac-surface));
    }
    .tab-placeholder > .material-symbols-rounded {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border-radius: 16px;
      color: var(--ac-primary);
      background: var(--ac-primary-light);
    }
    .tab-placeholder p:not(.ac-eyebrow) { color: var(--ac-muted); font-weight: 800; max-width: 620px; }

    .rounds-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(340px, .65fr);
      gap: 14px;
      align-items: start;
    }
    .round-form {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .round-list {
      display: grid;
      gap: 12px;
      max-height: 720px;
      overflow: auto;
      padding-right: 4px;
    }
    .round-card {
      display: grid;
      gap: 10px;
      padding: 14px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary-light) 18%, var(--ac-surface)), var(--ac-surface));
    }
    .round-card > div:first-child {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .round-card strong { font-size: 15px; }
    .round-card small, .round-card footer {
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 800;
    }
    .round-card p {
      margin: 0;
      color: var(--ac-text);
      line-height: 1.55;
      font-weight: 750;
    }
    .round-sections {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .round-sections span {
      display: grid;
      gap: 4px;
      padding: 10px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: rgba(255,255,255,.74);
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 800;
    }
    .round-sections b {
      color: var(--ac-text-3);
      text-transform: uppercase;
      font-size: 10px;
    }
    .condition-pill {
      width: max-content;
      min-height: 26px;
      display: inline-flex;
      align-items: center;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--ac-surface-2);
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 950;
    }
    .condition-stable, .condition-improving { background: var(--ac-success-light); color: var(--ac-success); }
    .condition-critical, .condition-deteriorating { background: var(--ac-error-light); color: var(--ac-error); }
    .condition-under-observation { background: #FFF7ED; color: #C2410C; }

    .vitals-workspace {
      display: grid;
      grid-template-columns: minmax(340px, .78fr) minmax(0, 1.22fr);
      gap: 14px;
      align-items: start;
    }
    .vitals-latest-panel {
      border-top: 3px solid var(--ac-success);
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-success-light) 42%, var(--ac-surface)), var(--ac-surface));
    }
    .latest-vitals-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .latest-vitals-grid span {
      display: grid;
      gap: 5px;
      min-height: 86px;
      align-content: center;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--ac-success) 22%, var(--ac-border));
      border-radius: 12px;
      background: rgba(255,255,255,.74);
      font-size: 19px;
      font-weight: 900;
    }
    .latest-vitals-grid b {
      color: var(--ac-muted);
      font-size: 11px;
      text-transform: uppercase;
    }
    .vital-form {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .trend-panel {
      border-top: 3px solid var(--ac-primary);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 7%, transparent), transparent 42%),
        var(--ac-surface);
    }
    .trend-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }
    .trend-card {
      --trend: var(--ac-primary);
      min-height: 172px;
      display: grid;
      gap: 12px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--trend) 24%, var(--ac-border));
      border-radius: 12px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--trend) 9%, var(--ac-surface)), var(--ac-surface));
      box-shadow: 0 14px 30px rgba(15, 23, 42, .06);
      min-width: 0;
    }
    .trend-card.temperature { --trend: var(--ac-primary); }
    .trend-card.pulse { --trend: #EF4444; }
    .trend-card.spo2 { --trend: var(--ac-success); }
    .trend-card-head {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .trend-card-head > div {
      min-width: 0;
    }
    .trend-card-head > .material-symbols-rounded {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: color-mix(in srgb, var(--trend) 13%, #fff);
      color: var(--trend);
      font-size: 23px;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--trend) 12%, transparent);
    }
    .trend-card b {
      display: block;
      color: var(--ac-muted);
      font-size: 11px;
      line-height: 1.2;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .trend-card strong {
      display: block;
      margin-top: 3px;
      color: var(--ac-text);
      font-size: 23px;
      line-height: 1.1;
      font-weight: 950;
      overflow-wrap: anywhere;
    }
    .trend-card small {
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 850;
    }
    .sparkline {
      position: relative;
      height: 82px;
      display: flex;
      align-items: end;
      gap: 6px;
      padding: 12px 12px 11px;
      overflow: hidden;
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(255, 255, 255, .88), color-mix(in srgb, var(--trend) 7%, var(--ac-surface-2)));
      border: 1px solid color-mix(in srgb, var(--trend) 18%, var(--ac-border));
    }
    .sparkline::before,
    .sparkline::after {
      content: '';
      position: absolute;
      left: 12px;
      right: 12px;
      border-top: 1px dashed color-mix(in srgb, var(--trend) 25%, var(--ac-border));
    }
    .sparkline::before { top: 36%; }
    .sparkline::after { top: 68%; }
    .sparkline i {
      position: relative;
      z-index: 1;
      flex: 1 1 8px;
      min-width: 6px;
      border-radius: 999px 999px 4px 4px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--trend) 70%, #fff), var(--trend));
      box-shadow: 0 6px 14px color-mix(in srgb, var(--trend) 22%, transparent);
    }
    .sparkline em {
      position: relative;
      z-index: 1;
      margin: auto;
      color: var(--ac-muted);
      font-size: 12px;
      font-style: normal;
      font-weight: 850;
    }
    .vitals-head, .vitals-row {
      grid-template-columns: 1.05fr .55fr .6fr .55fr .55fr .45fr .7fr .65fr;
    }
    .row-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .facility-workspace { display: grid; gap: 16px; }
    .facility-tabs {
      display: inline-flex;
      gap: 6px;
      padding: 5px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface-2);
    }
    .facility-tabs button {
      min-height: 34px;
      padding: 0 12px;
      border-radius: 8px;
      color: var(--ac-muted);
      font-weight: 900;
    }
    .facility-tabs button.active { color: var(--ac-primary); background: var(--ac-surface); box-shadow: var(--ac-sh-sm); }
    .facility-form {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      margin-bottom: 16px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-primary-light) 28%, var(--ac-surface));
    }
    .compact-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding-top: 2px;
    }
    .compact-actions .ac-btn { min-height: 44px; }
    .facility-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .facility-card {
      display: grid;
      gap: 8px;
      padding: 14px;
      border: 1px solid var(--ac-border);
      border-top: 3px solid var(--ac-primary);
      border-radius: 12px;
      background: var(--ac-surface);
      box-shadow: var(--ac-sh-sm);
    }
    .facility-card h3 { font-size: 18px; }
    .facility-card span, .facility-card small { color: var(--ac-muted); font-weight: 750; }
    .facility-card b { color: var(--ac-text); font-size: 20px; }
    .link-btn.danger { color: var(--ac-error); }
    .compact-bed-layout { margin-top: 4px; }

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
      .dashboard-grid, .care-grid, .bed-layout, .detail-grid, .overview-workspace, .rounds-workspace, .vitals-workspace { grid-template-columns: 1fr; }
      .admission-filters, .active-filters, .wizard-grid, .patient-step, .review-grid, .facility-form, .facility-grid, .detail-kpis, .admission-meta-line, .round-form, .vital-form { grid-template-columns: 1fr 1fr; }
      .wide-field, .wide-review, .compact-actions { grid-column: 1 / -1; }
      .transfer-box, .discharge-summary { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .ipd-page { padding: 16px; }
      .page-header, .panel-head, .section-toolbar { flex-direction: column; }
      .kpi-strip, .admission-filters, .active-filters, .wizard-grid, .patient-step, .review-grid, .facility-form, .facility-grid, .billing-grid, .reports-grid, .detail-kpis, .admission-meta-line, .summary-grid, .location-strip, .vitals-strip, .latest-vitals-grid, .round-form, .round-sections, .vital-form, .trend-grid { grid-template-columns: 1fr; }
      .wide-field, .wide-review, .compact-actions { grid-column: 1 / -1; }
      .compact-actions { justify-content: stretch; }
      .compact-actions .ac-btn { width: 100%; }
      .admissions-head, .active-head { display: none; }
      .admissions-row, .active-row, .vitals-row { grid-template-columns: 1fr; }
      .mini-row { grid-template-columns: 1fr; }
      .patient-card { grid-template-columns: 48px 1fr; }
      .patient-card .ac-btn { grid-column: span 2; }
      .care-summary { grid-template-columns: 1fr; }
      .overview-list span, .timeline-list span { grid-template-columns: 1fr; }
      .timeline-list i { display: none; }
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
  protected readonly activePatientDetailOpen = signal(false);
  protected readonly activeDetailTab = signal<IpdDetailTab>('overview');
  protected readonly activeSearchQuery = signal('');
  protected readonly activeWardFilter = signal('');
  protected readonly activeDoctorFilter = signal('');
  protected readonly activeDepartmentFilter = signal('');
  protected readonly activePriorityFilter = signal('');
  protected readonly admissionPanelOpen = signal(false);
  protected readonly admissionStep = signal(1);
  protected readonly admissionErrors = signal<Record<string, string>>({});
  protected readonly admissionStatusFilter = signal('');
  protected readonly admissionWardFilter = signal('');
  protected readonly admissionDoctorFilter = signal('');
  protected readonly admissionDateFilter = signal('');
  protected readonly selectedWardName = signal('');
  protected readonly selectedRoomName = signal('');
  protected readonly facilityTab = signal<FacilityTab>('wards');
  protected readonly doctorRoundRecords = signal<IpdDoctorRound[]>([]);
  protected readonly roundsLoading = signal(false);
  protected readonly vitalRecords = signal<IpdVitalRecord[]>([]);
  protected readonly vitalsLoading = signal(false);

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

  protected readonly detailTabs: IpdDetailTabItem[] = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'clinical', label: 'Clinical', icon: 'clinical_notes' },
    { key: 'rounds', label: 'Doctor Rounds', icon: 'stethoscope' },
    { key: 'nursing', label: 'Nursing', icon: 'health_and_safety' },
    { key: 'vitals', label: 'Vitals', icon: 'monitor_heart' },
    { key: 'medication', label: 'Medication', icon: 'medication' },
    { key: 'orders', label: 'Orders', icon: 'assignment' },
    { key: 'lab', label: 'Lab', icon: 'science' },
    { key: 'procedures', label: 'Procedures', icon: 'medical_services' },
    { key: 'transfers', label: 'Transfers', icon: 'swap_horiz' },
    { key: 'billing', label: 'Billing', icon: 'receipt_long' },
    { key: 'documents', label: 'Documents', icon: 'folder_open' },
    { key: 'discharge', label: 'Discharge', icon: 'logout' },
    { key: 'activity', label: 'Activity', icon: 'history' }
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
    { label: 'Direct admission', value: 'DIRECT' },
    { label: 'Referral', value: 'REFERRAL' },
    { label: 'Transfer', value: 'TRANSFER' }
  ];
  protected readonly admissionTypeOptions: DropdownOption<string>[] = [
    { label: 'General admission', value: 'GENERAL' },
    { label: 'Observation', value: 'OBSERVATION' },
    { label: 'Surgical', value: 'SURGICAL' },
    { label: 'Maternity', value: 'MATERNITY' },
    { label: 'Critical care', value: 'CRITICAL_CARE' }
  ];
  protected readonly priorityOptions: DropdownOption<string>[] = [
    { label: 'Routine', value: 'ROUTINE' },
    { label: 'Urgent', value: 'URGENT' },
    { label: 'Emergency', value: 'EMERGENCY' },
    { label: 'Critical', value: 'CRITICAL' }
  ];
  protected readonly referralOptions: DropdownOption<string>[] = [
    { label: 'Not applicable', value: '' },
    { label: 'OPD', value: 'OPD' },
    { label: 'Emergency', value: 'EMERGENCY' },
    { label: 'External hospital', value: 'EXTERNAL_HOSPITAL' },
    { label: 'Doctor referral', value: 'DOCTOR_REFERRAL' }
  ];
  protected readonly infectionRiskOptions: DropdownOption<string>[] = [
    { label: 'Low risk', value: 'LOW' },
    { label: 'Moderate risk', value: 'MODERATE' },
    { label: 'High risk', value: 'HIGH' },
    { label: 'Isolation required', value: 'ISOLATION' }
  ];
  protected readonly statusFilterOptions: DropdownOption<string>[] = [
    { label: 'All statuses', value: '' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Pending Admission', value: 'PENDING_ADMISSION' },
    { label: 'Admitted', value: 'ADMITTED' },
    { label: 'Transfer Pending', value: 'TRANSFER_PENDING' },
    { label: 'Discharge Initiated', value: 'DISCHARGE_INITIATED' },
    { label: 'Discharged', value: 'DISCHARGED' }
  ];
  protected readonly dateRangeOptions: DropdownOption<string>[] = [
    { label: 'All dates', value: '' },
    { label: 'Today', value: 'TODAY' },
    { label: 'Last 7 days', value: '7D' },
    { label: 'Last 30 days', value: '30D' }
  ];
  protected readonly admissionSteps = [
    { label: 'Patient' },
    { label: 'Admission Details' },
    { label: 'Clinical Info' },
    { label: 'Doctor & Dept' },
    { label: 'Bed Allocation' },
    { label: 'Review & Admit' }
  ];
  protected readonly wardTypeOptions: DropdownOption<string>[] = [
    { label: 'General', value: 'GENERAL' },
    { label: 'Semi-Private', value: 'SEMI_PRIVATE' },
    { label: 'Private', value: 'PRIVATE' },
    { label: 'ICU', value: 'ICU' },
    { label: 'NICU', value: 'NICU' },
    { label: 'PICU', value: 'PICU' },
    { label: 'Isolation', value: 'ISOLATION' },
    { label: 'Emergency Observation', value: 'EMERGENCY_OBSERVATION' }
  ];
  protected readonly roomTypeOptions: DropdownOption<string>[] = [
    { label: 'General', value: 'GENERAL' },
    { label: 'Semi-Private', value: 'SEMI_PRIVATE' },
    { label: 'Private', value: 'PRIVATE' },
    { label: 'ICU Room', value: 'ICU' },
    { label: 'Isolation', value: 'ISOLATION' },
    { label: 'Observation', value: 'OBSERVATION' }
  ];
  protected readonly bedTypeOptions: DropdownOption<string>[] = [
    { label: 'Standard', value: 'STANDARD' },
    { label: 'ICU', value: 'ICU' },
    { label: 'Electric', value: 'ELECTRIC' },
    { label: 'Pediatric', value: 'PEDIATRIC' },
    { label: 'Isolation', value: 'ISOLATION' }
  ];
  protected readonly facilityStatusOptions: DropdownOption<string>[] = [
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'Maintenance', value: 'MAINTENANCE' }
  ];
  protected readonly bedStatusOptions: DropdownOption<string>[] = [
    { label: 'Available', value: 'AVAILABLE' },
    { label: 'Reserved', value: 'RESERVED' },
    { label: 'Occupied', value: 'OCCUPIED' },
    { label: 'Cleaning', value: 'CLEANING' },
    { label: 'Maintenance', value: 'MAINTENANCE' },
    { label: 'Blocked', value: 'BLOCKED' }
  ];
  protected readonly patientConditionOptions: DropdownOption<string>[] = [
    { label: 'Stable', value: 'STABLE' },
    { label: 'Improving', value: 'IMPROVING' },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'Deteriorating', value: 'DETERIORATING' },
    { label: 'Under Observation', value: 'UNDER_OBSERVATION' }
  ];

  protected admissionForm: CreateIpdAdmissionRequest = createAdmissionForm();
  protected wardForm: SaveIpdWardRequest = createWardForm();
  protected roomForm: SaveIpdRoomRequest = createRoomForm();
  protected bedForm: SaveIpdBedRequest = createBedForm();
  protected vitalForm: SaveIpdVitalRequest = createVitalForm();
  protected doctorRoundForm: SaveIpdDoctorRoundRequest = createDoctorRoundForm();
  protected consultingDoctorId = '';
  protected transferBedId = '';
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
    const status = this.admissionStatusFilter();
    const ward = this.admissionWardFilter();
    const doctor = this.admissionDoctorFilter();
    const dateRange = this.admissionDateFilter();
    const items = this.workspace()?.admissions ?? [];

    return items.filter(item => [
      item.admissionNo,
      item.patientName,
      item.medicalRecordNo,
      item.doctorName,
      item.wardName,
      item.bedNo,
      item.statusCode
    ].some(value => String(value ?? '').toLowerCase().includes(query)))
      .filter(item => !status || item.statusCode.toUpperCase() === status)
      .filter(item => !ward || item.wardName === ward)
      .filter(item => !doctor || item.doctorId === doctor)
      .filter(item => this.matchesAdmissionDate(item.admittedAt, dateRange));
  });

  protected readonly filteredActiveInpatients = computed(() => {
    const query = this.activeSearchQuery().trim().toLowerCase();
    const ward = this.activeWardFilter();
    const doctor = this.activeDoctorFilter();
    const department = this.activeDepartmentFilter();
    const priority = this.activePriorityFilter();
    const items = this.workspace()?.activePatients ?? [];

    return items
      .filter(item => [
        item.admissionNo,
        item.patientName,
        item.medicalRecordNo,
        item.doctorName,
        item.departmentName,
        item.wardName,
        item.bedNo,
        item.statusCode,
        item.priorityCode
      ].some(value => String(value ?? '').toLowerCase().includes(query)))
      .filter(item => !ward || item.wardName === ward)
      .filter(item => !doctor || item.doctorId === doctor)
      .filter(item => !department || item.departmentName === department)
      .filter(item => !priority || item.priorityCode.toUpperCase() === priority);
  });

  protected readonly selectedAdmission = computed(() => {
    const id = this.selectedAdmissionId();
    const workspace = this.workspace();
    if (!workspace) {
      return null;
    }

    if (id) {
      return findAdmissionById(id, [
        ...workspace.admissions,
        ...workspace.activePatients,
        ...workspace.recentAdmissions
      ]);
    }

    return workspace.activePatients[0] ?? workspace.admissions[0] ?? null;
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

  protected readonly wardFilterOptions = computed<DropdownOption<string>[]>(() => {
    const names = unique((this.workspace()?.admissions ?? []).map(item => item.wardName).filter(Boolean));
    return [{ label: 'All wards', value: '' }, ...names.map(name => ({ label: name, value: name }))];
  });

  protected readonly doctorFilterOptions = computed<DropdownOption<string>[]>(() => {
    const rows = this.workspace()?.admissions ?? [];
    const doctors = unique(rows.filter(row => row.doctorId).map(row => `${row.doctorId}|${row.doctorName}`));
    return [{ label: 'All doctors', value: '' }, ...doctors.map(item => {
      const [value, label] = item.split('|');
      return { label, value };
    })];
  });

  protected readonly activeWardOptions = computed<DropdownOption<string>[]>(() => {
    const names = unique((this.workspace()?.activePatients ?? []).map(item => item.wardName).filter(Boolean));
    return [{ label: 'All wards', value: '' }, ...names.map(name => ({ label: name, value: name }))];
  });

  protected readonly activeDoctorOptions = computed<DropdownOption<string>[]>(() => {
    const rows = this.workspace()?.activePatients ?? [];
    const doctors = unique(rows.filter(row => row.doctorId).map(row => `${row.doctorId}|${row.doctorName}`));
    return [{ label: 'All doctors', value: '' }, ...doctors.map(item => {
      const [value, label] = item.split('|');
      return { label, value };
    })];
  });

  protected readonly activeDepartmentOptions = computed<DropdownOption<string>[]>(() => {
    const names = unique((this.workspace()?.activePatients ?? []).map(item => item.departmentName).filter(Boolean));
    return [{ label: 'All departments', value: '' }, ...names.map(name => ({ label: name, value: name }))];
  });

  protected readonly activePriorityOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All priorities', value: '' },
    ...this.priorityOptions
  ]);

  protected readonly departmentOptions = computed<DropdownOption<string>[]>(() => {
    const departments = unique((this.workspace()?.doctors ?? []).map(item => item.meta).filter(Boolean));
    return [{ label: 'Select department', value: '' }, ...departments.map(name => ({ label: name, value: name }))];
  });

  protected readonly wardSelectionOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select ward', value: '' },
    ...unique((this.workspace()?.beds ?? []).map(bed => bed.wardName).filter(Boolean)).map(name => ({ label: name, value: name }))
  ]);

  protected readonly roomSelectionOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select room', value: '' },
    ...unique((this.workspace()?.beds ?? [])
      .filter(bed => !this.selectedWardName() || bed.wardName === this.selectedWardName())
      .map(bed => roomNameForBed(bed.bedNo))).map(name => ({ label: name, value: name }))
  ]);

  protected readonly workflowBeds = computed<IpdBedStatus[]>(() => {
    const ward = this.selectedWardName();
    const room = this.selectedRoomName();
    return (this.workspace()?.beds ?? []).filter(bed =>
      (!ward || bed.wardName === ward) &&
      (!room || roomNameForBed(bed.bedNo) === room)
    );
  });

  protected readonly latestVital = computed(() => this.vitalRecords()[0] ?? null);

  private readonly service = inject(IpdManagementService);
  private readonly laboratoryService = inject(LaboratoryService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly ipdLabTests = signal<LabTest[]>([]);
  protected readonly ipdSelectedLabTests = signal<string[]>([]);
  protected ipdLabPriority = 'ROUTINE';
  protected ipdLabNotes = '';
  protected readonly labPriorityOptions: DropdownOption<string>[] = [{ label: 'Routine', value: 'ROUTINE' }, { label: 'Urgent', value: 'URGENT' }, { label: 'STAT', value: 'STAT' }];

  async ngOnInit(): Promise<void> {
    this.restoreDrafts();
    await this.load();
    const labTests = await this.laboratoryService.tests();
    this.ipdLabTests.set(labTests.data?.filter(test => test.isActive) ?? []);
    this.applyQueryHandoff();
  }

  protected toggleIpdLabTest(testId: string): void {
    this.ipdSelectedLabTests.update(items => items.includes(testId) ? items.filter(id => id !== testId) : [...items, testId]);
  }

  protected async createIpdLabOrder(admission: IpdAdmissionListItem): Promise<void> {
    if (!this.ipdSelectedLabTests().length) return;
    this.saving.set(true);
    try {
      const response = await this.laboratoryService.createOrder({ patientId: admission.patientId, consultationId: null, encounterId: admission.admissionId, encounterType: 'IPD', doctorId: admission.doctorId, sourceModule: 'IPD', priority: this.ipdLabPriority, clinicalNotes: this.ipdLabNotes, testIds: this.ipdSelectedLabTests(), packageIds: [], idempotencyKey: crypto.randomUUID() });
      if (response.success) {
        this.toast.success('Lab order created', `${response.data?.orderNumber || 'Order'} was sent to the laboratory worklist.`);
        this.ipdSelectedLabTests.set([]); this.ipdLabNotes = ''; this.ipdLabPriority = 'ROUTINE';
      } else this.toast.error('Unable to create lab order', response.message);
    } finally { this.saving.set(false); }
  }

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    await this.load(false);
    this.refreshing.set(false);
    this.toast.success('IPD refreshed', 'Latest admissions and bed status loaded.');
  }

  protected setTab(tab: IpdTab): void {
    this.activeTab.set(tab);
    if (tab !== 'patients') {
      this.activePatientDetailOpen.set(false);
    }
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
    this.admissionStep.set(1);
    this.admissionErrors.set({});
    this.hydrateBedSelectors();
    this.persistView();
  }

  protected closeAdmissionPanel(): void {
    this.admissionPanelOpen.set(false);
    this.admissionErrors.set({});
  }

  protected patientOptions(items: IpdOption[]): DropdownOption<string>[] {
    return [{ label: 'Select patient', value: '' }, ...items.map(item => ({ label: `${item.label} · ${item.meta}`, value: item.value }))];
  }

  protected doctorOptions(items: IpdOption[]): DropdownOption<string>[] {
    return [{ label: 'Select doctor', value: '' }, ...items.map(item => ({ label: item.meta ? `${item.label} · ${item.meta}` : item.label, value: item.value }))];
  }

  protected wardIdOptions(): DropdownOption<string>[] {
    return [{ label: 'Select ward', value: '' }, ...(this.workspace()?.wards ?? []).map(ward => ({ label: `${ward.wardName} · ${ward.wardCode}`, value: ward.wardId }))];
  }

  protected roomIdOptions(wardId?: string): DropdownOption<string>[] {
    return [
      { label: 'Select room', value: '' },
      ...(this.workspace()?.rooms ?? [])
        .filter(room => !wardId || room.wardId === wardId)
        .map(room => ({ label: `${room.roomNumber} · ${room.wardName}`, value: room.roomId }))
    ];
  }

  protected selectedAdmissionPatient(): IpdOption | null {
    return (this.workspace()?.patients ?? []).find(patient => patient.value === this.admissionForm.patientId) ?? null;
  }

  protected selectedDoctorName(): string {
    return (this.workspace()?.doctors ?? []).find(doctor => doctor.value === this.admissionForm.doctorId)?.label ?? 'Unassigned doctor';
  }

  protected selectedBed(): IpdBedStatus | null {
    return (this.workspace()?.beds ?? []).find(bed => bed.bedId === this.admissionForm.bedId) ?? null;
  }

  protected admissionWizardTitle(): string {
    return this.admissionSteps[this.admissionStep() - 1]?.label ?? 'New Admission';
  }

  protected fieldError(field: string): string {
    return this.admissionErrors()[field] ?? '';
  }

  protected goAdmissionStep(step: number): void {
    if (step <= this.admissionStep()) {
      this.admissionStep.set(step);
      this.admissionErrors.set({});
    }
  }

  protected previousAdmissionStep(): void {
    this.admissionStep.set(Math.max(1, this.admissionStep() - 1));
    this.admissionErrors.set({});
  }

  protected async nextAdmissionStep(): Promise<void> {
    if (!this.validateAdmissionStep(this.admissionStep())) {
      return;
    }

    const saved = await this.saveAdmissionDraft(false);
    if (saved) {
      this.admissionStep.set(Math.min(6, this.admissionStep() + 1));
      this.hydrateBedSelectors();
    }
  }

  protected registerPatientFromAdmission(): void {
    void this.router.navigate(['/patients'], { queryParams: { action: 'create', returnTo: 'ipd-admission' } });
  }

  protected selectWard(value: string): void {
    this.selectedWardName.set(value);
    this.selectedRoomName.set('');
    this.admissionForm.bedId = null;
  }

  protected selectRoom(value: string): void {
    this.selectedRoomName.set(value);
    this.admissionForm.bedId = null;
  }

  protected async selectAdmissionBed(bed: IpdBedStatus): Promise<void> {
    if (bed.statusCode.toUpperCase() !== 'AVAILABLE' && this.admissionForm.bedId !== bed.bedId) {
      this.toast.warning('Bed unavailable', `${bed.bedNo} is ${statusText(bed.statusCode).toLowerCase()}.`);
      return;
    }

    this.admissionForm.bedId = bed.bedId;
    this.selectedWardName.set(bed.wardName);
    this.selectedRoomName.set(roomNameForBed(bed.bedNo));
    await this.saveAdmissionDraft(false);
  }

  protected editWard(ward: IpdWardOccupancy): void {
    this.wardForm = {
      wardId: ward.wardId,
      wardName: ward.wardName,
      wardCode: ward.wardCode,
      wardType: ward.wardType || 'GENERAL',
      department: ward.department || 'General Medicine',
      floor: ward.floor || 'Ground',
      capacity: ward.capacity || Number(ward.totalBeds) || 0,
      statusCode: ward.statusCode || 'ACTIVE',
      description: ward.description || '',
      branchName: ward.branchName || 'Main Branch'
    };
  }

  protected editRoom(room: IpdRoom): void {
    this.roomForm = {
      roomId: room.roomId,
      wardId: room.wardId,
      roomNumber: room.roomNumber,
      roomType: room.roomType || 'GENERAL',
      floor: room.floor || 'Ground',
      capacity: room.capacity || Number(room.totalBeds) || 0,
      statusCode: room.statusCode || 'ACTIVE'
    };
  }

  protected editBed(bed: IpdBedStatus): void {
    this.bedForm = {
      bedId: bed.bedId,
      wardId: bed.wardId,
      roomId: bed.roomId || '',
      bedNumber: bed.bedNo,
      bedType: bed.bedType || 'STANDARD',
      statusCode: bed.statusCode || 'AVAILABLE',
      dailyCharge: Number(bed.dailyCharge || 0)
    };
  }

  protected resetWardForm(): void { this.wardForm = createWardForm(); }
  protected resetRoomForm(): void { this.roomForm = createRoomForm(); }
  protected resetBedForm(): void { this.bedForm = createBedForm(); }

  protected isSelectedBedCleaning(): boolean {
    return Boolean(this.bedForm.bedId) && this.bedForm.statusCode?.toUpperCase() === 'CLEANING';
  }

  protected async saveWard(): Promise<void> {
    if (!this.wardForm.wardName.trim() || !this.wardForm.wardCode.trim()) {
      this.toast.warning('Ward details required', 'Ward name and ward code are mandatory.');
      return;
    }

    await this.saveFacility(() => this.service.saveWard(this.wardForm), 'Ward saved');
    this.resetWardForm();
  }

  protected async saveRoom(): Promise<void> {
    if (!this.roomForm.wardId || !this.roomForm.roomNumber.trim()) {
      this.toast.warning('Room details required', 'Select ward and enter room number.');
      return;
    }

    await this.saveFacility(() => this.service.saveRoom(this.roomForm), 'Room saved');
    this.resetRoomForm();
  }

  protected async saveBed(): Promise<void> {
    if (!this.bedForm.wardId || !this.bedForm.roomId || !this.bedForm.bedNumber.trim()) {
      this.toast.warning('Bed details required', 'Select ward, room, and enter bed number.');
      return;
    }

    const bedId = this.bedForm.bedId;
    await this.saveFacility(async () => {
      const response = await this.service.saveBed(this.bedForm);
      if (bedId && response.success) {
        const statusResponse = await this.service.updateBedStatus(bedId, this.bedForm.statusCode);
        if (statusResponse.success === false) {
          return statusResponse;
        }
      }
      return response;
    }, 'Bed saved');
    this.resetBedForm();
  }

  protected async markSelectedBedAvailable(): Promise<void> {
    const bedId = this.bedForm.bedId;
    if (!bedId) {
      this.toast.warning('Select bed', 'Choose a cleaning bed before marking it available.');
      return;
    }

    await this.saveFacility(() => this.service.updateBedStatus(bedId, 'AVAILABLE'), 'Bed marked available');
    this.resetBedForm();
  }

  protected async deleteWard(ward: IpdWardOccupancy): Promise<void> {
    await this.saveFacility(() => this.service.deleteWard(ward.wardId), 'Ward deleted');
  }

  protected async deleteRoom(room: IpdRoom): Promise<void> {
    await this.saveFacility(() => this.service.deleteRoom(room.roomId), 'Room deleted');
  }

  protected async deleteBed(bed: IpdBedStatus): Promise<void> {
    await this.saveFacility(() => this.service.deleteBed(bed.bedId), 'Bed deleted');
  }

  protected selectAdmission(admission: IpdAdmissionListItem, tab: IpdTab): void {
    this.selectedAdmissionId.set(admission.admissionId);
    this.transferBedId = '';
    this.resetDoctorRoundForm(admission);
    this.loadAdmissionDraft(admission.admissionId);
    void this.loadDoctorRounds(admission.admissionId);
    void this.loadVitals(admission.admissionId);
    this.setTab(tab);
  }

  protected openInpatientDetail(admission: IpdAdmissionListItem): void {
    this.selectedAdmissionId.set(admission.admissionId);
    this.activePatientDetailOpen.set(true);
    this.activeDetailTab.set('overview');
    this.transferBedId = '';
    this.resetDoctorRoundForm(admission);
    this.loadAdmissionDraft(admission.admissionId);
    void this.loadDoctorRounds(admission.admissionId);
    void this.loadVitals(admission.admissionId);
  }

  protected openAdmissionDetailTab(admission: IpdAdmissionListItem, tab: IpdDetailTab): void {
    this.selectedAdmissionId.set(admission.admissionId);
    this.activePatientDetailOpen.set(true);
    this.activeDetailTab.set(tab);
    this.transferBedId = '';
    this.resetDoctorRoundForm(admission);
    this.loadAdmissionDraft(admission.admissionId);
    if (tab === 'rounds') {
      void this.loadDoctorRounds(admission.admissionId);
    }
    if (tab === 'vitals') {
      void this.loadVitals(admission.admissionId);
    }
  }

  protected closeInpatientDetail(): void {
    this.activePatientDetailOpen.set(false);
    this.activeDetailTab.set('overview');
  }

  protected setDetailTab(tab: IpdDetailTab): void {
    this.activeDetailTab.set(tab);
    if (tab === 'vitals') {
      const admission = this.selectedAdmission();
      if (admission) {
        void this.loadVitals(admission.admissionId);
      }
    }
    if (tab === 'rounds') {
      const admission = this.selectedAdmission();
      if (admission) {
        void this.loadDoctorRounds(admission.admissionId);
      }
    }
  }

  protected openAdmissionRecord(admission: IpdAdmissionListItem): void {
    this.selectedAdmissionId.set(admission.admissionId);
    if (['DRAFT', 'PENDING_ADMISSION'].includes(admission.statusCode.toUpperCase())) {
      this.admissionForm = {
        ...createAdmissionForm(),
        admissionId: admission.admissionId,
        admissionNo: admission.admissionNo,
        patientId: admission.patientId,
        doctorId: admission.doctorId,
        bedId: (this.workspace()?.beds ?? []).find(bed => bed.admissionId === admission.admissionId)?.bedId ?? null,
        source: admission.admissionSource || 'DIRECT',
        admissionType: admission.admissionType || 'GENERAL',
        priority: admission.priorityCode || 'ROUTINE',
        reason: admission.admissionReason || '',
        admittedAt: admission.admittedAt,
        departmentName: admission.departmentName || ''
      };
      this.admissionStep.set(admission.statusCode.toUpperCase() === 'PENDING_ADMISSION' ? 6 : 1);
      this.admissionPanelOpen.set(true);
      this.hydrateBedSelectors();
      return;
    }

    this.selectAdmission(admission, 'patients');
    this.activePatientDetailOpen.set(true);
    void this.loadDoctorRounds(admission.admissionId);
    void this.loadVitals(admission.admissionId);
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

  protected async saveAdmissionDraft(showToast = true): Promise<boolean> {
    localStorage.setItem(admissionDraftKey, JSON.stringify(this.admissionForm));
    if (!this.admissionForm.patientId) {
      if (showToast) {
        this.toast.success('Admission draft saved', 'Patient is required before syncing the draft to IPD.');
      }
      return true;
    }

    this.saving.set(true);
    const response = await this.service.saveAdmissionDraft({
      ...this.admissionForm,
      admissionId: this.admissionForm.admissionId ?? null,
      admissionSource: this.admissionForm.source,
      admissionReason: this.admissionForm.reason,
      priorityCode: this.admissionForm.priority,
      consultantDoctorIds: this.consultingDoctorId ? [this.consultingDoctorId] : (this.admissionForm.consultantDoctorIds ?? []),
      admittedAt: this.admissionForm.admittedAt || new Date().toISOString(),
      admissionDate: this.admissionForm.admittedAt || new Date().toISOString(),
      progressStep: this.admissionStep()
    });
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to save admission draft', getApiErrorMessage(response, 'IPD admission draft API failed'));
      return false;
    }

    this.admissionForm.admissionId = response.data.admissionId;
    if (response.data.allocation) {
      this.admissionForm.bedId = response.data.allocation.bedId;
    }
    await this.load(false);
    if (showToast) {
      this.toast.success('Admission draft saved', 'You can continue this admission from the Admission Desk.');
    }
    return true;
  }

  protected async confirmAdmission(): Promise<void> {
    if (!this.validateAdmissionStep(6)) {
      return;
    }

    await this.saveAdmissionDraft(false);
    const admissionId = this.admissionForm.admissionId;
    if (!admissionId) {
      this.toast.error('Unable to confirm admission', 'Draft admission was not created.');
      return;
    }

    this.saving.set(true);
    const response = await this.service.confirmAdmission(admissionId);
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to confirm admission', getApiErrorMessage(response, 'IPD admission confirmation failed'));
      return;
    }

    localStorage.removeItem(admissionDraftKey);
    this.admissionForm = createAdmissionForm();
    this.admissionPanelOpen.set(false);
    this.admissionStep.set(1);
    await this.load(false);
    this.selectedAdmissionId.set(admissionId);
    this.setTab('patients');
    this.toast.success('Admission confirmed', 'Patient is admitted and the selected bed is now occupied.');
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

    const nurseNote = this.nursingNote.trim();
    if (!nurseNote) {
      this.toast.warning('Nursing note required', 'Add nursing care details before saving.');
      return;
    }

    this.saving.set(true);
    const response = await this.service.addNursingNote(admission.admissionId, nurseNote);
    this.saving.set(false);

    if (!response.success) {
      this.toast.error('Unable to save nursing note', getApiErrorMessage(response, 'IPD nursing API failed'));
      return;
    }

    this.nursingNote = '';
    this.saveAdmissionCareDraft(admission.admissionId);
    this.toast.success('Nursing note saved', 'Nursing update is attached to the admission.');
  }

  protected async loadDoctorRounds(admissionId: string): Promise<void> {
    this.roundsLoading.set(true);
    this.doctorRoundRecords.set([]);
    const response = await this.service.doctorRounds(admissionId);
    this.roundsLoading.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to load doctor rounds', getApiErrorMessage(response, 'IPD doctor rounds API failed'));
      return;
    }

    this.doctorRoundRecords.set(response.data);
  }

  protected setDoctorRoundDate(value: string): void {
    this.doctorRoundForm.roundAt = value ? new Date(value).toISOString() : null;
  }

  protected setNextRoundDate(value: string): void {
    this.doctorRoundForm.nextRoundAt = value ? new Date(value).toISOString() : null;
  }

  protected resetDoctorRoundForm(admission = this.selectedAdmission()): void {
    this.doctorRoundForm = createDoctorRoundForm(admission ?? undefined);
  }

  protected async saveDoctorRound(): Promise<void> {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose an active IPD patient before recording a doctor round.');
      return;
    }

    const request = this.normalizedDoctorRoundRequest(admission);
    if (!request.doctorId) {
      this.toast.warning('Doctor required', 'Select the doctor who completed this round.');
      return;
    }

    if (!request.patientCondition) {
      this.toast.warning('Condition required', 'Select the current patient condition.');
      return;
    }

    if (!request.clinicalNotes) {
      this.toast.warning('Clinical notes required', 'Add clinical notes before recording the round.');
      return;
    }

    this.saving.set(true);
    const response = await this.service.addDoctorRound(admission.admissionId, request);
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to save doctor round', getApiErrorMessage(response, 'IPD doctor round API failed'));
      return;
    }

    await this.loadDoctorRounds(admission.admissionId);
    this.resetDoctorRoundForm(admission);
    this.saveAdmissionCareDraft(admission.admissionId);
    this.toast.success('Doctor round recorded', 'The round is now part of the inpatient clinical timeline.');
  }

  protected async loadVitals(admissionId: string): Promise<void> {
    this.vitalsLoading.set(true);
    this.vitalRecords.set([]);
    const response = await this.service.vitals(admissionId);
    this.vitalsLoading.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to load vitals', getApiErrorMessage(response, 'IPD vitals API failed'));
      return;
    }

    this.vitalRecords.set(response.data);
  }

  protected setVitalDate(value: string): void {
    this.vitalForm.recordedAt = value ? new Date(value).toISOString() : null;
  }

  protected resetVitalForm(): void {
    this.vitalForm = createVitalForm();
  }

  protected async saveVitals(): Promise<void> {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose an active IPD patient before recording vitals.');
      return;
    }

    const request = this.normalizedVitalRequest();
    if (!hasVitalMeasurement(request)) {
      this.toast.warning('Vitals required', 'Enter at least one vital value or note before saving.');
      return;
    }

    if (request.spo2 !== null && (request.spo2 < 0 || request.spo2 > 100)) {
      this.toast.warning('Invalid SpO2', 'SpO2 must be between 0 and 100.');
      return;
    }

    if (request.painScore !== null && (request.painScore < 0 || request.painScore > 10)) {
      this.toast.warning('Invalid pain score', 'Pain score must be between 0 and 10.');
      return;
    }

    this.saving.set(true);
    const response = await this.service.saveVitals(admission.admissionId, request);
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to save vitals', getApiErrorMessage(response, 'IPD vitals API failed'));
      return;
    }

    await this.loadVitals(admission.admissionId);
    this.resetVitalForm();
    this.toast.success('Vitals saved', 'Latest values and trend history updated.');
  }

  protected editVitals(record: IpdVitalRecord): void {
    this.vitalForm = {
      vitalId: record.vitalId,
      recordedAt: record.recordedAt,
      temperature: record.temperature,
      pulseRate: record.pulseRate,
      respiratoryRate: record.respiratoryRate,
      bloodPressureSystolic: record.bloodPressureSystolic,
      bloodPressureDiastolic: record.bloodPressureDiastolic,
      spo2: record.spo2,
      height: record.height,
      weight: record.weight,
      painScore: record.painScore,
      bloodGlucose: record.bloodGlucose,
      notes: record.notes,
      recordedBy: record.recordedBy
    };
    this.toast.info('Vitals loaded', 'Update the values and save again.');
  }

  protected async deleteVitals(record: IpdVitalRecord): Promise<void> {
    const admission = this.selectedAdmission();
    if (!admission) {
      return;
    }

    this.saving.set(true);
    const response = await this.service.deleteVitals(admission.admissionId, record.vitalId);
    this.saving.set(false);

    if (!response.success) {
      this.toast.error('Unable to delete vitals', getApiErrorMessage(response, 'IPD vitals delete failed'));
      return;
    }

    await this.loadVitals(admission.admissionId);
    if (this.vitalForm.vitalId === record.vitalId) {
      this.resetVitalForm();
    }
    this.toast.success('Vitals deleted', 'The reading was removed from history.');
  }

  protected latestVitalValue(key: 'temperature' | 'bloodPressure' | 'pulse' | 'spo2'): string {
    const latest = this.latestVital();
    if (!latest) {
      return 'Not recorded';
    }

    if (key === 'temperature') return this.valueWithUnit(latest.temperature, '°F', 'Not recorded');
    if (key === 'bloodPressure') return this.bloodPressureText(latest, 'Not recorded');
    if (key === 'pulse') return this.valueWithUnit(latest.pulseRate, 'bpm', 'Not recorded');
    return this.valueWithUnit(latest.spo2, '%', 'Not recorded');
  }

  protected valueWithUnit(value: number | null, unit: string, fallback = '-'): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return fallback;
    }

    const formatted = Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1);
    return unit === '%' ? `${formatted}%` : `${formatted} ${unit}`;
  }

  protected bloodPressureText(record: IpdVitalRecord, fallback = '-'): string {
    if (record.bloodPressureSystolic === null || record.bloodPressureDiastolic === null) {
      return fallback;
    }

    return `${record.bloodPressureSystolic} / ${record.bloodPressureDiastolic}`;
  }

  protected conditionClass(condition: string): string {
    return `condition-pill condition-${condition.toLowerCase().replace(/_/g, '-')}`;
  }

  protected roundDetails(round: IpdDoctorRound): { label: string; value: string }[] {
    return [
      { label: 'Diagnosis', value: round.diagnosisUpdate },
      { label: 'Plan', value: round.treatmentPlan },
      { label: 'Medication', value: round.medicationChanges },
      { label: 'Investigations', value: round.investigationOrders },
      { label: 'Procedure', value: round.procedureRecommendation },
      { label: 'Follow-up', value: round.followUpInstructions }
    ].filter(item => Boolean(item.value?.trim()));
  }

  protected trendPoints(key: 'temperature' | 'pulse' | 'spo2'): { index: number; height: number }[] {
    const values = this.vitalTrendValues(key).map((value, index) => ({ index, value }));

    if (values.length === 0) {
      return [];
    }

    if (values.length === 1) {
      return values.map(point => ({ index: point.index, height: 70 }));
    }

    const min = Math.min(...values.map(point => Number(point.value)));
    const max = Math.max(...values.map(point => Number(point.value)));
    const spread = Math.max(max - min, 1);
    return values.map(point => ({
      index: point.index,
      height: Math.max(18, Math.round(((Number(point.value) - min) / spread) * 72) + 18)
    }));
  }

  protected trendSummary(key: 'temperature' | 'pulse' | 'spo2'): string {
    const values = this.vitalTrendValues(key);

    if (values.length === 0) {
      return 'Awaiting readings';
    }

    if (values.length === 1) {
      return 'Latest reading only';
    }

    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;

    if (Math.abs(change) < 0.1) {
      return 'Stable from first reading';
    }

    const formatted = Number.isInteger(change) ? String(Math.abs(change)) : Math.abs(change).toFixed(1);
    const unit = key === 'temperature' ? ' °F' : key === 'pulse' ? ' bpm' : '%';
    return `${change > 0 ? 'Up' : 'Down'} ${formatted}${unit} from first reading`;
  }

  private vitalTrendValues(key: 'temperature' | 'pulse' | 'spo2'): number[] {
    return this.vitalRecords()
      .slice(0, 14)
      .reverse()
      .map(record => key === 'temperature' ? record.temperature : key === 'pulse' ? record.pulseRate : record.spo2)
      .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(Number(value)))
      .map(value => Number(value));
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

    openPrintWindow(
      'IPD Discharge Summary',
      buildDischargePrintDocument(admission, this.dischargeSummary || 'Draft summary not entered.')
    );
  }

  protected printAdmissionSummary(): void {
    const admission = this.selectedAdmission();
    if (!admission) {
      this.toast.warning('Select an inpatient', 'Choose a patient before printing.');
      return;
    }

    openPrintWindow('IPD Admission Detail', buildAdmissionPrintDocument(admission));
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

  protected formatMoney(value: number): string {
    return formatMoney(value);
  }

  protected bedStatusPercent(value: number): string {
    const totalBeds = this.workspace()?.summary.totalBeds ?? 0;
    return totalBeds > 0 ? formatPercent((value / totalBeds) * 100) : '0%';
  }

  protected detailTabLabel(tabKey: IpdDetailTab): string {
    return this.detailTabs.find(tab => tab.key === tabKey)?.label ?? 'Workspace';
  }

  protected detailTabIcon(tabKey: IpdDetailTab): string {
    return this.detailTabs.find(tab => tab.key === tabKey)?.icon ?? 'assignment';
  }

  protected detailTabHelp(tabKey: IpdDetailTab): string {
    const messages: Record<IpdDetailTab, string> = {
      overview: 'Review the current IPD stay, bed, doctor assignment, and attention items.',
      clinical: 'Capture diagnosis, admission reason, and clinical context for the stay.',
      rounds: 'Record doctor round notes and treatment plan updates.',
      nursing: 'Capture nursing observations, escalation, intake/output, and care notes.',
      vitals: 'Vitals charting will connect nursing observations to the inpatient stay.',
      medication: 'Medication reconciliation and administration records will attach here.',
      orders: 'Active clinical orders, pharmacy requests, and investigation requests will be tracked here.',
      lab: 'Laboratory and diagnostics requests will be visible from this admission.',
      procedures: 'Bedside and theatre procedures can be accumulated against this admission.',
      transfers: 'Move the patient between wards, rooms, and available beds.',
      billing: 'Track room rent, orders, payments, and discharge clearance for this stay.',
      documents: 'Admission consent, clinical files, discharge documents, and attachments will live here.',
      discharge: 'Prepare discharge summary and complete the discharge workflow.',
      activity: 'Audit trail and care timeline events will appear here.'
    };

    return messages[tabKey];
  }

  protected roomFromBed(bedNo: string): string {
    return roomNameForBed(bedNo);
  }

  protected overviewTimeline(admission: IpdAdmissionListItem): { time: string; label: string }[] {
    const admittedAt = this.formatTime(admission.admittedAt);
    const timeline = [
      { time: admittedAt, label: 'Patient admitted' }
    ];

    if (admission.primaryDiagnosis || admission.admissionReason) {
      timeline.push({ time: admittedAt, label: 'Initial assessment completed' });
    }

    if (admission.activeOrders > 0) {
      timeline.push({ time: admittedAt, label: `${admission.activeOrders} care update${admission.activeOrders > 1 ? 's' : ''} recorded` });
    }

    if (admission.bedNo) {
      timeline.push({ time: admittedAt, label: `Bed allocated to ${admission.bedNo}` });
    }

    if ((admission.outstanding || 0) > 0) {
      timeline.push({ time: admittedAt, label: 'Billing outstanding updated' });
    }

    return timeline;
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

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  protected dateTimeLocalValue(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  protected setAdmissionDate(value: string): void {
    this.admissionForm.admittedAt = value ? new Date(value).toISOString() : null;
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

  private normalizedVitalRequest(): SaveIpdVitalRequest {
    return {
      ...this.vitalForm,
      recordedAt: this.vitalForm.recordedAt || new Date().toISOString(),
      temperature: numericOrNull(this.vitalForm.temperature),
      pulseRate: numericOrNull(this.vitalForm.pulseRate),
      respiratoryRate: numericOrNull(this.vitalForm.respiratoryRate),
      bloodPressureSystolic: numericOrNull(this.vitalForm.bloodPressureSystolic),
      bloodPressureDiastolic: numericOrNull(this.vitalForm.bloodPressureDiastolic),
      spo2: numericOrNull(this.vitalForm.spo2),
      height: numericOrNull(this.vitalForm.height),
      weight: numericOrNull(this.vitalForm.weight),
      painScore: numericOrNull(this.vitalForm.painScore),
      bloodGlucose: numericOrNull(this.vitalForm.bloodGlucose),
      notes: this.vitalForm.notes?.trim() ?? '',
      recordedBy: this.vitalForm.recordedBy?.trim() || 'Hospital staff'
    };
  }

  private normalizedDoctorRoundRequest(admission: IpdAdmissionListItem): SaveIpdDoctorRoundRequest {
    return {
      doctorId: this.doctorRoundForm.doctorId || admission.doctorId || '',
      roundAt: this.doctorRoundForm.roundAt || new Date().toISOString(),
      patientCondition: this.doctorRoundForm.patientCondition || 'STABLE',
      clinicalNotes: this.doctorRoundForm.clinicalNotes?.trim() ?? '',
      diagnosisUpdate: this.doctorRoundForm.diagnosisUpdate?.trim() ?? '',
      treatmentPlan: this.doctorRoundForm.treatmentPlan?.trim() ?? '',
      medicationChanges: this.doctorRoundForm.medicationChanges?.trim() ?? '',
      investigationOrders: this.doctorRoundForm.investigationOrders?.trim() ?? '',
      procedureRecommendation: this.doctorRoundForm.procedureRecommendation?.trim() ?? '',
      followUpInstructions: this.doctorRoundForm.followUpInstructions?.trim() ?? '',
      nextRoundAt: this.doctorRoundForm.nextRoundAt || null
    };
  }

  private validateAdmissionStep(step: number): boolean {
    const errors: Record<string, string> = {};
    if (step >= 1 && !this.admissionForm.patientId) {
      errors['patientId'] = 'Patient is required.';
    }
    if (step >= 2) {
      if (!this.admissionForm.source) errors['source'] = 'Admission source is required.';
      if (!this.admissionForm.admittedAt) errors['admittedAt'] = 'Admission date and time are required.';
      if (!this.admissionForm.admissionType) errors['admissionType'] = 'Admission type is required.';
      if (!this.admissionForm.reason?.trim()) errors['reason'] = 'Admission reason is required.';
    }
    if (step >= 4) {
      if (!this.admissionForm.departmentName) errors['departmentName'] = 'Department is required.';
      if (!this.admissionForm.doctorId) errors['doctorId'] = 'Attending doctor is required.';
      if (!this.admissionForm.priority) errors['priority'] = 'Admission priority is required.';
    }
    if (step >= 6 && !this.admissionForm.bedId) {
      errors['bedId'] = 'Reserve a bed before confirming admission.';
      this.toast.warning('Bed allocation required', errors['bedId']);
    }

    this.admissionErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.toast.warning('Complete required fields', 'Highlighted fields are required before continuing.');
      return false;
    }

    return true;
  }

  private hydrateBedSelectors(): void {
    const bed = this.selectedBed();
    if (bed) {
      this.selectedWardName.set(bed.wardName);
      this.selectedRoomName.set(roomNameForBed(bed.bedNo));
    }
  }

  private matchesAdmissionDate(value: string, filter: string): boolean {
    if (!filter) {
      return true;
    }

    const date = new Date(value);
    const now = new Date();
    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (filter === 'TODAY') {
      return date.getTime() >= startOfToday;
    }

    const days = filter === '7D' ? 7 : 30;
    return date.getTime() >= now.getTime() - days * 86400000;
  }

  private async saveFacility(action: () => Promise<{ success?: boolean; data?: unknown; message?: string }>, successTitle: string): Promise<void> {
    this.saving.set(true);
    const response = await action();
    this.saving.set(false);

    if (response && response.success === false) {
      this.toast.error('Unable to save IPD structure', getApiErrorMessage(response as never, 'IPD facility API failed'));
      return;
    }

    await this.load(false);
    this.toast.success(successTitle, 'Ward, room, and bed structure updated.');
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
        const parsed = JSON.parse(careDraft) as {
          doctorRoundForm?: Partial<SaveIpdDoctorRoundRequest>;
          doctorRoundNote?: string;
          nursingNote?: string;
        };
        this.doctorRoundForm = {
          ...this.doctorRoundForm,
          ...(parsed.doctorRoundForm ?? {}),
          clinicalNotes: parsed.doctorRoundForm?.clinicalNotes ?? parsed.doctorRoundNote ?? this.doctorRoundForm.clinicalNotes
        };
        this.nursingNote = parsed.nursingNote ?? '';
      } catch {
        localStorage.removeItem(careDraftKey(admissionId));
      }
    } else {
      this.nursingNote = '';
    }

    this.dischargeSummary = localStorage.getItem(dischargeDraftKey(admissionId)) ?? '';
  }

  private saveAdmissionCareDraft(admissionId: string): void {
    localStorage.setItem(careDraftKey(admissionId), JSON.stringify({
      doctorRoundForm: this.doctorRoundForm,
      nursingNote: this.nursingNote
    }));
  }

  private persistView(): void {
    localStorage.setItem(viewStateKey, this.activeTab());
  }
}

function createAdmissionForm(): CreateIpdAdmissionRequest {
  return {
    admissionId: null,
    patientId: '',
    doctorId: null,
    bedId: null,
    admissionNo: '',
    source: 'OPD',
    admissionSource: 'OPD',
    admissionType: 'GENERAL',
    priority: 'ROUTINE',
    priorityCode: 'ROUTINE',
    reason: '',
    admissionReason: '',
    admittedAt: new Date().toISOString(),
    admissionDate: new Date().toISOString(),
    referredFrom: '',
    previousEncounter: '',
    departmentName: '',
    consultantDoctorIds: [],
    primaryDiagnosis: '',
    secondaryDiagnosis: '',
    admissionNotes: '',
    presentingComplaint: '',
    knownAllergies: '',
    bloodGroup: '',
    medicalHistory: '',
    currentMedication: '',
    infectionRisk: 'LOW',
    progressStep: 1
  };
}

function createWardForm(): SaveIpdWardRequest {
  return {
    wardId: null,
    wardName: '',
    wardCode: '',
    wardType: 'GENERAL',
    department: 'General Medicine',
    floor: 'Ground',
    capacity: 0,
    statusCode: 'ACTIVE',
    description: '',
    branchName: 'Main Branch'
  };
}

function createRoomForm(): SaveIpdRoomRequest {
  return {
    roomId: null,
    wardId: '',
    roomNumber: '',
    roomType: 'GENERAL',
    floor: 'Ground',
    capacity: 0,
    statusCode: 'ACTIVE'
  };
}

function createBedForm(): SaveIpdBedRequest {
  return {
    bedId: null,
    wardId: '',
    roomId: '',
    bedNumber: '',
    bedType: 'STANDARD',
    statusCode: 'AVAILABLE',
    dailyCharge: 0
  };
}

function createVitalForm(): SaveIpdVitalRequest {
  return {
    vitalId: null,
    recordedAt: new Date().toISOString(),
    temperature: null,
    pulseRate: null,
    respiratoryRate: null,
    bloodPressureSystolic: null,
    bloodPressureDiastolic: null,
    spo2: null,
    height: null,
    weight: null,
    painScore: null,
    bloodGlucose: null,
    notes: '',
    recordedBy: 'Hospital staff'
  };
}

function createDoctorRoundForm(admission?: IpdAdmissionListItem): SaveIpdDoctorRoundRequest {
  return {
    doctorId: admission?.doctorId ?? '',
    roundAt: new Date().toISOString(),
    patientCondition: 'STABLE',
    clinicalNotes: '',
    diagnosisUpdate: '',
    treatmentPlan: '',
    medicationChanges: '',
    investigationOrders: '',
    procedureRecommendation: '',
    followUpInstructions: '',
    nextRoundAt: null
  };
}

function findAdmissionById(id: string, admissions: IpdAdmissionListItem[]): IpdAdmissionListItem | null {
  const seen = new Set<string>();
  for (const admission of admissions) {
    if (seen.has(admission.admissionId)) {
      continue;
    }

    seen.add(admission.admissionId);
    if (admission.admissionId === id) {
      return admission;
    }
  }

  return null;
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

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

function statusText(value: string): string {
  return (value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function roomNameForBed(bedNo: string): string {
  const trimmed = bedNo.trim();
  if (!trimmed) {
    return 'Default Room';
  }

  const parts = trimmed.split('-');
  return parts.length > 1 ? parts.slice(0, -1).join('-') : trimmed.replace(/[A-Z]$/i, '') || trimmed;
}

function numericOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function hasVitalMeasurement(request: SaveIpdVitalRequest): boolean {
  return request.temperature !== null ||
    request.pulseRate !== null ||
    request.respiratoryRate !== null ||
    request.bloodPressureSystolic !== null ||
    request.bloodPressureDiastolic !== null ||
    request.spo2 !== null ||
    request.height !== null ||
    request.weight !== null ||
    request.painScore !== null ||
    request.bloodGlucose !== null ||
    Boolean(request.notes?.trim());
}

function buildAdmissionPrintDocument(admission: IpdAdmissionListItem): string {
  return `
    ${printDocumentHeader('IPD Admission Detail', 'Inpatient care summary', admission)}
    ${printPatientBand(admission)}
    <section class="summary-grid">
      ${printInfoCard('Admission ID', admission.admissionNo)}
      ${printInfoCard('Admitted On', printDateTime(admission.admittedAt))}
      ${printInfoCard('Ward / Room', `${admission.wardName || 'Pending'} / ${admission.roomNumber || 'Pending'}`)}
      ${printInfoCard('Bed', admission.bedNo || 'Pending')}
      ${printInfoCard('Doctor', admission.doctorName || 'Unassigned')}
      ${printInfoCard('Department', admission.departmentName || 'General Medicine')}
      ${printInfoCard('Stay', `Day ${admission.stayDays || 1}`)}
      ${printInfoCard('Outstanding', formatMoney(admission.outstanding || 0), 'amount')}
    </section>
    <section class="print-section">
      <div class="section-title">
        <span>Clinical Intake</span>
        <b>${escapeHtml(statusText(admission.priorityCode || 'Routine'))}</b>
      </div>
      <div class="details-grid">
        ${printDetail('Admission Source', statusText(admission.admissionSource || '-'))}
        ${printDetail('Admission Type', statusText(admission.admissionType || '-'))}
        ${printDetail('Reason', admission.admissionReason || '-')}
        ${printDetail('Primary Diagnosis', admission.primaryDiagnosis || '-')}
        ${printDetail('Known Allergies', admission.knownAllergies || 'Not recorded')}
        ${printDetail('Blood Group', admission.bloodGroup || 'Not recorded')}
      </div>
    </section>
    ${printSignatureBlock(['Prepared By', 'Treating Doctor', 'Patient / Attendant'])}
  `;
}

function buildDischargePrintDocument(admission: IpdAdmissionListItem, summary: string): string {
  return `
    ${printDocumentHeader('IPD Discharge Summary', 'Discharge readiness document', admission)}
    ${printPatientBand(admission)}
    <section class="summary-grid">
      ${printInfoCard('Admission ID', admission.admissionNo)}
      ${printInfoCard('Admission Date', printDateTime(admission.admittedAt))}
      ${printInfoCard('Ward / Bed', `${admission.wardName || 'Pending'} / ${admission.bedNo || 'Pending'}`)}
      ${printInfoCard('Consultant', admission.doctorName || 'Unassigned')}
      ${printInfoCard('Department', admission.departmentName || 'General Medicine')}
      ${printInfoCard('Final Status', statusText(admission.statusCode || '-'))}
    </section>
    <section class="print-section">
      <div class="section-title">
        <span>Discharge Notes</span>
        <b>Clinical Summary</b>
      </div>
      <div class="narrative">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>
    </section>
    <section class="print-section">
      <div class="section-title">
        <span>Billing Snapshot</span>
        <b>${escapeHtml(formatMoney(admission.outstanding || 0))}</b>
      </div>
      <div class="details-grid compact">
        ${printDetail('Current Bed', admission.bedNo || 'Pending')}
        ${printDetail('Stay Duration', `Day ${admission.stayDays || 1}`)}
        ${printDetail('Active Orders', String(admission.activeOrders || 0))}
        ${printDetail('Billing Status', (admission.outstanding || 0) > 0 ? 'Outstanding balance pending' : 'No outstanding balance')}
      </div>
    </section>
    ${printSignatureBlock(['Prepared By', 'Discharging Doctor', 'Patient / Attendant'])}
  `;
}

function printDocumentHeader(title: string, subtitle: string, admission: IpdAdmissionListItem): string {
  return `
    <header class="doc-header">
      <div class="brand-lockup">
        <div class="brand-mark">C360</div>
        <div>
          <p>Care360 Healthcare ERP</p>
          <h1>${escapeHtml(title)}</h1>
          <span>${escapeHtml(subtitle)}</span>
        </div>
      </div>
      <div class="doc-meta">
        <span>Generated</span>
        <strong>${escapeHtml(printDateTime(new Date().toISOString()))}</strong>
        <small>${escapeHtml(admission.admissionNo)}</small>
      </div>
    </header>
  `;
}

function printPatientBand(admission: IpdAdmissionListItem): string {
  return `
    <section class="patient-band">
      <div class="patient-avatar">${escapeHtml(printInitials(admission.patientName))}</div>
      <div class="patient-title">
        <span>Patient Details</span>
        <h2>${escapeHtml(admission.patientName)}</h2>
        <p>${escapeHtml(admission.medicalRecordNo || '-')} · ${escapeHtml(statusText(admission.statusCode || '-'))}</p>
      </div>
      <div class="status-badge">${escapeHtml(statusText(admission.statusCode || '-'))}</div>
    </section>
  `;
}

function printInfoCard(label: string, value: string, className = ''): string {
  return `<div class="info-card ${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`;
}

function printDetail(label: string, value: string): string {
  return `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`;
}

function printSignatureBlock(labels: string[]): string {
  return `
    <footer class="signature-grid">
      ${labels.map(label => `<div><span></span><b>${escapeHtml(label)}</b></div>`).join('')}
    </footer>
  `;
}

function printInitials(name: string): string {
  return (name || 'IP')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'IP';
}

function printDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function openPrintWindow(title: string, body: string): void {
  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) {
    return;
  }

  const safeTitle = escapeHtml(title);
  printWindow.document.write(`
    <html>
      <head>
        <title>${safeTitle}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #F1F5F9;
            color: #0F172A;
            font-family: Inter, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-page {
            width: min(210mm, 100%);
            min-height: 297mm;
            margin: 0 auto;
            padding: 18mm;
            background: #FFFFFF;
            box-shadow: 0 18px 50px rgba(15, 23, 42, .18);
          }
          .doc-header {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            padding: 18px;
            border-radius: 18px;
            background: linear-gradient(135deg, #0F766E, #2563EB);
            color: #FFFFFF;
          }
          .brand-lockup { display: flex; gap: 14px; align-items: center; min-width: 0; }
          .brand-mark {
            width: 58px;
            height: 58px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 16px;
            background: rgba(255, 255, 255, .18);
            border: 1px solid rgba(255, 255, 255, .28);
            font-size: 16px;
            font-weight: 950;
          }
          .brand-lockup p,
          .brand-lockup span,
          .doc-meta span,
          .doc-meta small {
            margin: 0;
            color: rgba(255, 255, 255, .82);
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          h1 {
            margin: 4px 0;
            font-size: 26px;
            line-height: 1.1;
          }
          .doc-meta {
            min-width: 150px;
            text-align: right;
            display: grid;
            align-content: center;
            gap: 4px;
          }
          .doc-meta strong { font-size: 13px; }
          .patient-band {
            display: grid;
            grid-template-columns: 64px minmax(0, 1fr) auto;
            gap: 14px;
            align-items: center;
            margin: 18px 0;
            padding: 16px;
            border: 1px solid #D8E1F0;
            border-radius: 16px;
            background: #F8FAFC;
          }
          .patient-avatar {
            width: 64px;
            height: 64px;
            display: grid;
            place-items: center;
            border-radius: 18px;
            background: linear-gradient(135deg, #2563EB, #0F766E);
            color: #FFFFFF;
            font-size: 22px;
            font-weight: 950;
          }
          .patient-title { min-width: 0; }
          .patient-title span,
          .info-card span,
          .detail-row span,
          .section-title span {
            color: #64748B;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .06em;
            text-transform: uppercase;
          }
          h2 {
            margin: 4px 0;
            font-size: 25px;
            line-height: 1.12;
          }
          .patient-title p { margin: 0; color: #475569; font-size: 13px; font-weight: 800; }
          .status-badge {
            padding: 8px 14px;
            border-radius: 999px;
            background: #DBEAFE;
            color: #1D4ED8;
            font-size: 12px;
            font-weight: 900;
            white-space: nowrap;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 18px;
          }
          .info-card {
            min-height: 74px;
            display: grid;
            align-content: center;
            gap: 5px;
            padding: 13px;
            border: 1px solid #D8E1F0;
            border-radius: 14px;
            background: #FFFFFF;
          }
          .info-card strong {
            font-size: 15px;
            line-height: 1.25;
            overflow-wrap: anywhere;
          }
          .info-card.amount strong { color: #0F766E; font-size: 18px; }
          .print-section {
            margin-top: 14px;
            padding: 16px;
            border: 1px solid #D8E1F0;
            border-radius: 16px;
            background: #FFFFFF;
          }
          .section-title {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            margin-bottom: 12px;
          }
          .section-title b {
            color: #2563EB;
            font-size: 12px;
            font-weight: 950;
            text-align: right;
          }
          .details-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .details-grid.compact { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .detail-row {
            min-height: 58px;
            display: grid;
            gap: 4px;
            align-content: center;
            padding: 12px;
            border-radius: 12px;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
          }
          .detail-row strong {
            font-size: 14px;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }
          .narrative {
            min-height: 150px;
            padding: 14px;
            border-radius: 12px;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            color: #1E293B;
            font-size: 14px;
            font-weight: 650;
            line-height: 1.6;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
            margin-top: 34px;
          }
          .signature-grid span {
            display: block;
            height: 42px;
            border-bottom: 1px solid #94A3B8;
          }
          .signature-grid b {
            display: block;
            margin-top: 8px;
            color: #475569;
            font-size: 12px;
            text-align: center;
          }
          @media print {
            body { background: #FFFFFF; }
            .print-page {
              width: auto;
              min-height: auto;
              margin: 0;
              padding: 0;
              box-shadow: none;
            }
          }
          @media (max-width: 760px) {
            .print-page { padding: 18px; }
            .doc-header,
            .patient-band {
              grid-template-columns: 1fr;
              text-align: left;
            }
            .doc-meta { text-align: left; }
            .summary-grid,
            .details-grid,
            .details-grid.compact,
            .signature-grid {
              grid-template-columns: 1fr;
            }
            .status-badge { width: max-content; }
          }
        </style>
      </head>
      <body><main class="print-page">${body}</main></body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 120);
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
