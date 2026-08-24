import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcPageActionsComponent } from '../../shared/ui/page-actions/page-actions.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DoctorAvailability, DoctorLeave, DoctorProfile, DoctorSchedule } from './doctor-management.models';
import { DoctorManagementService } from './doctor-management.service';

type DoctorProfileTab = 'overview' | 'professional' | 'availability' | 'schedule' | 'fees' | 'credentials' | 'appointments' | 'opd-patients' | 'ipd-patients' | 'performance' | 'activity';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcPageActionsComponent],
  template: `
    <section class="doctor-profile">
      <ac-page-actions backLink="/doctors" backLabel="Doctor Registry" (refreshed)="reload()" />

      @if (loading()) {
        <div class="profile-loader ac-card">Loading doctor profile...</div>
      } @else if (doctor(); as currentDoctor) {
        <section class="doctor-summary-card ac-card">
          <div class="hero-card">
            <div class="hero-main">
              <div class="doctor-avatar" [style.background]="avatarColor(currentDoctor.doctorGuid)">
                @if (currentDoctor.profilePhotoUrl) {
                  <img [src]="currentDoctor.profilePhotoUrl" [alt]="currentDoctor.fullName" />
                } @else {
                  {{ initials(currentDoctor.fullName) }}
                }
              </div>
              <div>
                <p class="ac-eyebrow">Doctor 360</p>
                <h1 class="ac-page-title">{{ currentDoctor.fullName }}</h1>
                <div class="hero-pills">
                  <span class="pill strong"># {{ currentDoctor.doctorCode }}</span>
                  <span class="pill">{{ currentDoctor.departmentName }}</span>
                  <span class="pill">{{ currentDoctor.primarySpecialization }}</span>
                  <span class="pill">{{ currentDoctor.registrationNo }}</span>
                  <span class="pill">{{ currency(currentDoctor.consultationFee) }}</span>
                </div>
              </div>
            </div>
            <div class="hero-status">
              <span class="status-dot" [class.warn]="currentDoctor.statusCode !== 'ACTIVE'"></span>
              <strong>{{ currentDoctor.statusName }}</strong>
              <small>Joined {{ formatDate(currentDoctor.joiningDate || currentDoctor.createdDate) }}</small>
            </div>
          </div>

          <section class="overview-grid summary-kpis">
            @for (card of overviewCards(); track card.label) {
              <article class="metric-card">
                <span class="material-symbols-rounded" [style.color]="card.color">{{ card.icon }}</span>
                <div>
                  <strong>{{ card.value }}</strong>
                  <small>{{ card.label }}</small>
                </div>
              </article>
            }
          </section>
        </section>

        <nav class="tab-bar ac-card" aria-label="Doctor profile sections">
          @for (tab of tabs; track tab.id) {
            <button type="button" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
              <span class="material-symbols-rounded">{{ tab.icon }}</span>
              {{ tab.label }}
            </button>
          }
        </nav>

        <section class="tab-content ac-card">
          @switch (activeTab()) {
            @case ('overview') {
              <div class="split-layout">
                <article class="overview-panel care-panel">
                  <div class="panel-title">
                    <span class="panel-icon material-symbols-rounded">clinical_notes</span>
                    <div>
                      <p class="ac-eyebrow">Doctor snapshot</p>
                      <h2>Clinical summary</h2>
                    </div>
                  </div>
                  <div class="detail-grid overview-detail-grid">
                    <span class="detail-tile"><small>Registration</small><strong>{{ currentDoctor.registrationNo }}</strong><em>Medical council ID</em></span>
                    <span class="detail-tile"><small>Council</small><strong>{{ currentDoctor.registrationCouncil || '-' }}</strong><em>Credential authority</em></span>
                    <span class="detail-tile"><small>Experience</small><strong>{{ currentDoctor.experienceYears }} yrs</strong><em>Clinical practice</em></span>
                    <span class="detail-tile"><small>Branch</small><strong>{{ currentDoctor.branchName }}</strong><em>Care location</em></span>
                  </div>
                </article>
                <article class="overview-panel workflow-panel">
                  <div class="panel-title">
                    <span class="panel-icon workflow-icon material-symbols-rounded">hub</span>
                    <div>
                      <p class="ac-eyebrow">Patient linkage</p>
                      <h2>Workflow summary</h2>
                    </div>
                  </div>
                  <div class="detail-grid overview-detail-grid">
                    <span class="detail-tile"><small>Appointments</small><strong>{{ currentDoctor.performance.totalAppointments }}</strong><em>Scheduled care</em></span>
                    <span class="detail-tile"><small>Consultations</small><strong>{{ currentDoctor.performance.totalConsultations }}</strong><em>Completed visits</em></span>
                    <span class="detail-tile"><small>Admissions</small><strong>{{ currentDoctor.performance.admissions }}</strong><em>IPD linkage</em></span>
                    <span class="detail-tile"><small>Revenue</small><strong>{{ currency(currentDoctor.performance.revenue) }}</strong><em>Billing impact</em></span>
                  </div>
                </article>
              </div>
              @if (currentDoctor.bio) {
                <article class="bio-card">
                  <h2>Profile note</h2>
                  <p>{{ currentDoctor.bio }}</p>
                </article>
              }
            }
            @case ('professional') {
              <div class="record-grid">
                @for (department of currentDoctor.departments; track department.mappingGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">domain</span>
                    <div>
                      <h3>{{ department.departmentName }}</h3>
                      <p>{{ department.branchName }} · {{ department.isPrimary ? 'Primary' : 'Mapped' }} · {{ department.statusCode }}</p>
                    </div>
                  </article>
                }
                @for (specialization of currentDoctor.specializations; track specialization.specializationGuid) {
                  <article class="record-card cyan">
                    <span class="material-symbols-rounded">workspace_premium</span>
                    <div>
                      <h3>{{ specialization.specializationName }}</h3>
                      <p>{{ specialization.experienceYears }} yrs · {{ specialization.isPrimary ? 'Primary' : 'Secondary' }}</p>
                    </div>
                  </article>
                }
              </div>
            }
            @case ('availability') {
              <div class="stacked-section">
                <div class="availability-actions">
                  <button type="button" class="ac-btn ac-btn-primary" (click)="openAvailabilityForm(currentDoctor, 'ACTIVE')"><span class="material-symbols-rounded">add</span>Add Schedule</button>
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="blockDate(currentDoctor)"><span class="material-symbols-rounded">event_busy</span>Block Date</button>
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="openLeaveForm(currentDoctor)"><span class="material-symbols-rounded">free_cancellation</span>Add Leave</button>
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="openAvailabilityForm(currentDoctor, 'OVERRIDE')"><span class="material-symbols-rounded">edit_calendar</span>Override Availability</button>
                </div>
                @if (leaveForm(); as form) {
                  <form class="leave-form" (ngSubmit)="saveLeave(currentDoctor)">
                    <label>
                      <span>Doctor</span>
                      <input [value]="currentDoctor.fullName" readonly />
                    </label>
                    <label>
                      <span>Leave Start Date</span>
                      <input type="datetime-local" name="leaveStartsAt" [(ngModel)]="form.startsAt" required />
                    </label>
                    <label>
                      <span>Leave End Date</span>
                      <input type="datetime-local" name="leaveEndsAt" [(ngModel)]="form.endsAt" required />
                    </label>
                    <label>
                      <span>Status</span>
                      <select name="leaveStatus" [(ngModel)]="form.statusCode">
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING">Pending</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </label>
                    <label class="span-2">
                      <span>Reason</span>
                      <textarea name="leaveReason" rows="3" [(ngModel)]="form.reason"></textarea>
                    </label>
                    <div class="leave-form-actions span-2">
                      <button type="button" class="ac-btn ac-btn-secondary" (click)="cancelLeaveForm()">Cancel</button>
                      <button type="submit" class="ac-btn ac-btn-primary">Save Leave</button>
                    </div>
                  </form>
                }
                <div class="record-grid">
                  @for (availability of currentDoctor.availability; track availability.availabilityGuid) {
                    <article class="record-card">
                      <span class="material-symbols-rounded">calendar_clock</span>
                      <div>
                        <h3>{{ availability.dayName }}</h3>
                        <p>{{ availability.startsAt }} - {{ availability.endsAt }} · {{ availability.slotDurationMinutes }} min slots · {{ availability.maxPatients }} max · {{ availability.consultationType }} · {{ availability.branchName }}</p>
                      </div>
                    </article>
                  } @empty {
                    <div class="empty-state">No availability configured yet.</div>
                  }
                </div>
              </div>
            }
            @case ('schedule') {
              <div class="stacked-section">
                <div>
                  <h2>Schedules</h2>
                  <div class="record-grid">
                    @for (schedule of currentDoctor.schedules; track schedule.scheduleGuid) {
                      <article class="record-card">
                        <span class="material-symbols-rounded">event_available</span>
                        <div>
                          <h3>{{ formatDate(schedule.scheduleDate) }}</h3>
                          <p>{{ schedule.startsAt || '-' }} - {{ schedule.endsAt || '-' }} · {{ schedule.roomName || 'Room not set' }} · {{ schedule.statusCode }}</p>
                        </div>
                      </article>
                    } @empty {
                      <div class="empty-state">No schedules created yet.</div>
                    }
                  </div>
                </div>
                <div>
                  <h2>Appointment slots</h2>
                  <div class="record-grid">
                    @for (slot of currentDoctor.appointmentSlots; track slot.slotGuid) {
                      <article class="record-card" [class.warning]="slot.isBooked">
                        <span class="material-symbols-rounded">{{ slot.isBooked ? 'event_busy' : 'event_available' }}</span>
                        <div>
                          <h3>{{ formatDateTime(slot.startsAt) }}</h3>
                          <p>{{ formatTime(slot.startsAt) }} - {{ formatTime(slot.endsAt) }} · {{ slot.isBooked ? 'Booked' : 'Available' }} · {{ slot.maxPatients }} patient capacity</p>
                        </div>
                      </article>
                    } @empty {
                      <div class="empty-state">No appointment slots generated yet.</div>
                    }
                  </div>
                </div>
              </div>
            }
            @case ('fees') {
              <div class="record-grid">
                @for (fee of currentDoctor.fees; track fee.feeGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">payments</span>
                    <div>
                      <h3>{{ currency(fee.amount) }}</h3>
                      <p>{{ fee.consultationType }} · {{ fee.departmentName }} · {{ fee.patientCategory }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No fee slabs configured yet.</div>
                }
              </div>
            }
            @case ('credentials') {
              <div class="stacked-section">
                <div>
                  <h2>Registrations</h2>
                  <div class="record-grid">
                    @for (registration of currentDoctor.registrations; track registration.registrationGuid) {
                      <article class="record-card">
                        <span class="material-symbols-rounded">workspace_premium</span>
                        <div>
                          <h3>{{ registration.registrationNo }}</h3>
                          <p>{{ registration.registrationCouncil }} · Expires {{ formatDate(registration.expiryDate) }} · {{ registration.statusCode }}</p>
                        </div>
                      </article>
                    } @empty {
                      <div class="empty-state">No registration rows available.</div>
                    }
                  </div>
                </div>
                <div>
                  <h2>Documents</h2>
                  <div class="record-grid">
                    @for (document of currentDoctor.documents; track document.documentGuid) {
                      <article class="record-card">
                        <span class="material-symbols-rounded">description</span>
                        <div>
                          <h3>{{ document.documentName }}</h3>
                          <p>{{ document.documentType }} · {{ document.verificationStatus }} · {{ formatDateTime(document.uploadedDate) }}</p>
                        </div>
                      </article>
                    } @empty {
                      <div class="empty-state">No documents uploaded yet.</div>
                    }
                  </div>
                </div>
              </div>
            }
            @case ('appointments') {
              <div class="record-grid">
                @for (record of currentDoctor.appointments; track record.recordGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">event</span>
                    <div>
                      <h3>{{ record.patientName }}</h3>
                      <p>{{ record.medicalRecordNo }} · {{ record.mobileNo || '-' }} · {{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No appointment patients linked through the workflow yet.</div>
                }
              </div>
            }
            @case ('opd-patients') {
              <div class="record-grid">
                @for (record of currentDoctor.opdPatients; track record.recordGuid) {
                  <article class="record-card cyan">
                    <span class="material-symbols-rounded">stethoscope</span>
                    <div>
                      <h3>{{ record.patientName }}</h3>
                      <p>{{ record.medicalRecordNo }} · {{ record.mobileNo || '-' }} · {{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No OPD patients linked through consultations yet.</div>
                }
              </div>
            }
            @case ('ipd-patients') {
              <div class="record-grid">
                @for (record of currentDoctor.ipdPatients; track record.recordGuid) {
                  <article class="record-card warning">
                    <span class="material-symbols-rounded">bed</span>
                    <div>
                      <h3>{{ record.patientName }}</h3>
                      <p>{{ record.medicalRecordNo }} · {{ record.mobileNo || '-' }} · {{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No IPD patients linked through admissions yet.</div>
                }
              </div>
            }
            @case ('performance') {
              <div class="performance-grid">
                <div><small>Total appointments</small><strong>{{ currentDoctor.performance.totalAppointments }}</strong></div>
                <div><small>Completed</small><strong>{{ currentDoctor.performance.completedAppointments }}</strong></div>
                <div><small>Cancelled</small><strong>{{ currentDoctor.performance.cancelledAppointments }}</strong></div>
                <div><small>No show</small><strong>{{ currentDoctor.performance.noShowAppointments }}</strong></div>
                <div><small>Slot utilization</small><strong>{{ currentDoctor.performance.slotUtilization | number:'1.0-0' }}%</strong></div>
                <div><small>Revenue</small><strong>{{ currency(currentDoctor.performance.revenue) }}</strong></div>
              </div>
            }
            @case ('activity') {
              <section class="activity-tracker">
                <header class="tracker-head">
                  <div>
                    <p class="ac-eyebrow">Doctor timeline</p>
                    <h2>Doctor activity tracker</h2>
                  </div>
                  <span class="tracker-count">{{ currentDoctor.activity.length }} events</span>
                </header>
                <ol class="timeline tracker-list">
                  @for (activity of currentDoctor.activity; track activity.activityGuid + activity.eventDate; let index = $index) {
                    <li class="tracker-item">
                      <div class="tracker-marker">
                        <span class="tracker-step">{{ index + 1 }}</span>
                      </div>
                      <article class="tracker-card">
                        <div class="tracker-card-head">
                          <div>
                            <strong>{{ activity.eventType }}</strong>
                            <p>{{ activity.description }}</p>
                          </div>
                          <span class="tracker-date">{{ formatDateTime(activity.eventDate) }}</span>
                        </div>
                        <div class="tracker-meta">
                          <span class="material-symbols-rounded">apps</span>
                          {{ activity.sourceModule }}
                        </div>
                      </article>
                    </li>
                  } @empty {
                    <div class="empty-state">No doctor activity captured yet.</div>
                  }
                </ol>
              </section>
            }
          }
        </section>

        @if (availabilityForm(); as form) {
          <div class="modal-backdrop" (click)="cancelAvailabilityForm()">
            <form class="availability-modal" (click)="$event.stopPropagation()" (ngSubmit)="saveAvailability(currentDoctor)">
              <header class="availability-modal-head">
                <span class="availability-modal-icon material-symbols-rounded">{{ form.statusCode === 'OVERRIDE' ? 'edit_calendar' : 'calendar_add_on' }}</span>
                <div>
                  <p class="ac-eyebrow">{{ form.statusCode === 'OVERRIDE' ? 'Availability override' : 'Reusable schedule' }}</p>
                  <h2>{{ form.statusCode === 'OVERRIDE' ? 'Override Availability' : 'Add Schedule' }}</h2>
                </div>
                <button type="button" class="modal-close" aria-label="Close availability form" (click)="cancelAvailabilityForm()">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </header>

              <div class="availability-modal-body">
                <label>
                  <span>Doctor</span>
                  <input [value]="currentDoctor.fullName" readonly />
                </label>
                <label>
                  <span>Branch</span>
                  <input name="availabilityBranch" [(ngModel)]="form.branchName" required />
                </label>
                <label>
                  <span>Day</span>
                  <ac-dropdown name="availabilityDay" [(ngModel)]="form.dayOfWeek" [options]="availabilityDayOptions" />
                </label>
                <label>
                  <span>Consultation Type</span>
                  <ac-dropdown name="availabilityConsultationType" [(ngModel)]="form.consultationType" [options]="consultationTypeOptions" />
                </label>
                <label>
                  <span>Start Time</span>
                  <input type="time" name="availabilityStartsAt" [(ngModel)]="form.startsAt" required />
                </label>
                <label>
                  <span>End Time</span>
                  <input type="time" name="availabilityEndsAt" [(ngModel)]="form.endsAt" required />
                </label>
                <label>
                  <span>Slot Duration</span>
                  <input type="number" name="availabilitySlotDuration" min="5" max="240" step="5" [(ngModel)]="form.slotDurationMinutes" required />
                </label>
                <label>
                  <span>Maximum Patients</span>
                  <input type="number" name="availabilityMaxPatients" min="1" max="100" [(ngModel)]="form.maxPatients" required />
                </label>
              </div>

              <footer class="availability-modal-actions">
                <button type="button" class="ac-btn ac-btn-secondary" (click)="cancelAvailabilityForm()">Cancel</button>
                <button type="submit" class="ac-btn ac-btn-primary">
                  <span class="material-symbols-rounded">save</span>
                  Save Availability
                </button>
              </footer>
            </form>
          </div>
        }
      } @else {
        <div class="profile-loader ac-card">Doctor profile was not found.</div>
      }
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .doctor-profile { display: flex; flex-direction: column; align-items: stretch; gap: 18px; min-width: 0; }
    .profile-header { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
    .back-link { color: var(--ac-muted); text-decoration: none; font-weight: 800; display: inline-flex; gap: 8px; align-items: center; }
    .back-link:hover { color: var(--ac-primary); }
    .profile-loader { padding: 28px; color: var(--ac-muted); }
    .hero-card { padding: 28px 30px; display: flex; justify-content: space-between; gap: 20px; align-items: center; background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 10%, var(--ac-surface)), var(--ac-surface)); }
    .hero-main { display: flex; gap: 18px; align-items: center; min-width: 0; }
    .doctor-avatar { width: 82px; height: 82px; border-radius: 22px; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 25px; overflow: hidden; box-shadow: 0 18px 40px rgba(37,99,235,.18); flex: 0 0 82px; }
    .doctor-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .hero-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .pill { border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-muted); border-radius: 999px; padding: 7px 11px; font-size: 12.5px; font-weight: 800; }
    .pill.strong { color: var(--ac-primary); background: var(--ac-primary-light); }
    .hero-status { display: grid; gap: 4px; justify-items: end; color: var(--ac-muted); }
    .hero-status strong { color: var(--ac-text); font-size: 18px; }
    .status-dot { width: 12px; height: 12px; border-radius: 999px; background: #10B981; box-shadow: 0 0 0 5px rgba(16,185,129,.12); }
    .status-dot.warn { background: #F59E0B; box-shadow-color: rgba(245,158,11,.16); }
    .overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .metric-card { display: flex; align-items: center; gap: 14px; padding: 17px 20px; }
    .metric-card .material-symbols-rounded { width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; background: var(--ac-subtle); }
    .metric-card strong { display: block; color: var(--ac-text); font-size: 24px; line-height: 1; }
    .metric-card small { color: var(--ac-muted); }
    .tab-bar { padding: 8px; display: flex; gap: 8px; overflow-x: auto; }
    .tab-bar button { min-height: 42px; border: 0; border-radius: 8px; background: transparent; color: var(--ac-muted); font-weight: 800; padding: 0 13px; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; cursor: pointer; }
    .tab-bar button.active { background: var(--ac-primary-light); color: var(--ac-primary); }
    .tab-bar .material-symbols-rounded { font-size: 19px; }
    .tab-content { padding: 24px; min-height: 300px; }
    h2 { margin: 0 0 14px; color: var(--ac-text); font-size: 18px; }
    .split-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .split-layout article, .bio-card { border: 1px solid var(--ac-border); border-radius: 8px; padding: 18px; background: var(--ac-surface); }
    .bio-card { margin-top: 18px; }
    .bio-card p { margin: 0; color: var(--ac-muted); line-height: 1.6; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .detail-grid span, .performance-grid div { border: 1px solid var(--ac-border); border-radius: 8px; padding: 14px; background: var(--ac-subtle); min-width: 0; }
    small { color: var(--ac-muted); }
    .detail-grid small, .performance-grid small { display: block; margin-bottom: 5px; }
    .detail-grid strong, .performance-grid strong { color: var(--ac-text); overflow-wrap: anywhere; }
    .record-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .record-card { border: 1px solid var(--ac-border); border-radius: 8px; padding: 16px; display: flex; gap: 12px; align-items: flex-start; background: var(--ac-surface); }
    .record-card > .material-symbols-rounded { width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center; background: var(--ac-primary-light); color: var(--ac-primary); flex: 0 0 42px; }
    .record-card.warning > .material-symbols-rounded { background: #FFF7ED; color: #EA580C; }
    .record-card.cyan > .material-symbols-rounded { background: #E6F8FC; color: #0891B2; }
    .record-card h3 { margin: 0; color: var(--ac-text); font-size: 16px; }
    .record-card p { margin: 5px 0 0; color: var(--ac-muted); line-height: 1.4; }
    .stacked-section { display: grid; gap: 22px; }
    .performance-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .performance-grid strong { font-size: 24px; }
    .timeline { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }
    .timeline li { display: grid; grid-template-columns: 18px 1fr; gap: 12px; }
    .timeline li > span { width: 12px; height: 12px; border-radius: 999px; background: var(--ac-primary); margin-top: 6px; box-shadow: 0 0 0 5px color-mix(in srgb, var(--ac-primary) 15%, transparent); }
    .timeline strong { color: var(--ac-text); }
    .timeline p { margin: 4px 0; color: var(--ac-muted); }
    .empty-state { border: 1px dashed var(--ac-border); border-radius: 8px; padding: 24px; color: var(--ac-muted); text-align: center; }
    @media (max-width: 1020px) {
      .overview-grid, .performance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .split-layout, .record-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 680px) {
      .profile-header, .hero-card, .hero-main { align-items: flex-start; flex-direction: column; }
      .hero-status { justify-items: start; }
      .overview-grid, .performance-grid, .detail-grid { grid-template-columns: 1fr; }
      .tab-content, .hero-card { padding: 18px; }
    }

    :host { height: 100%; min-height: 0; }
    .doctor-profile {
      height: 100%;
      min-height: 0;
      overflow: auto;
      padding: 0 0 10px;
      scrollbar-gutter: stable;
    }
    .profile-header { padding: 2px 4px; }
    .back-link {
      min-height: 40px;
      padding: 0 12px;
      border: 1px solid transparent;
      border-radius: 999px;
      color: var(--ac-muted);
      font-size: 13.5px;
      font-weight: 850;
      text-decoration: none;
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }
    .back-link:hover {
      color: var(--ac-primary);
      background: var(--ac-primary-light);
      border-color: color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      transform: translateX(-2px);
    }
    .hero-card {
      position: relative;
      overflow: hidden;
      min-height: 154px;
      padding: 24px 26px;
      border-color: color-mix(in srgb, var(--ac-primary) 14%, var(--ac-border));
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 12%, var(--ac-surface)) 0%, color-mix(in srgb, #0891b2 9%, var(--ac-surface)) 52%, var(--ac-surface) 100%);
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.07);
    }
    .hero-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: linear-gradient(90deg, var(--ac-primary), #0891b2, #10b981);
    }
    .hero-main, .hero-status { position: relative; z-index: 1; }
    .doctor-avatar {
      width: 76px;
      height: 76px;
      border-radius: 20px;
      outline: 6px solid color-mix(in srgb, var(--ac-surface) 72%, transparent);
      box-shadow: 0 16px 30px color-mix(in srgb, var(--ac-primary) 22%, transparent);
    }
    .hero-main h1 { margin-top: 2px; line-height: 1.06; letter-spacing: 0; }
    .hero-pills { margin-top: 12px; gap: 8px; }
    .pill {
      min-height: 32px;
      border-color: color-mix(in srgb, var(--ac-border) 75%, var(--ac-surface));
      background: color-mix(in srgb, var(--ac-surface) 82%, white);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
      font-weight: 850;
    }
    .hero-status {
      min-width: 230px;
      padding: 18px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 82%, var(--ac-surface));
      border-radius: 18px;
      background: color-mix(in srgb, var(--ac-surface) 86%, white);
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
      text-align: right;
    }
    .hero-status strong {
      display: block;
      margin-top: 8px;
      color: var(--ac-text);
      font-size: 17px;
    }
    .overview-grid, .performance-grid {
      grid-template-columns: repeat(4, minmax(170px, 1fr));
      gap: 14px;
    }
    .metric-card, .performance-card {
      position: relative;
      overflow: hidden;
      min-height: 108px;
      border-color: color-mix(in srgb, var(--ac-border) 84%, var(--ac-surface));
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .metric-card::before, .performance-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--ac-primary), color-mix(in srgb, var(--ac-primary) 35%, transparent));
    }
    .metric-card:hover, .performance-card:hover {
      border-color: color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
      transform: translateY(-2px);
    }
    .tab-bar {
      position: sticky;
      top: 0;
      z-index: 3;
      gap: 8px;
      margin: 2px 0 4px;
      padding: 8px;
      overflow-x: auto;
      border: 1px solid var(--ac-border);
      border-radius: 18px;
      background: color-mix(in srgb, var(--ac-surface) 88%, var(--ac-subtle));
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
      scrollbar-width: none;
    }
    .tab-bar::-webkit-scrollbar { display: none; }
    .tab-bar button {
      min-height: 40px;
      padding: 0 14px;
      border-radius: 14px;
      border-color: transparent;
      white-space: nowrap;
    }
    .tab-bar button.active { box-shadow: 0 10px 22px color-mix(in srgb, var(--ac-primary) 16%, transparent); }
    .tab-content {
      overflow: hidden;
      border-color: color-mix(in srgb, var(--ac-border) 86%, var(--ac-surface));
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.05);
    }
    .split-layout, .record-grid { gap: 16px; }
    .split-layout > section,
    .record-card,
    .bio-card,
    .detail-grid > div,
    .empty-state,
    .timeline li {
      border-color: color-mix(in srgb, var(--ac-border) 84%, var(--ac-surface));
      background: color-mix(in srgb, var(--ac-surface) 92%, var(--ac-subtle));
    }
    .detail-grid > div { border-radius: 14px; }
    .empty-state {
      min-height: 190px;
      display: grid;
      place-items: center;
      border-style: dashed;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), color-mix(in srgb, #0891b2 5%, var(--ac-surface)));
    }
    .record-card, .bio-card { box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04); }

    @media (max-width: 1020px) {
      .overview-grid, .performance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 680px) {
      .doctor-profile { gap: 14px; padding-bottom: 18px; }
      .hero-card { padding: 20px; }
      .hero-main { align-items: flex-start; }
      .doctor-avatar { width: 64px; height: 64px; border-radius: 18px; }
      .hero-status { width: 100%; min-width: 0; text-align: left; }
      .overview-grid, .performance-grid { grid-template-columns: 1fr; }
    }

    :host {
      margin-top: -12px;
    }

    .doctor-profile {
      gap: 8px;
      align-items: stretch;
    }

    .doctor-summary-card {
      position: relative;
      overflow: hidden;
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      border-color: color-mix(in srgb, var(--ac-primary) 14%, var(--ac-border));
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)) 0%, color-mix(in srgb, #0891b2 7%, var(--ac-surface)) 52%, var(--ac-surface) 100%);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
    }
    .doctor-summary-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: linear-gradient(90deg, var(--ac-primary), #0891b2, #10b981);
    }
    .doctor-summary-card .hero-card {
      min-height: 0;
      padding: 12px 12px 8px;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .doctor-summary-card .hero-card::before { display: none; }
    .doctor-summary-card .hero-main {
      flex: 1 1 auto;
      min-width: 0;
    }
    .doctor-summary-card .doctor-avatar {
      width: 52px;
      height: 52px;
      flex-basis: 52px;
      border-radius: 14px;
      font-size: 20px;
      outline: 4px solid color-mix(in srgb, var(--ac-surface) 72%, transparent);
      box-shadow: 0 10px 22px color-mix(in srgb, var(--ac-primary) 18%, transparent);
    }
    .doctor-summary-card .hero-main h1 {
      font-size: 23px;
    }
    .doctor-summary-card .hero-pills {
      margin-top: 7px;
    }
    .doctor-summary-card .hero-status {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      column-gap: 9px;
      row-gap: 2px;
      min-width: 210px;
      padding: 10px 12px;
      text-align: left;
    }
    .doctor-summary-card .hero-status .status-dot {
      grid-row: 1 / span 2;
    }
    .doctor-summary-card .hero-status strong {
      margin: 0;
      line-height: 1.1;
    }
    .summary-kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid color-mix(in srgb, var(--ac-border) 76%, transparent);
    }
    .summary-kpis .metric-card {
      min-height: 58px;
      padding: 9px 11px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 82%, var(--ac-surface));
      border-radius: 10px;
      background: color-mix(in srgb, var(--ac-surface) 82%, transparent);
      box-shadow: none;
    }
    .summary-kpis .metric-card::before { display: none; }
    .summary-kpis .metric-card .material-symbols-rounded {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--ac-primary) 7%, var(--ac-surface));
      font-size: 18px;
    }
    .summary-kpis .metric-card strong {
      font-size: 20px;
    }
    .summary-kpis .metric-card small {
      margin-top: 2px;
      display: block;
      font-size: 12px;
    }
    .overview-panel {
      position: relative;
      overflow: hidden;
      display: grid;
      gap: 12px;
    }
    .overview-panel::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--ac-primary), color-mix(in srgb, #0891b2 74%, var(--ac-primary)));
      opacity: 0.85;
    }
    .panel-title {
      display: flex;
      align-items: center;
      gap: 11px;
    }
    .panel-title .ac-eyebrow {
      margin: 0 0 2px;
      font-size: 10.5px;
    }
    .panel-title h2 {
      margin: 0;
    }
    .panel-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 11px;
      background: var(--ac-primary-light);
      color: var(--ac-primary);
      box-shadow: 0 10px 22px color-mix(in srgb, var(--ac-primary) 12%, transparent);
    }
    .workflow-icon {
      background: var(--ac-success-light);
      color: var(--ac-success);
    }
    .overview-detail-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .detail-tile {
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 4%, var(--ac-surface)), color-mix(in srgb, var(--ac-surface-2) 82%, var(--ac-surface)));
    }
    .detail-tile::after {
      content: '';
      position: absolute;
      inset: auto 10px 0;
      height: 2px;
      border-radius: 999px 999px 0 0;
      background: color-mix(in srgb, var(--ac-primary) 24%, transparent);
    }
    .detail-tile em {
      display: block;
      margin-top: 4px;
      color: var(--ac-muted);
      font-size: 11.5px;
      font-style: normal;
      font-weight: 750;
    }
    .activity-tracker {
      display: grid;
      gap: 14px;
    }
    .tracker-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 13px 14px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 14%, var(--ac-border));
      border-radius: 12px;
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 8%, var(--ac-surface)), color-mix(in srgb, #0891b2 5%, var(--ac-surface)));
    }
    .tracker-head h2 {
      margin: 2px 0 0;
      font-size: 18px;
    }
    .tracker-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      padding: 0 12px;
      border-radius: 999px;
      background: var(--ac-surface);
      color: var(--ac-primary);
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
    }
    .tracker-list {
      position: relative;
      display: grid;
      gap: 12px;
      padding-left: 0;
    }
    .tracker-list::before {
      content: '';
      position: absolute;
      top: 17px;
      bottom: 17px;
      left: 19px;
      width: 2px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--ac-primary), color-mix(in srgb, #0891b2 72%, var(--ac-primary)));
      opacity: 0.28;
    }
    .tracker-item {
      position: relative;
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 12px;
      padding: 0;
    }
    .tracker-marker {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: start center;
      padding-top: 5px;
    }
    .tracker-step {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: 4px solid color-mix(in srgb, var(--ac-surface) 84%, transparent);
      border-radius: 999px;
      background: linear-gradient(135deg, var(--ac-primary), #0891b2);
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      box-shadow: 0 10px 24px color-mix(in srgb, var(--ac-primary) 20%, transparent);
    }
    .tracker-card {
      min-width: 0;
      padding: 13px 14px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 84%, var(--ac-surface));
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-surface) 94%, var(--ac-subtle));
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
    }
    .tracker-card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .tracker-card strong {
      display: block;
      color: var(--ac-text);
      font-size: 15px;
    }
    .tracker-card p {
      margin: 4px 0 0;
      color: var(--ac-text-2);
      font-size: 13.5px;
    }
    .tracker-date {
      flex: 0 0 auto;
      padding: 6px 9px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ac-primary) 8%, var(--ac-surface));
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .tracker-meta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 800;
    }
    .tracker-meta .material-symbols-rounded {
      font-size: 16px;
      color: var(--ac-primary);
    }

    @media (max-width: 1020px) {
      .summary-kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 680px) {
      .doctor-summary-card {
        padding: 10px;
      }
      .doctor-summary-card .hero-card {
        padding: 10px;
      }
      .doctor-summary-card .hero-status {
        width: 100%;
        min-width: 0;
      }
      .summary-kpis,
      .overview-detail-grid {
        grid-template-columns: 1fr;
      }
      .tracker-head,
      .tracker-card-head {
        align-items: flex-start;
        flex-direction: column;
      }
      .tracker-date {
        white-space: normal;
      }
    }

    .doctor-profile {
      display: grid;
      grid-auto-rows: max-content;
      align-content: start;
      gap: 8px;
      min-width: 0;
    }
    .doctor-summary-card {
      overflow: visible;
    }
    .doctor-summary-card .hero-card {
      overflow: visible;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      min-height: auto;
      padding: 12px;
    }
    .doctor-summary-card .hero-main {
      min-width: 260px;
    }
    .doctor-summary-card .doctor-avatar {
      flex: 0 0 52px;
    }
    .doctor-summary-card .hero-main h1 {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .doctor-summary-card .hero-pills {
      min-width: 0;
      overflow: visible;
    }
    .doctor-summary-card .pill {
      max-width: 100%;
    }
    .doctor-summary-card .hero-status {
      margin-left: auto;
      min-width: 190px;
    }
    .tab-bar {
      display: flex;
      align-items: center;
      min-height: 54px;
      padding: 6px 6px 10px;
      gap: 6px;
      border-radius: 12px;
      overflow-x: scroll;
      overflow-y: hidden;
      scroll-snap-type: x proximity;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--ac-primary) 52%, var(--ac-border)) color-mix(in srgb, var(--ac-border) 42%, transparent);
      visibility: visible;
    }
    .tab-bar::-webkit-scrollbar {
      display: block;
      height: 8px;
    }
    .tab-bar::-webkit-scrollbar-track {
      border-radius: 999px;
      background: color-mix(in srgb, var(--ac-border) 38%, transparent);
    }
    .tab-bar::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: color-mix(in srgb, var(--ac-primary) 58%, var(--ac-border));
    }
    .tab-bar::-webkit-scrollbar-thumb:hover {
      background: var(--ac-primary);
    }
    .tab-bar button {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: max-content;
      min-height: 38px;
      padding: 0 11px;
      color: var(--ac-muted);
      background: transparent;
      opacity: 1;
      visibility: visible;
      scroll-snap-align: start;
    }
    .tab-bar button.active {
      color: var(--ac-primary);
      background: var(--ac-primary-light);
    }
    .tab-content {
      overflow: visible;
      min-height: 0;
      padding: 14px;
      border-radius: 12px;
    }
    .split-layout {
      gap: 14px;
    }
    .split-layout > article,
    .split-layout > section {
      padding: 16px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 84%, var(--ac-surface));
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-surface) 96%, var(--ac-subtle));
    }
    .stacked-section {
      gap: 14px;
    }
    .record-grid {
      gap: 10px;
    }
    .record-card {
      min-height: 70px;
      padding: 12px;
      border-radius: 10px;
    }
    .record-card > .material-symbols-rounded {
      width: 34px;
      height: 34px;
      border-radius: 9px;
      font-size: 19px;
    }
    .record-card h3 {
      font-size: 14px;
    }
    .record-card p {
      margin-top: 3px;
      font-size: 12.5px;
    }
    .availability-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .availability-actions .ac-btn {
      min-height: 36px;
      padding-inline: 11px;
    }
    .availability-actions .material-symbols-rounded {
      font-size: 18px;
    }
    .leave-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface-2);
    }
    .leave-form label {
      display: grid;
      gap: 6px;
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 800;
    }
    .leave-form input,
    .leave-form select,
    .leave-form textarea {
      width: 100%;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      color: var(--ac-text);
      padding: 10px 11px;
      font: inherit;
      outline: 0;
    }
    .leave-form textarea {
      resize: vertical;
    }
    .leave-form .span-2 {
      grid-column: 1 / -1;
    }
    .leave-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.44);
      backdrop-filter: blur(4px);
    }
    .availability-modal {
      width: min(760px, 100%);
      max-height: min(86vh, 760px);
      overflow: auto;
      border: 1px solid color-mix(in srgb, var(--ac-border) 78%, var(--ac-primary));
      border-radius: 18px;
      background: var(--ac-surface);
      box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
    }
    .availability-modal-head {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 14px;
      padding: 22px 24px;
      border-bottom: 1px solid var(--ac-border);
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 12%, var(--ac-surface)), color-mix(in srgb, #10b981 8%, var(--ac-surface)));
    }
    .availability-modal-head h2 {
      margin: 2px 0 0;
      font-size: 22px;
      line-height: 1.15;
    }
    .availability-modal-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      color: var(--ac-primary);
      background: color-mix(in srgb, var(--ac-primary) 12%, var(--ac-surface));
      box-shadow: 0 14px 28px rgba(37, 99, 235, 0.14);
    }
    .modal-close {
      width: 38px;
      height: 38px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: var(--ac-muted);
      background: color-mix(in srgb, var(--ac-surface) 88%, white);
      cursor: pointer;
    }
    .modal-close:hover {
      color: var(--ac-primary);
      border-color: color-mix(in srgb, var(--ac-primary) 28%, var(--ac-border));
      background: var(--ac-primary-light);
    }
    .availability-modal-body {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      padding: 22px 24px 10px;
    }
    .availability-modal-body label {
      display: grid;
      gap: 7px;
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 850;
    }
    .availability-modal-body input,
    .availability-modal-body select {
      width: 100%;
      min-height: 42px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      color: var(--ac-text);
      padding: 10px 12px;
      font: inherit;
      outline: 0;
    }
    .availability-modal-body input:focus,
    .availability-modal-body select:focus {
      border-color: color-mix(in srgb, var(--ac-primary) 58%, var(--ac-border));
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--ac-primary) 12%, transparent);
    }
    .availability-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px 22px;
    }
    .empty-state {
      grid-column: 1 / -1;
      display: grid;
      place-items: center;
      align-content: center;
      width: 100%;
      min-height: 120px;
      padding: 18px;
      border-radius: 10px;
      text-align: center;
    }

    .doctor-profile {
      --profile-accent: var(--ac-primary);
      --profile-accent-2: #0891b2;
      --profile-success: #10b981;
    }
    .tab-bar {
      position: relative;
      top: auto;
      isolation: isolate;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      min-height: 58px;
      padding: 8px 8px 12px;
      gap: 7px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 78%, var(--ac-surface));
      border-radius: 16px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--ac-surface) 96%, white), color-mix(in srgb, var(--ac-subtle) 62%, var(--ac-surface))),
        var(--ac-surface);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.72),
        0 14px 34px rgba(15, 23, 42, 0.06);
      overflow-x: scroll;
      overflow-y: hidden;
      scroll-padding-inline: 8px;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, #64748b 42%, var(--ac-border)) transparent;
    }
    .tab-bar::-webkit-scrollbar {
      display: block;
      height: 6px;
    }
    .tab-bar::-webkit-scrollbar-track {
      border-radius: 999px;
      background: transparent;
    }
    .tab-bar::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: color-mix(in srgb, #64748b 38%, var(--ac-border));
      border: 2px solid color-mix(in srgb, var(--ac-surface) 88%, transparent);
    }
    .tab-bar::-webkit-scrollbar-thumb:hover {
      background: color-mix(in srgb, #475569 52%, var(--ac-border));
    }
    .tab-bar::-webkit-scrollbar-button {
      display: none;
      width: 0;
      height: 0;
    }
    .tab-bar button {
      position: relative;
      flex: 0 0 auto;
      min-height: 42px;
      padding: 0 13px 0 10px;
      border: 1px solid transparent;
      border-radius: 13px;
      color: var(--ac-muted);
      font-size: 13.5px;
      font-weight: 850;
      background: transparent;
      transition: transform 0.18s ease, color 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .tab-bar button:hover {
      color: var(--ac-text);
      background: color-mix(in srgb, var(--ac-surface) 78%, var(--ac-subtle));
      border-color: color-mix(in srgb, var(--ac-border) 82%, var(--profile-accent));
      transform: translateY(-1px);
    }
    .tab-bar button .material-symbols-rounded {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--profile-accent) 8%, var(--ac-surface));
      color: color-mix(in srgb, var(--ac-muted) 72%, var(--profile-accent));
      font-size: 18px;
      transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }
    .tab-bar button.active {
      color: var(--profile-accent);
      background: linear-gradient(180deg, var(--ac-surface), color-mix(in srgb, var(--profile-accent) 7%, var(--ac-surface)));
      border-color: color-mix(in srgb, var(--profile-accent) 22%, var(--ac-border));
      box-shadow: 0 12px 28px color-mix(in srgb, var(--profile-accent) 16%, transparent);
    }
    .tab-bar button.active .material-symbols-rounded {
      color: #fff;
      background: linear-gradient(135deg, var(--profile-accent), var(--profile-accent-2));
      box-shadow: 0 8px 18px color-mix(in srgb, var(--profile-accent) 25%, transparent);
    }
    .tab-content {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding: 18px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 82%, var(--ac-surface));
      border-radius: 16px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--ac-surface) 98%, white), color-mix(in srgb, var(--ac-subtle) 34%, var(--ac-surface))),
        var(--ac-surface);
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.06);
    }
    .record-grid,
    .performance-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .record-card,
    .performance-grid > div,
    .detail-tile,
    .bio-card {
      position: relative;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--ac-border) 82%, var(--ac-surface));
      border-radius: 14px;
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--ac-surface) 96%, white), color-mix(in srgb, var(--profile-accent) 4%, var(--ac-surface))),
        var(--ac-surface);
      box-shadow: 0 10px 26px rgba(15, 23, 42, 0.045);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    }
    .record-card::before,
    .performance-grid > div::before,
    .detail-tile::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--profile-accent), var(--profile-accent-2), var(--profile-success));
      opacity: 0.76;
    }
    .record-card:hover,
    .performance-grid > div:hover,
    .detail-tile:hover {
      border-color: color-mix(in srgb, var(--profile-accent) 26%, var(--ac-border));
      box-shadow: 0 18px 38px rgba(15, 23, 42, 0.075);
      transform: translateY(-2px);
    }
    .record-card {
      min-height: 82px;
      padding: 16px;
      align-items: center;
    }
    .record-card > .material-symbols-rounded {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--profile-accent) 10%, var(--ac-surface));
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--profile-accent) 10%, transparent);
    }
    .record-card h3 {
      font-size: 15px;
      line-height: 1.25;
    }
    .record-card p {
      color: var(--ac-text-2);
      font-size: 13px;
    }
    .performance-grid > div {
      min-height: 112px;
      display: grid;
      align-content: center;
      gap: 6px;
      padding: 18px;
    }
    .performance-grid small {
      color: var(--ac-muted);
      font-size: 13px;
      font-weight: 850;
    }
    .performance-grid strong {
      color: var(--ac-text);
      font-size: 31px;
      line-height: 1;
      letter-spacing: 0;
    }
    .detail-tile {
      min-height: 96px;
      padding: 15px 16px;
    }
    .empty-state {
      min-height: 148px;
      border-radius: 14px;
      border-color: color-mix(in srgb, var(--profile-accent) 20%, var(--ac-border));
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--profile-accent) 6%, var(--ac-surface)), color-mix(in srgb, var(--profile-accent-2) 5%, var(--ac-surface)));
      color: var(--ac-text-2);
      font-weight: 750;
    }

    @media (max-width: 680px) {
      .doctor-summary-card .hero-main {
        min-width: 0;
        width: 100%;
      }
      .doctor-summary-card .hero-status {
        width: 100%;
        min-width: 0;
        margin-left: 0;
      }
      .tab-content {
        padding: 12px;
      }
      .modal-backdrop {
        align-items: end;
        padding: 14px;
      }
      .availability-modal {
        max-height: 92vh;
        border-radius: 16px;
      }
      .availability-modal-head,
      .availability-modal-body {
        grid-template-columns: 1fr;
      }
      .availability-modal-head {
        padding: 18px;
      }
      .modal-close {
        position: absolute;
        top: 14px;
        right: 14px;
      }
      .availability-modal-body {
        padding: 18px 18px 8px;
      }
      .availability-modal-actions {
        flex-direction: column-reverse;
        padding: 14px 18px 18px;
      }
      .availability-modal-actions .ac-btn {
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DoctorProfilePageComponent implements OnInit {
  protected readonly doctor = signal<DoctorProfile | null>(null);
  protected readonly loading = signal(false);
  protected readonly activeTab = signal<DoctorProfileTab>('overview');
  protected readonly availabilityForm = signal<DoctorAvailabilityForm | null>(null);
  protected readonly leaveForm = signal<DoctorLeaveForm | null>(null);
  protected readonly availabilityDayOptions: DropdownOption<number>[] = [
    { label: 'Monday', value: 1 },
    { label: 'Tuesday', value: 2 },
    { label: 'Wednesday', value: 3 },
    { label: 'Thursday', value: 4 },
    { label: 'Friday', value: 5 },
    { label: 'Saturday', value: 6 },
    { label: 'Sunday', value: 0 }
  ];
  protected readonly consultationTypeOptions: DropdownOption<string>[] = [
    { label: 'OPD', value: 'OPD' },
    { label: 'Follow-up', value: 'FOLLOW_UP' },
    { label: 'Teleconsult', value: 'TELECONSULT' },
    { label: 'IPD round', value: 'IPD_ROUND' }
  ];
  protected readonly tabs: Array<{ id: DoctorProfileTab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'professional', label: 'Professional', icon: 'workspace_premium' },
    { id: 'availability', label: 'Availability', icon: 'calendar_clock' },
    { id: 'schedule', label: 'Schedule', icon: 'event_available' },
    { id: 'fees', label: 'Fees', icon: 'payments' },
    { id: 'credentials', label: 'Credentials', icon: 'verified' },
    { id: 'appointments', label: 'Appointments', icon: 'event' },
    { id: 'opd-patients', label: 'OPD Patients', icon: 'stethoscope' },
    { id: 'ipd-patients', label: 'IPD Patients', icon: 'bed' },
    { id: 'performance', label: 'Performance', icon: 'monitoring' },
    { id: 'activity', label: 'Activity', icon: 'timeline' }
  ];

  protected readonly overviewCards = computed(() => {
    const overview = this.doctor()?.overview;
    return [
      { label: 'Appointments', value: formatNumber(overview?.totalAppointments ?? 0), icon: 'event', color: '#2563EB' },
      { label: 'Upcoming', value: formatNumber(overview?.upcomingAppointments ?? 0), icon: 'event_upcoming', color: '#0891B2' },
      { label: 'Active Patients', value: formatNumber(overview?.activePatients ?? 0), icon: 'groups', color: '#10B981' },
      { label: 'Revenue', value: this.currency(overview?.revenue ?? 0), icon: 'payments', color: '#7C3AED' }
    ];
  });

  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(DoctorManagementService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  ngOnInit(): void {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const doctorGuid = this.route.snapshot.paramMap.get('doctorGuid');
    if (!doctorGuid) {
      this.doctor.set(null);
      return;
    }

    this.loading.set(true);
    const response = await this.service.get(doctorGuid);
    this.loading.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to load doctor profile', getApiErrorMessage(response, 'Doctor API failed'));
      this.doctor.set(null);
      return;
    }

    this.doctor.set(response.data);
  }

  protected initials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return `${parts[0]?.charAt(0) ?? 'D'}${parts.at(-1)?.charAt(0) ?? 'R'}`.toUpperCase();
  }

  protected avatarColor(doctorGuid: string): string {
    const colors = ['#2563EB', '#0891B2', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];
    const sum = [...doctorGuid].reduce((total, char) => total + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  }

  protected currency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  protected formatDateTime(value: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  protected formatTime(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  protected openAvailabilityForm(doctor: DoctorProfile, statusCode: 'ACTIVE' | 'OVERRIDE'): void {
    this.leaveForm.set(null);
    this.availabilityForm.set({
      doctorGuid: doctor.doctorGuid,
      dayOfWeek: 1,
      startsAt: statusCode === 'OVERRIDE' ? '16:00' : '09:00',
      endsAt: statusCode === 'OVERRIDE' ? '20:00' : '13:00',
      branchName: doctor.branchName,
      consultationType: 'OPD',
      slotDurationMinutes: 15,
      maxPatients: 1,
      statusCode
    });
  }

  protected cancelAvailabilityForm(): void {
    this.availabilityForm.set(null);
  }

  protected async saveAvailability(doctor: DoctorProfile): Promise<void> {
    const form = this.availabilityForm();
    if (!form || !Number.isInteger(Number(form.dayOfWeek)) || !form.startsAt || !form.endsAt || !form.branchName.trim()) {
      return;
    }

    if (form.endsAt <= form.startsAt) {
      this.toast.warning('Invalid schedule time', 'End time must be after the start time.');
      return;
    }

    const slotDurationMinutes = Math.max(5, Number(form.slotDurationMinutes) || 15);
    const maxPatients = Math.max(1, Number(form.maxPatients) || 1);
    const response = await this.service.createAvailability({
      doctorId: doctor.doctorGuid,
      dayOfWeek: Number(form.dayOfWeek),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      branchName: form.branchName.trim(),
      consultationType: form.consultationType,
      slotDurationMinutes,
      maxPatients,
      statusCode: form.statusCode
    });
    if (!response.success || !response.data) {
      this.toast.error('Unable to save availability', getApiErrorMessage(response, 'Doctor availability API failed'));
      return;
    }

    const availability = mapAvailabilityRecord(response.data);
    this.updateDoctor(current => ({
      ...current,
      availability: upsertBy(current.availability, availability, item => item.availabilityGuid)
    }));
    this.availabilityForm.set(null);
    this.toast.success(form.statusCode === 'OVERRIDE' ? 'Availability override added' : 'Schedule added');
  }

  protected async blockDate(doctor: DoctorProfile): Promise<void> {
    const scheduleDate = await this.dialog.prompt({
      title: 'Block Doctor Date',
      message: `Prevent appointment booking for ${doctor.fullName} on a specific date.`,
      label: 'Date to block',
      inputType: 'date',
      value: new Date().toISOString().slice(0, 10),
      required: true,
      confirmText: 'Block Date',
      cancelText: 'Cancel',
      icon: 'event_busy',
      intent: 'warning'
    });
    if (!scheduleDate) {
      return;
    }

    const response = await this.service.createSchedule({
      doctorId: doctor.doctorGuid,
      scheduleDate,
      startsAt: null,
      endsAt: null,
      scheduleType: 'BLOCK',
      consultationType: 'OPD',
      roomName: null,
      branchName: doctor.branchName,
      departmentName: doctor.departmentName,
      statusCode: 'BLOCKED'
    });
    if (!response.success || !response.data) {
      this.toast.error('Unable to block date', getApiErrorMessage(response, 'Doctor schedule API failed'));
      return;
    }

    const schedule = mapScheduleRecord(response.data);
    this.updateDoctor(current => ({
      ...current,
      schedules: upsertBy(current.schedules, schedule, item => item.scheduleGuid)
    }));
    this.toast.success('Date blocked');
  }

  protected openLeaveForm(doctor: DoctorProfile): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    this.availabilityForm.set(null);
    this.leaveForm.set({
      doctorGuid: doctor.doctorGuid,
      startsAt: toLocalInputValue(now),
      endsAt: toLocalInputValue(tomorrow),
      reason: '',
      statusCode: 'APPROVED'
    });
  }

  protected cancelLeaveForm(): void {
    this.leaveForm.set(null);
  }

  protected async saveLeave(doctor: DoctorProfile): Promise<void> {
    const form = this.leaveForm();
    if (!form || !form.startsAt || !form.endsAt) {
      return;
    }

    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      this.toast.warning('Invalid leave dates', 'Leave end date must be after the start date.');
      return;
    }

    const response = await this.service.createLeave({
      doctorId: doctor.doctorGuid,
      leaveType: 'LEAVE',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: form.reason.trim(),
      statusCode: form.statusCode
    });
    if (!response.success || !response.data) {
      this.toast.error('Unable to save leave', getApiErrorMessage(response, 'Doctor leave API failed'));
      return;
    }

    const leave = mapLeaveRecord(response.data);
    this.updateDoctor(current => ({
      ...current,
      leaves: upsertBy(current.leaves, leave, item => item.leaveGuid)
    }));
    this.leaveForm.set(null);
    this.toast.success('Leave added');
  }

  private updateDoctor(updater: (doctor: DoctorProfile) => DoctorProfile): void {
    this.doctor.update(current => current ? updater(current) : current);
  }
}

interface DoctorAvailabilityForm {
  doctorGuid: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  branchName: string;
  consultationType: string;
  slotDurationMinutes: number;
  maxPatients: number;
  statusCode: 'ACTIVE' | 'OVERRIDE';
}

interface DoctorLeaveForm {
  doctorGuid: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  statusCode: string;
}

function toLocalInputValue(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function mapAvailabilityRecord(record: { id: string; dayOfWeek: number; startsAt: string; endsAt: string; branchName: string; consultationType: string; slotDurationMinutes: number; maxPatients: number; statusCode: string }): DoctorAvailability {
  return {
    availabilityGuid: record.id,
    dayOfWeek: Number(record.dayOfWeek),
    dayName: dayName(Number(record.dayOfWeek)),
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    branchName: record.branchName,
    consultationType: record.consultationType,
    slotDurationMinutes: Number(record.slotDurationMinutes) || 15,
    maxPatients: Number(record.maxPatients) || 1,
    statusCode: record.statusCode
  };
}

function mapScheduleRecord(record: { id: string; scheduleDate: string; startsAt: string | null; endsAt: string | null; scheduleType: string; consultationType: string; roomName: string | null; statusCode: string }): DoctorSchedule {
  return {
    scheduleGuid: record.id,
    scheduleDate: record.scheduleDate,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    scheduleType: record.scheduleType,
    consultationType: record.consultationType,
    roomName: record.roomName ?? '',
    statusCode: record.statusCode
  };
}

function mapLeaveRecord(record: { id: string; leaveType: string; startsAt: string; endsAt: string; reason: string; statusCode: string }): DoctorLeave {
  return {
    leaveGuid: record.id,
    leaveType: record.leaveType,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    reason: record.reason,
    statusCode: record.statusCode
  };
}

function upsertBy<T>(items: T[], nextItem: T, getId: (item: T) => string): T[] {
  const id = getId(nextItem);
  const exists = items.some(item => getId(item) === id);
  return exists
    ? items.map(item => getId(item) === id ? nextItem : item)
    : [nextItem, ...items];
}

function dayName(dayOfWeek: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek] ?? 'Scheduled day';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}
