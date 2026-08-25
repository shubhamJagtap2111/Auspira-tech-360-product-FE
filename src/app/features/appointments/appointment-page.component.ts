import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BranchContextService } from '../../core/context/branch-context.service';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcAdminDrawerComponent } from '../../shared/ui/admin-drawer/admin-drawer.component';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DoctorProfile, DoctorSummary } from '../doctors/doctor-management.models';
import { DoctorManagementService } from '../doctors/doctor-management.service';
import { PatientSummary } from '../patients/patient-management.models';
import { PatientManagementService } from '../patients/patient-management.service';
import {
  AppointmentCheckInForm,
  AppointmentForm,
  AppointmentQueueRecord,
  AppointmentRecord,
  AppointmentStats,
  AppointmentStatusCode,
  AppointmentViewMode,
  AppointmentVm,
  appointmentPriorityOptions,
  appointmentTypeOptions,
  appointmentStatusOptions,
  editableAppointmentStatusOptions
} from './appointment-management.models';
import { AppointmentManagementService } from './appointment-management.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcGridLoaderComponent, AcAdminDrawerComponent],
  template: `
    <section class="appointment-page">
      <header class="page-header">
        <div>
          <p class="ac-eyebrow">Clinical workflow</p>
          <h1 class="ac-page-title">Appointment Management</h1>
          <p class="page-desc">Bridge patients and doctors through scheduled care, walk-ins, check-in, and OPD handoff.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary" type="button" (click)="setToday()">
            <span class="material-symbols-rounded">today</span>
            Today
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="openCreate()">
            <span class="material-symbols-rounded">event_available</span>
            Create Appointment
          </button>
        </div>
      </header>

      <div class="stats-row">
        @for (card of statCards(); track card.label) {
          <article class="stat-card ac-card">
            <span class="stat-icon material-symbols-rounded" [style.background]="card.bg" [style.color]="card.color">{{ card.icon }}</span>
            <div>
              <p class="stat-value">{{ card.value }}</p>
              <p class="stat-label">{{ card.label }}</p>
            </div>
          </article>
        }
      </div>

      <section class="appointment-shell ac-card">
        <div class="workspace-toolbar">
          <div class="mode-tabs" aria-label="Appointment views">
            <button type="button" [class.active]="viewMode() === 'calendar'" (click)="viewMode.set('calendar')">
              <span class="material-symbols-rounded">calendar_month</span>
              Calendar
            </button>
            <button type="button" [class.active]="viewMode() === 'list'" (click)="viewMode.set('list')">
              <span class="material-symbols-rounded">view_list</span>
              List
            </button>
          </div>

          <div class="toolbar-filters">
            <div class="search-field">
              <span class="material-symbols-rounded">search</span>
              <input type="text" name="appointmentSearch" [(ngModel)]="searchQuery" placeholder="Search patient, MRN, doctor, reason..." />
            </div>
            <ac-dropdown name="patientFilter" [(ngModel)]="patientFilter" [options]="patientFilterOptions()" />
            <ac-dropdown name="branchFilter" [(ngModel)]="branchFilter" [options]="branchFilterOptions()" />
            <ac-dropdown name="departmentFilter" [(ngModel)]="departmentFilter" [options]="departmentFilterOptions()" />
            <ac-dropdown name="doctorFilter" [(ngModel)]="doctorFilter" [options]="doctorFilterOptions()" />
            <ac-dropdown name="statusFilter" [(ngModel)]="statusFilter" [options]="statusOptions" />
            <button class="icon-btn" type="button" title="Refresh" (click)="reload()">
              <span class="material-symbols-rounded">refresh</span>
            </button>
          </div>
        </div>

        @if (initialLoading()) {
          <ac-grid-loader title="Loading appointments..." message="Preparing patient and doctor links for the calendar." />
        } @else {
          @if (viewMode() === 'calendar') {
            <section class="calendar-view">
              <div class="calendar-head">
                <button class="icon-btn" type="button" title="Previous week" (click)="moveCalendar(-7)">
                  <span class="material-symbols-rounded">chevron_left</span>
                </button>
                <label class="date-control">
                  <span class="material-symbols-rounded">event</span>
                  <input type="date" name="calendarDate" [(ngModel)]="calendarDate" />
                </label>
                <button class="icon-btn" type="button" title="Next week" (click)="moveCalendar(7)">
                  <span class="material-symbols-rounded">chevron_right</span>
                </button>
                <div class="calendar-range">{{ calendarRangeLabel() }}</div>
              </div>

              <div class="calendar-grid">
                @for (day of calendarDays(); track day.dateKey) {
                  <article class="day-column" [class.today]="day.isToday">
                    <header>
                      <span>{{ day.weekday }}</span>
                      <strong>{{ day.dayNo }}</strong>
                    </header>
                    <div class="day-appointments">
                      @for (appointment of day.appointments; track appointment.id) {
                        <button class="appointment-chip" type="button" [class]="statusClass(appointment.statusCode)" (click)="selectAppointment(appointment)">
                          <small>{{ formatTime(appointment.startsAt) }}</small>
                          <strong>{{ appointment.patientName }}</strong>
                          <span>{{ appointment.doctorName }}</span>
                        </button>
                      } @empty {
                        <div class="day-empty">No appointments</div>
                      }
                    </div>
                  </article>
                }
              </div>
            </section>
          } @else {
            <section class="list-view">
              @if (filteredAppointments().length > 0) {
                <div class="appointment-table-scroll">
                  <table class="appointment-table">
                    <thead>
                      <tr>
                        <th>Appointment Number</th>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Department</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (appointment of filteredAppointments(); track appointment.id) {
                        <tr [class.selected]="selectedAppointment()?.id === appointment.id">
                          <td><button class="link-cell" type="button" (click)="selectAppointment(appointment)">{{ appointment.displayAppointmentNo }}</button></td>
                          <td>
                            <strong>{{ appointment.patientName }}</strong>
                            <small>{{ appointment.patientMrn }}</small>
                          </td>
                          <td>
                            <strong>{{ appointment.doctorName }}</strong>
                            <small>{{ appointment.doctorSpecialization }}</small>
                          </td>
                          <td>{{ appointment.doctorDepartment }}</td>
                          <td>{{ dateOnly(appointment.startsAt) }}</td>
                          <td>{{ formatTime(appointment.startsAt) }}</td>
                          <td>{{ appointment.displayAppointmentType }}</td>
                          <td><span class="status-badge" [class]="statusClass(appointment.statusCode)">{{ statusLabel(appointment.statusCode) }}</span></td>
                          <td>
                            <div class="row-actions">
                              <button class="tbl-btn" type="button" title="Details" (click)="selectAppointment(appointment)">
                                <span class="material-symbols-rounded">visibility</span>
                              </button>
                              <button class="tbl-btn" type="button" title="Check-In" [disabled]="!canCheckIn(appointment)" (click)="openCheckIn(appointment)">
                                <span class="material-symbols-rounded">how_to_reg</span>
                              </button>
                              <button class="tbl-btn" type="button" title="Edit" (click)="openEdit(appointment)">
                                <span class="material-symbols-rounded">edit</span>
                              </button>
                              <button class="tbl-btn danger" type="button" title="Cancel" [disabled]="appointment.statusCode === 'CANCELLED'" (click)="cancelAppointment(appointment)">
                                <span class="material-symbols-rounded">event_busy</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="empty-state">
                  <span class="empty-icon material-symbols-rounded">event_busy</span>
                  <h3>No appointments found</h3>
                  <p>Create an appointment or adjust filters to view scheduled care.</p>
                  <button class="ac-btn ac-btn-primary" type="button" (click)="openCreate()">
                    <span class="material-symbols-rounded">event_available</span>
                    Create Appointment
                  </button>
                </div>
              }
            </section>
          }

          @if (selectedAppointment(); as appointment) {
            <aside class="details-panel">
              <div class="details-head">
                <div>
                  <p class="ac-eyebrow">Appointment details</p>
                  <h2>{{ appointment.patientName }}</h2>
                </div>
                <button class="icon-btn" type="button" title="Close details" (click)="selectedAppointment.set(null)">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>
              <div class="details-grid">
                <span><small>MRN</small><strong>{{ appointment.patientMrn }}</strong></span>
                <span><small>Doctor</small><strong>{{ appointment.doctorName }}</strong></span>
                <span><small>Date & time</small><strong>{{ formatDateTime(appointment.startsAt) }}</strong></span>
                <span><small>Status</small><strong>{{ statusLabel(appointment.statusCode) }}</strong></span>
                <span><small>Token Number</small><strong>{{ appointment.displayTokenNumber }}</strong></span>
                <span><small>Queue Priority</small><strong>{{ appointment.displayPriority }}</strong></span>
                <span><small>Type</small><strong>{{ appointment.displayAppointmentType }}</strong></span>
                <span><small>Branch</small><strong>{{ appointment.branchName }}</strong></span>
                <span><small>Department</small><strong>{{ appointment.doctorDepartment }}</strong></span>
                <span><small>Specialization</small><strong>{{ appointment.doctorSpecialization }}</strong></span>
                @if (appointment.queue) {
                  <span><small>Arrival Time</small><strong>{{ formatDateTime(appointment.queue.arrivedAt) }}</strong></span>
                  <span><small>Doctor Queue</small><strong>#{{ appointment.queue.queueNo }} · {{ appointment.queue.statusCode }}</strong></span>
                }
                <span class="span-2"><small>Reason</small><strong>{{ appointment.reason || '-' }}</strong></span>
                @if (appointment.queue?.notes) {
                  <span class="span-2"><small>Check-In Notes</small><strong>{{ appointment.queue?.notes }}</strong></span>
                }
                <span class="span-2"><small>Notes</small><strong>{{ appointment.notes || '-' }}</strong></span>
              </div>
              <div class="details-actions">
                <button class="ac-btn ac-btn-primary" type="button" [disabled]="!canCheckIn(appointment)" (click)="openCheckIn(appointment)">
                  <span class="material-symbols-rounded">how_to_reg</span>
                  Check-In
                </button>
                <button class="ac-btn ac-btn-secondary" type="button" (click)="openEdit(appointment)">
                  <span class="material-symbols-rounded">edit</span>
                  Edit
                </button>
                <button class="ac-btn ac-btn-secondary" type="button" (click)="startOpd(appointment)">
                  <span class="material-symbols-rounded">clinical_notes</span>
                  Start OPD
                </button>
              </div>
            </aside>
          }
        }
      </section>

      @if (drawerOpen()) {
        <ac-admin-drawer
          [open]="drawerOpen()"
          icon="event_available"
          [eyebrow]="form().appointmentId ? 'Edit appointment' : 'Create appointment'"
          [title]="drawerTitle()"
          (closed)="closeDrawer()">
          <span drawer-summary class="ac-admin-pill">
            <span class="material-symbols-rounded">link</span>
            Patient ↔ Doctor
          </span>
          <span drawer-summary class="ac-admin-pill">
            <span class="material-symbols-rounded">event</span>
            {{ form().appointmentDate || 'Date pending' }}
          </span>

          <div drawer-body class="drawer-form">
            <section class="form-section">
              <div class="section-title">
                <span class="material-symbols-rounded">account_tree</span>
                <h3>Care linkage</h3>
              </div>
              <div class="form-grid">
                <label>
                  <span>Patient *</span>
                  <ac-dropdown name="formPatient" [(ngModel)]="form().patientId" [options]="patientOptions()" />
                </label>
                <label>
                  <span>Branch *</span>
                  <ac-dropdown name="formBranch" [(ngModel)]="form().branchName" [options]="branchOptions()" (ngModelChange)="onBranchChanged($event)" />
                </label>
                <label>
                  <span>Department *</span>
                  <ac-dropdown name="formDepartment" [(ngModel)]="form().departmentName" [options]="formDepartmentOptions()" (ngModelChange)="onDepartmentChanged($event)" />
                </label>
                <label>
                  <span>Doctor *</span>
                  <ac-dropdown name="formDoctor" [(ngModel)]="form().doctorId" [options]="formDoctorOptions()" (ngModelChange)="onDoctorChanged($event)" />
                </label>
                <label>
                  <span>Date *</span>
                  <input type="date" name="appointmentDate" [(ngModel)]="form().appointmentDate" (ngModelChange)="onAppointmentDateChanged()" />
                </label>
                <label>
                  <span>Time Slot *</span>
                  <input type="time" name="appointmentTime" [(ngModel)]="form().appointmentTime" />
                </label>
                <label>
                  <span>Appointment Type</span>
                  <ac-dropdown name="formAppointmentType" [(ngModel)]="form().appointmentType" [options]="typeOptions" />
                </label>
                <label>
                  <span>Status</span>
                  <ac-dropdown name="formStatus" [(ngModel)]="form().statusCode" [options]="editableStatusOptions" />
                </label>
                <div class="slot-picker span-2">
                  <div>
                    <span>Available Slots</span>
                    <small>{{ slotHelperText() }}</small>
                  </div>
                  <div class="slot-grid">
                    @for (slot of availableSlots(); track slot.value) {
                      <button type="button" [class.selected]="form().appointmentTime === slot.value" [disabled]="slot.booked" (click)="selectSlot(slot.value)">
                        {{ slot.label }}
                        @if (slot.booked) {
                          <small>Booked</small>
                        }
                      </button>
                    } @empty {
                      <p>No available slots found for this doctor and date.</p>
                    }
                  </div>
                </div>
                <label class="span-2">
                  <span>Reason for Visit</span>
                  <textarea name="appointmentReason" rows="3" [(ngModel)]="form().reason" placeholder="Example: fever follow-up, routine consultation, report review"></textarea>
                </label>
                <label class="span-2">
                  <span>Notes</span>
                  <textarea name="appointmentNotes" rows="3" [(ngModel)]="form().notes" placeholder="Internal scheduling notes"></textarea>
                </label>
              </div>
            </section>
          </div>

          <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeDrawer()">Cancel</button>
          <button drawer-actions class="ac-btn ac-btn-primary" type="button" [disabled]="saving() || !canSave()" (click)="save()">
            <span class="material-symbols-rounded">save</span>
            {{ saving() ? 'Saving...' : 'Save Appointment' }}
          </button>
        </ac-admin-drawer>
      }

      @if (checkInDrawerOpen() && checkInAppointment(); as appointment) {
        <ac-admin-drawer
          [open]="checkInDrawerOpen()"
          icon="how_to_reg"
          eyebrow="Check-In Patient"
          [title]="appointment.patientName"
          (closed)="closeCheckInDrawer()">
          <span drawer-summary class="ac-admin-pill">
            <span class="material-symbols-rounded">confirmation_number</span>
            {{ checkInForm().tokenNumber || 'Token pending' }}
          </span>
          <span drawer-summary class="ac-admin-pill">
            <span class="material-symbols-rounded">stethoscope</span>
            {{ appointment.doctorName }}
          </span>

          <div drawer-body class="drawer-form">
            <section class="form-section checkin-section">
              <div class="section-title">
                <span class="material-symbols-rounded">queue</span>
                <h3>Doctor queue</h3>
              </div>

              <div class="checkin-flow">
                <span>Appointment</span>
                <span class="material-symbols-rounded">arrow_forward</span>
                <span>Check-In</span>
                <span class="material-symbols-rounded">arrow_forward</span>
                <span>Generate Token</span>
                <span class="material-symbols-rounded">arrow_forward</span>
                <span>Doctor Queue</span>
              </div>

              <div class="queue-ticket">
                <div>
                  <small>Token Number</small>
                  <strong>{{ checkInForm().tokenNumber }}</strong>
                </div>
                <div>
                  <small>Queue No</small>
                  <strong>#{{ checkInForm().queueNo }}</strong>
                </div>
              </div>

              <div class="form-grid">
                <label>
                  <span>Arrival Date *</span>
                  <input type="date" name="arrivalDate" [(ngModel)]="checkInForm().arrivalDate" />
                </label>
                <label>
                  <span>Arrival Time *</span>
                  <input type="time" name="arrivalTime" [(ngModel)]="checkInForm().arrivalTime" />
                </label>
                <label>
                  <span>Token Number *</span>
                  <input type="text" name="tokenNumber" [(ngModel)]="checkInForm().tokenNumber" />
                </label>
                <label>
                  <span>Priority</span>
                  <ac-dropdown name="priorityCode" [(ngModel)]="checkInForm().priorityCode" [options]="priorityOptions" />
                </label>
                <label class="span-2">
                  <span>Notes</span>
                  <textarea name="checkInNotes" rows="3" [(ngModel)]="checkInForm().notes" placeholder="Reception notes, mobility support, fast-track reason"></textarea>
                </label>
              </div>
            </section>
          </div>

          <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeCheckInDrawer()">Cancel</button>
          <button drawer-actions class="ac-btn ac-btn-primary" type="button" [disabled]="checkingIn() || !canSubmitCheckIn()" (click)="saveCheckIn()">
            <span class="material-symbols-rounded">queue</span>
            {{ checkingIn() ? 'Adding...' : 'Add to Doctor Queue' }}
          </button>
        </ac-admin-drawer>
      }
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; height: 100%; }
    .appointment-page { display: grid; gap: 14px; min-width: 0; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .page-desc { margin: 6px 0 0; max-width: 740px; color: var(--ac-muted); }
    .header-actions { display: flex; gap: 10px; align-items: center; }
    .stats-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    .stat-card { min-height: 74px; display: flex; align-items: center; gap: 12px; padding: 13px 16px; }
    .stat-icon { width: 38px; height: 38px; border-radius: 9px; display: grid; place-items: center; font-size: 21px; }
    .stat-value { margin: 0; color: var(--ac-text); font-size: 22px; line-height: 1; font-weight: 900; }
    .stat-label { margin: 4px 0 0; color: var(--ac-muted); font-size: 12.5px; }
    .appointment-shell { display: grid; gap: 14px; padding: 14px; overflow: visible; }
    .workspace-toolbar { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; }
    .mode-tabs { display: inline-flex; gap: 6px; padding: 5px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-subtle); }
    .mode-tabs button { min-height: 38px; display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 9px; padding: 0 12px; background: transparent; color: var(--ac-muted); font: inherit; font-weight: 850; cursor: pointer; }
    .mode-tabs button.active { background: var(--ac-surface); color: var(--ac-primary); box-shadow: 0 8px 20px rgba(15, 23, 42, .08); }
    .mode-tabs .material-symbols-rounded { font-size: 20px; }
    .toolbar-filters { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(140px, .55fr) minmax(140px, .55fr) minmax(150px, .6fr) minmax(160px, .65fr) minmax(140px, .55fr) 40px; gap: 8px; align-items: center; min-width: 0; }
    .search-field, .date-control { min-width: 0; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 10px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-muted); }
    .search-field input, .date-control input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ac-text); font: inherit; font-weight: 700; }
    .icon-btn, .tbl-btn { border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-muted); cursor: pointer; border-radius: 8px; display: inline-grid; place-items: center; }
    .icon-btn { width: 40px; height: 40px; }
    .tbl-btn { width: 31px; height: 31px; }
    .icon-btn:hover, .tbl-btn:hover { color: var(--ac-primary); border-color: color-mix(in srgb, var(--ac-primary) 36%, var(--ac-border)); }
    .tbl-btn.danger:hover { color: #dc2626; border-color: #fca5a5; }
    .tbl-btn:disabled, .ac-btn:disabled { opacity: .48; cursor: not-allowed; }
    .empty-state { min-height: 280px; display: grid; place-items: center; align-content: center; gap: 10px; padding: 34px 24px; text-align: center; color: var(--ac-muted); }
    .empty-state h3 { margin: 0; color: var(--ac-text); font-size: 17px; }
    .empty-state p { margin: 0; max-width: 420px; }
    .empty-icon { width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; background: color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)); color: var(--ac-primary); font-size: 34px; }
    .calendar-view, .list-view { min-width: 0; }
    .calendar-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .calendar-range { margin-left: auto; color: var(--ac-muted); font-weight: 800; font-size: 13px; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(150px, 1fr)); gap: 10px; overflow-x: auto; padding-bottom: 4px; }
    .day-column { min-height: 270px; border: 1px solid var(--ac-border); border-radius: 10px; background: color-mix(in srgb, var(--ac-surface) 86%, transparent); overflow: hidden; }
    .day-column.today { border-color: color-mix(in srgb, var(--ac-primary) 40%, var(--ac-border)); box-shadow: inset 0 3px 0 var(--ac-primary); }
    .day-column header { display: flex; justify-content: space-between; align-items: center; padding: 11px 12px; border-bottom: 1px solid var(--ac-border); background: var(--ac-subtle); }
    .day-column header span { color: var(--ac-muted); font-size: 12px; font-weight: 850; text-transform: uppercase; }
    .day-column header strong { color: var(--ac-text); font-size: 18px; }
    .day-appointments { display: grid; gap: 8px; padding: 10px; }
    .appointment-chip { width: 100%; min-width: 0; display: grid; gap: 3px; padding: 10px; border: 1px solid var(--ac-border); border-left-width: 4px; border-radius: 8px; background: var(--ac-surface); text-align: left; cursor: pointer; color: var(--ac-text); }
    .appointment-chip small { color: var(--ac-muted); font-weight: 900; }
    .appointment-chip strong { overflow-wrap: anywhere; }
    .appointment-chip span { color: var(--ac-muted); font-size: 12px; overflow-wrap: anywhere; }
    .day-empty { min-height: 74px; display: grid; place-items: center; border: 1px dashed var(--ac-border); border-radius: 8px; color: var(--ac-muted); font-size: 12.5px; }
    .appointment-list { display: grid; gap: 9px; }
    .appointment-table-scroll { overflow-x: auto; border: 1px solid var(--ac-border); border-radius: 10px; }
    .appointment-table { width: 100%; min-width: 1180px; border-collapse: collapse; }
    .appointment-table th, .appointment-table td { padding: 11px 13px; border-bottom: 1px solid var(--ac-border); text-align: left; vertical-align: middle; }
    .appointment-table th { background: var(--ac-subtle); color: var(--ac-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .045em; }
    .appointment-table tr:last-child td { border-bottom: 0; }
    .appointment-table tr.selected td { background: color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)); }
    .appointment-table td strong { display: block; color: var(--ac-text); font-size: 13px; }
    .appointment-table td small { display: block; margin-top: 3px; color: var(--ac-muted); font-size: 11.5px; }
    .link-cell { border: 0; background: transparent; color: var(--ac-primary); font: inherit; font-weight: 900; cursor: pointer; padding: 0; }
    .link-cell:hover { text-decoration: underline; }
    .appointment-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); }
    .appointment-row.selected { border-color: color-mix(in srgb, var(--ac-primary) 42%, var(--ac-border)); box-shadow: 0 12px 28px color-mix(in srgb, var(--ac-primary) 10%, transparent); }
    .row-main { min-width: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; align-items: center; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
    .date-box { width: 52px; height: 52px; display: grid; place-items: center; align-content: center; border-radius: 10px; background: var(--ac-subtle); color: var(--ac-primary); }
    .date-box strong { line-height: 1; font-size: 20px; }
    .date-box small { font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .row-copy { min-width: 0; display: grid; gap: 4px; }
    .row-copy strong { color: var(--ac-text); font-size: 14px; overflow-wrap: anywhere; }
    .row-copy small { color: var(--ac-muted); overflow-wrap: anywhere; }
    .row-actions, .details-actions { display: flex; align-items: center; gap: 7px; }
    .status-badge { display: inline-flex; align-items: center; justify-content: center; min-height: 25px; border-radius: 999px; padding: 4px 10px; font-size: 11.5px; font-weight: 900; white-space: nowrap; background: var(--ac-subtle); color: var(--ac-muted); }
    .status-scheduled { border-left-color: #2563eb; color: #1d4ed8; background: #eff6ff; }
    .status-confirmed { border-left-color: #7c3aed; color: #6d28d9; background: #f5f3ff; }
    .status-checked-in { border-left-color: #0891b2; color: #0e7490; background: #ecfeff; }
    .status-waiting { border-left-color: #f59e0b; color: #b45309; background: #fffbeb; }
    .status-in-consultation { border-left-color: #14b8a6; color: #0f766e; background: #f0fdfa; }
    .status-completed { border-left-color: #10b981; color: #047857; background: #ecfdf5; }
    .status-cancelled { border-left-color: #ef4444; color: #b91c1c; background: #fef2f2; }
    .status-no-show { border-left-color: #f59e0b; color: #b45309; background: #fffbeb; }
    .details-panel { border: 1px solid color-mix(in srgb, var(--ac-primary) 20%, var(--ac-border)); border-radius: 12px; padding: 16px; background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 6%, var(--ac-surface)), var(--ac-surface)); }
    .details-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
    .details-head h2 { margin: 0; color: var(--ac-text); }
    .details-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .details-grid span { min-width: 0; display: grid; gap: 4px; padding: 12px; border: 1px solid var(--ac-border); border-radius: 9px; background: color-mix(in srgb, var(--ac-surface) 82%, transparent); }
    .details-grid small { color: var(--ac-muted); font-weight: 800; }
    .details-grid strong { color: var(--ac-text); overflow-wrap: anywhere; }
    .span-2 { grid-column: 1 / -1; }
    .details-actions { margin-top: 14px; flex-wrap: wrap; }
    .drawer-form { display: grid; gap: 16px; }
    .form-section { border: 1px solid var(--ac-border); border-radius: 10px; padding: 16px; background: var(--ac-surface); }
    .section-title { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .section-title span { width: 38px; height: 38px; border-radius: 9px; display: grid; place-items: center; background: var(--ac-primary-light); color: var(--ac-primary); }
    .section-title h3 { margin: 0; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    label { display: grid; gap: 8px; color: var(--ac-text); font-size: 13px; font-weight: 850; }
    label > span { color: var(--ac-muted); }
    input, textarea { width: 100%; border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-text); border-radius: 8px; padding: 12px 13px; font: inherit; font-weight: 750; outline: 0; }
    textarea { resize: vertical; }
    input:focus, textarea:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent); }
    .slot-picker { display: grid; gap: 10px; padding: 13px; border: 1px dashed color-mix(in srgb, var(--ac-primary) 28%, var(--ac-border)); border-radius: 10px; background: color-mix(in srgb, var(--ac-primary) 4%, var(--ac-surface)); }
    .slot-picker > div:first-child { display: flex; justify-content: space-between; gap: 10px; align-items: center; color: var(--ac-text); font-weight: 900; }
    .slot-picker > div:first-child small { color: var(--ac-muted); font-weight: 750; }
    .slot-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .slot-grid button { min-height: 34px; border: 1px solid var(--ac-border); border-radius: 999px; background: var(--ac-surface); color: var(--ac-text); padding: 0 11px; font: inherit; font-size: 12.5px; font-weight: 850; cursor: pointer; }
    .slot-grid button.selected { border-color: var(--ac-primary); background: var(--ac-primary); color: #fff; box-shadow: 0 10px 22px color-mix(in srgb, var(--ac-primary) 24%, transparent); }
    .slot-grid button:disabled { opacity: .45; cursor: not-allowed; text-decoration: line-through; }
    .slot-grid button small { margin-left: 4px; font-size: 10.5px; }
    .slot-grid p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .checkin-section { background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), var(--ac-surface)); }
    .checkin-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 14px; padding: 10px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface); color: var(--ac-muted); font-size: 12px; font-weight: 900; }
    .checkin-flow span:not(.material-symbols-rounded) { min-height: 28px; display: inline-flex; align-items: center; border-radius: 999px; padding: 0 10px; background: color-mix(in srgb, var(--ac-primary) 8%, var(--ac-surface)); color: var(--ac-text); }
    .checkin-flow .material-symbols-rounded { color: var(--ac-primary); font-size: 18px; }
    .queue-ticket { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .queue-ticket > div { min-height: 86px; display: grid; align-content: center; gap: 6px; padding: 16px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border)); background: color-mix(in srgb, var(--ac-primary) 7%, var(--ac-surface)); box-shadow: 0 14px 32px rgba(15, 23, 42, .06); }
    .queue-ticket small { color: var(--ac-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
    .queue-ticket strong { color: var(--ac-text); font-size: 28px; line-height: 1; }
    @media (max-width: 1220px) {
      .stats-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .workspace-toolbar, .toolbar-filters { grid-template-columns: 1fr; }
      .mode-tabs { width: fit-content; }
    }
    @media (max-width: 720px) {
      .page-header, .header-actions { flex-direction: column; align-items: stretch; }
      .header-actions .ac-btn { width: 100%; }
      .stats-row, .details-grid, .form-grid { grid-template-columns: 1fr; }
      .row-main { grid-template-columns: 44px minmax(0, 1fr); }
      .row-main .status-badge { grid-column: 1 / -1; justify-self: start; }
      .appointment-row { grid-template-columns: 1fr; }
      .calendar-head { flex-wrap: wrap; }
      .calendar-range { width: 100%; margin-left: 0; }
      .queue-ticket { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppointmentPageComponent implements OnInit, OnDestroy {
  protected readonly appointments = signal<AppointmentRecord[]>([]);
  protected readonly queues = signal<AppointmentQueueRecord[]>([]);
  protected readonly patients = signal<PatientSummary[]>([]);
  protected readonly doctors = signal<DoctorSummary[]>([]);
  protected readonly selectedDoctorProfile = signal<DoctorProfile | null>(null);
  protected readonly selectedAppointment = signal<AppointmentVm | null>(null);
  protected readonly checkInAppointment = signal<AppointmentVm | null>(null);
  protected readonly initialLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly checkingIn = signal(false);
  protected readonly drawerOpen = signal(false);
  protected readonly checkInDrawerOpen = signal(false);
  protected readonly viewMode = signal<AppointmentViewMode>('calendar');
  protected readonly form = signal<AppointmentForm>(createEmptyAppointmentForm());
  protected readonly checkInForm = signal<AppointmentCheckInForm>(createEmptyCheckInForm());
  protected readonly statusOptions = appointmentStatusOptions;
  protected readonly editableStatusOptions = editableAppointmentStatusOptions;
  protected readonly typeOptions = appointmentTypeOptions;
  protected readonly priorityOptions = appointmentPriorityOptions;
  protected searchQuery = '';
  protected patientFilter = '';
  protected branchFilter = '';
  protected departmentFilter = '';
  protected doctorFilter = '';
  protected statusFilter = '';
  protected calendarDate = todayInputValue();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly appointmentService = inject(AppointmentManagementService);
  private readonly patientService = inject(PatientManagementService);
  private readonly doctorService = inject(DoctorManagementService);
  private readonly branchContext = inject(BranchContextService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly patientOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select patient', value: '' },
    ...this.patients().map(patient => ({ label: `${patient.fullName} · ${patient.medicalRecordNo}`, value: patient.patientGuid }))
  ]);

  protected readonly doctorOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select doctor', value: '' },
    ...this.doctors().map(doctor => ({ label: `${doctor.fullName} · ${doctor.departmentName}`, value: doctor.doctorGuid }))
  ]);

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    const branchNames = unique([
      ...this.branchContext.branches().map(branch => branch.branchName),
      ...this.doctors().map(doctor => doctor.branchName),
      'Main Branch'
    ]);

    return [
      { label: 'Select branch', value: '' },
      ...branchNames.map(branch => ({ label: branch, value: branch }))
    ];
  });

  protected readonly branchFilterOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Branches', value: '' },
    ...this.branchOptions().filter(option => option.value)
  ]);

  protected readonly departmentFilterOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Departments', value: '' },
    ...unique(this.doctors()
      .filter(doctor => !this.branchFilter || doctor.branchName === this.branchFilter)
      .map(doctor => doctor.departmentName))
      .map(department => ({ label: department, value: department }))
  ]);

  protected readonly formDepartmentOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select department', value: '' },
    ...unique(this.doctors()
      .filter(doctor => !this.form().branchName || doctor.branchName === this.form().branchName)
      .map(doctor => doctor.departmentName))
      .map(department => ({ label: department, value: department }))
  ]);

  protected readonly formDoctorOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'Select doctor', value: '' },
    ...this.doctors()
      .filter(doctor => !this.form().branchName || doctor.branchName === this.form().branchName)
      .filter(doctor => !this.form().departmentName || doctor.departmentName === this.form().departmentName)
      .map(doctor => ({ label: `${doctor.fullName} · ${doctor.primarySpecialization}`, value: doctor.doctorGuid }))
  ]);

  protected readonly patientFilterOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Patients', value: '' },
    ...this.patients().map(patient => ({ label: `${patient.fullName} · ${patient.medicalRecordNo}`, value: patient.patientGuid }))
  ]);

  protected readonly doctorFilterOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Doctors', value: '' },
    ...this.doctors()
      .filter(doctor => !this.branchFilter || doctor.branchName === this.branchFilter)
      .filter(doctor => !this.departmentFilter || doctor.departmentName === this.departmentFilter)
      .map(doctor => ({ label: `${doctor.fullName} · ${doctor.departmentName}`, value: doctor.doctorGuid }))
  ]);

  protected readonly appointmentViewModels = computed<AppointmentVm[]>(() => {
    const patientMap = new Map(this.patients().map(patient => [patient.patientGuid, patient]));
    const doctorMap = new Map(this.doctors().map(doctor => [doctor.doctorGuid, doctor]));
    const queueMap = new Map(this.queues().map(queue => [queue.appointmentId, queue]));
    return this.appointments()
      .map(appointment => {
        const patient = patientMap.get(appointment.patientId) ?? null;
        const doctor = doctorMap.get(appointment.doctorId) ?? null;
        const queue = queueMap.get(appointment.id) ?? null;
        const doctorDepartment = appointment.departmentName?.trim() || doctor?.departmentName || '-';
        return {
          ...appointment,
          appointmentNo: appointment.appointmentNo || derivedAppointmentNo(appointment.id),
          appointmentType: appointment.appointmentType || 'NEW_CONSULTATION',
          branchName: appointment.branchName || doctor?.branchName || 'Main Branch',
          departmentName: appointment.departmentName || doctor?.departmentName || null,
          patient,
          doctor,
          queue,
          patientName: patient?.fullName ?? 'Unknown patient',
          patientMrn: patient?.medicalRecordNo ?? 'MRN not found',
          doctorName: doctor?.fullName ?? 'Unknown doctor',
          doctorDepartment,
          doctorSpecialization: doctor?.primarySpecialization ?? '-',
          displayAppointmentNo: appointment.appointmentNo || derivedAppointmentNo(appointment.id),
          displayAppointmentType: appointmentTypeLabel(appointment.appointmentType || 'NEW_CONSULTATION'),
          displayTokenNumber: queue?.tokenNumber || '-',
          displayPriority: queue ? priorityLabel(queue.priorityCode) : '-'
        };
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  });

  protected readonly filteredAppointments = computed(() => {
    const search = this.searchQuery.trim().toLowerCase();
    return this.appointmentViewModels().filter(appointment => {
      const searchable = [
        appointment.displayAppointmentNo,
        appointment.patientName,
        appointment.patientMrn,
        appointment.doctorName,
        appointment.doctorDepartment,
        appointment.doctorSpecialization,
        appointment.displayAppointmentType,
        appointment.displayTokenNumber,
        appointment.displayPriority,
        appointment.branchName,
        appointment.queue?.statusCode ?? '',
        appointment.reason ?? '',
        appointment.notes ?? '',
        appointment.statusCode
      ].join(' ').toLowerCase();
      return (!search || searchable.includes(search))
        && (!this.patientFilter || appointment.patientId === this.patientFilter)
        && (!this.branchFilter || appointment.branchName === this.branchFilter)
        && (!this.departmentFilter || appointment.doctorDepartment === this.departmentFilter)
        && (!this.doctorFilter || appointment.doctorId === this.doctorFilter)
        && (!this.statusFilter || normalizeStatus(appointment.statusCode) === this.statusFilter);
    });
  });

  protected readonly availableSlots = computed(() => {
    const current = this.form();
    const profile = this.selectedDoctorProfile();
    if (!current.doctorId || !current.appointmentDate || !profile) {
      return [];
    }

    const dayOfWeek = parseDateInput(current.appointmentDate).getDay();
    const availability = profile.availability.filter(slot =>
      slot.dayOfWeek === dayOfWeek
      && slot.statusCode !== 'INACTIVE'
      && (!current.branchName || slot.branchName === current.branchName)
    );

    const bookedCounts = new Map<string, number>();
    this.appointments()
      .filter(appointment => appointment.doctorId === current.doctorId)
      .filter(appointment => dateKey(appointment.startsAt) === current.appointmentDate)
      .filter(appointment => !['CANCELLED', 'NO_SHOW', 'NOSHOW'].includes(String(appointment.statusCode).toUpperCase()))
      .filter(appointment => appointment.id !== current.appointmentId)
      .forEach(appointment => {
        const time = timeInputValue(new Date(appointment.startsAt));
        bookedCounts.set(time, (bookedCounts.get(time) ?? 0) + 1);
      });

    return availability.flatMap(slot => createSlots(slot.startsAt, slot.endsAt, slot.slotDurationMinutes || 15, slot.maxPatients || 1, bookedCounts));
  });

  protected readonly stats = computed<AppointmentStats>(() => {
    const appointments = this.appointmentViewModels();
    return {
      total: appointments.length,
      booked: appointments.filter(item => ['SCHEDULED', 'CONFIRMED', 'BOOKED'].includes(String(item.statusCode).toUpperCase())).length,
      checkedIn: appointments.filter(item => item.statusCode === 'CHECKED_IN').length,
      completed: appointments.filter(item => item.statusCode === 'COMPLETED').length,
      cancelled: appointments.filter(item => item.statusCode === 'CANCELLED').length,
      today: appointments.filter(item => dateKey(item.startsAt) === todayInputValue()).length
    };
  });

  protected readonly statCards = computed(() => {
    const stats = this.stats();
    return [
      { label: 'Total', value: formatNumber(stats.total), icon: 'event', color: '#2563eb', bg: '#eff6ff' },
      { label: 'Today', value: formatNumber(stats.today), icon: 'today', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'Scheduled', value: formatNumber(stats.booked), icon: 'event_available', color: '#0891b2', bg: '#ecfeff' },
      { label: 'Checked In', value: formatNumber(stats.checkedIn), icon: 'how_to_reg', color: '#10b981', bg: '#ecfdf5' },
      { label: 'Completed', value: formatNumber(stats.completed), icon: 'task_alt', color: '#059669', bg: '#ecfdf5' },
      { label: 'Cancelled', value: formatNumber(stats.cancelled), icon: 'event_busy', color: '#dc2626', bg: '#fef2f2' }
    ];
  });

  protected readonly calendarDays = computed(() => {
    const start = startOfWeek(parseDateInput(this.calendarDate));
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const key = inputValue(date);
      return {
        dateKey: key,
        weekday: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date),
        dayNo: new Intl.DateTimeFormat('en-IN', { day: '2-digit' }).format(date),
        isToday: key === todayInputValue(),
        appointments: this.filteredAppointments().filter(appointment => dateKey(appointment.startsAt) === key)
      };
    });
  });

  async ngOnInit(): Promise<void> {
    this.initialLoading.set(true);
    try {
      await this.reload();
      this.applyRouteContext();
    } finally {
      this.initialLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  protected async reload(): Promise<void> {
    const [appointments, queues, patients, doctors] = await Promise.all([
      this.appointmentService.list(1, 100),
      this.appointmentService.listQueue(1, 100),
      this.patientService.search('', '', '', '', '', 1, 100),
      this.doctorService.search({ searchText: '', departmentName: '', specializationName: '', branchName: '', employmentType: '', statusCode: '', pageNumber: 1, pageSize: 100 }),
      this.branchContext.loadBranches()
    ]);

    if (!patients.success || !patients.data) {
      this.toast.error('Unable to load patients', getApiErrorMessage(patients, 'Patient API failed'));
    } else {
      this.patients.set(patients.data.patients);
    }

    if (!doctors.success || !doctors.data) {
      this.toast.error('Unable to load doctors', getApiErrorMessage(doctors, 'Doctor API failed'));
    } else {
      this.doctors.set(doctors.data.doctors);
    }

    if (!appointments.success || !appointments.data) {
      this.toast.error('Unable to load appointments', getApiErrorMessage(appointments, 'Appointment API failed'));
      return;
    }

    if (!queues.success || !queues.data) {
      this.toast.error('Unable to load doctor queue', getApiErrorMessage(queues, 'Queue API failed'));
    } else {
      this.queues.set(queues.data);
    }

    this.appointments.set(appointments.data);
    this.refreshSelectedAppointment();
  }

  protected openCreate(): void {
    const selectedBranch = this.branchContext.selectedBranch()?.branchName || this.branchContext.branches()[0]?.branchName || 'Main Branch';
    this.form.set({
      ...createEmptyAppointmentForm(),
      branchName: selectedBranch,
      appointmentDate: this.calendarDate || todayInputValue()
    });
    this.selectedDoctorProfile.set(null);
    this.drawerOpen.set(true);
  }

  protected openEdit(appointment: AppointmentVm): void {
    this.form.set(mapAppointmentToForm(appointment));
    void this.loadDoctorProfile(appointment.doctorId);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.form.set(createEmptyAppointmentForm());
  }

  protected drawerTitle(): string {
    const current = this.form();
    const patient = this.patients().find(item => item.patientGuid === current.patientId);
    return patient?.fullName ?? 'Appointment';
  }

  protected canSave(): boolean {
    const current = this.form();
    return Boolean(current.patientId && current.branchName && current.departmentName && current.doctorId && current.appointmentDate && current.appointmentTime);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      this.toast.warning('Missing details', 'Patient, branch, department, doctor, date, and time slot are required.');
      return;
    }

    this.saving.set(true);
    try {
      const current = this.form();
      const response = current.appointmentId
        ? await this.appointmentService.update(current)
        : await this.appointmentService.create(current);

      if (!response.success || !response.data) {
        this.toast.error('Unable to save appointment', getApiErrorMessage(response, 'Appointment API failed'));
        return;
      }

      this.upsertAppointment(response.data);
      this.closeDrawer();
      this.toast.success(current.appointmentId ? 'Appointment updated' : 'Appointment created');
    } finally {
      this.saving.set(false);
    }
  }

  protected selectAppointment(appointment: AppointmentVm): void {
    this.selectedAppointment.set(appointment);
  }

  protected openCheckIn(appointment: AppointmentVm): void {
    if (!this.canCheckIn(appointment)) {
      return;
    }

    this.checkInAppointment.set(appointment);
    this.checkInForm.set(createCheckInForm(appointment, this.queues(), this.appointments()));
    this.checkInDrawerOpen.set(true);
  }

  protected closeCheckInDrawer(): void {
    this.checkInDrawerOpen.set(false);
    this.checkInAppointment.set(null);
    this.checkInForm.set(createEmptyCheckInForm());
  }

  protected canSubmitCheckIn(): boolean {
    const current = this.checkInForm();
    return Boolean(current.appointmentId && current.arrivalDate && current.arrivalTime && current.tokenNumber.trim() && current.queueNo > 0);
  }

  protected async saveCheckIn(): Promise<void> {
    const appointment = this.checkInAppointment();
    if (!appointment || !this.canSubmitCheckIn()) {
      this.toast.warning('Missing check-in details', 'Arrival time and token number are required.');
      return;
    }

    this.checkingIn.set(true);
    try {
      const form = this.checkInForm();
      const queueResponse = form.queueId
        ? await this.appointmentService.updateQueue(form)
        : await this.appointmentService.createQueue(form);

      if (!queueResponse.success || !queueResponse.data) {
        this.toast.error('Unable to add patient to queue', getApiErrorMessage(queueResponse, 'Queue API failed'));
        return;
      }

      const appointmentResponse = await this.appointmentService.updateStatus(appointment, 'CHECKED_IN');
      if (!appointmentResponse.success || !appointmentResponse.data) {
        this.toast.error('Unable to check in appointment', getApiErrorMessage(appointmentResponse, 'Appointment API failed'));
        return;
      }

      this.upsertQueue(queueResponse.data);
      this.upsertAppointment(appointmentResponse.data);
      this.closeCheckInDrawer();
      this.toast.success('Patient checked in', `${queueResponse.data.tokenNumber} added to doctor queue.`);
    } finally {
      this.checkingIn.set(false);
    }
  }

  protected async cancelAppointment(appointment: AppointmentVm): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Cancel appointment?',
      message: `Cancel appointment for ${appointment.patientName} with ${appointment.doctorName}?`,
      details: 'Cancelled appointments remain visible in patient and doctor history.',
      confirmText: 'Cancel appointment',
      cancelText: 'Keep appointment',
      intent: 'warning',
      icon: 'event_busy'
    });
    if (!confirmed) {
      return;
    }

    await this.updateStatus(appointment, 'CANCELLED', 'Appointment cancelled');
  }

  protected canCheckIn(appointment: AppointmentVm): boolean {
    return ['BOOKED', 'SCHEDULED', 'CONFIRMED'].includes(String(appointment.statusCode).toUpperCase());
  }

  protected onBranchChanged(branchName: string): void {
    this.form.update(form => ({
      ...form,
      branchName,
      departmentName: '',
      doctorId: '',
      appointmentTime: ''
    }));
    this.selectedDoctorProfile.set(null);
  }

  protected onDepartmentChanged(departmentName: string): void {
    this.form.update(form => ({
      ...form,
      departmentName,
      doctorId: '',
      appointmentTime: ''
    }));
    this.selectedDoctorProfile.set(null);
  }

  protected onDoctorChanged(doctorId: string): void {
    const doctor = this.doctors().find(item => item.doctorGuid === doctorId);
    this.form.update(form => ({
      ...form,
      doctorId,
      branchName: form.branchName || doctor?.branchName || 'Main Branch',
      departmentName: form.departmentName || doctor?.departmentName || '',
      appointmentTime: ''
    }));
    void this.loadDoctorProfile(doctorId);
  }

  protected onAppointmentDateChanged(): void {
    this.form.update(form => ({ ...form, appointmentTime: '' }));
  }

  protected selectSlot(time: string): void {
    this.form.update(form => ({ ...form, appointmentTime: time }));
  }

  protected slotHelperText(): string {
    const form = this.form();
    if (!form.doctorId) {
      return 'Select a doctor to see reusable availability slots.';
    }

    if (!form.appointmentDate) {
      return 'Select an appointment date to load slots.';
    }

    if (!this.selectedDoctorProfile()) {
      return 'Loading doctor availability...';
    }

    return `${this.availableSlots().filter(slot => !slot.booked).length} slots available`;
  }

  protected async startOpd(appointment: AppointmentVm): Promise<void> {
    if (this.canCheckIn(appointment)) {
      this.openCheckIn(appointment);
      this.toast.warning('Check-in required', 'Add the patient to the doctor queue before starting OPD.');
      return;
    }

    await this.router.navigate(['/opd'], {
      queryParams: {
        appointmentId: appointment.id,
        patientGuid: appointment.patientId,
        doctorGuid: appointment.doctorId,
        mrn: appointment.patientMrn,
        action: 'start-visit'
      }
    });
  }

  protected statusClass(statusCode: string): string {
    const normalized = String(statusCode || '').toUpperCase();
    return {
      BOOKED: 'status-scheduled',
      SCHEDULED: 'status-scheduled',
      CONFIRMED: 'status-confirmed',
      CHECKED_IN: 'status-checked-in',
      WAITING: 'status-waiting',
      IN_CONSULTATION: 'status-in-consultation',
      COMPLETED: 'status-completed',
      CANCELLED: 'status-cancelled',
      NO_SHOW: 'status-no-show',
      NOSHOW: 'status-no-show'
    }[normalized] ?? 'status-scheduled';
  }

  protected statusLabel(statusCode: string): string {
    const normalized = String(statusCode || 'SCHEDULED').toUpperCase();
    return {
      BOOKED: 'Scheduled',
      SCHEDULED: 'Scheduled',
      CONFIRMED: 'Confirmed',
      CHECKED_IN: 'Checked In',
      WAITING: 'Waiting',
      IN_CONSULTATION: 'In Consultation',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      NO_SHOW: 'No Show',
      NOSHOW: 'No Show'
    }[normalized] ?? normalized;
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  protected formatTime(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  protected dateDay(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit' }).format(new Date(value));
  }

  protected dateMonth(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(value));
  }

  protected dateOnly(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  protected moveCalendar(days: number): void {
    this.calendarDate = inputValue(addDays(parseDateInput(this.calendarDate), days));
  }

  protected setToday(): void {
    this.calendarDate = todayInputValue();
    this.viewMode.set('calendar');
  }

  protected calendarRangeLabel(): string {
    const start = startOfWeek(parseDateInput(this.calendarDate));
    const end = addDays(start, 6);
    return `${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(start)} - ${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(end)}`;
  }

  private async updateStatus(appointment: AppointmentVm, statusCode: AppointmentStatusCode, successMessage: string): Promise<void> {
    const response = await this.appointmentService.updateStatus(appointment, statusCode);
    if (!response.success || !response.data) {
      this.toast.error('Unable to update appointment', getApiErrorMessage(response, 'Appointment API failed'));
      return;
    }

    this.upsertAppointment(response.data);
    this.toast.success(successMessage);
  }

  private async loadDoctorProfile(doctorId: string): Promise<void> {
    if (!doctorId) {
      this.selectedDoctorProfile.set(null);
      return;
    }

    const response = await this.doctorService.get(doctorId);
    if (!response.success || !response.data) {
      this.selectedDoctorProfile.set(null);
      this.toast.error('Unable to load doctor availability', getApiErrorMessage(response, 'Doctor API failed'));
      return;
    }

    this.selectedDoctorProfile.set(response.data);
  }

  private upsertAppointment(appointment: AppointmentRecord): void {
    this.appointments.update(appointments => {
      const exists = appointments.some(item => item.id === appointment.id);
      return exists
        ? appointments.map(item => item.id === appointment.id ? appointment : item)
        : [appointment, ...appointments];
    });
    this.refreshSelectedAppointment(appointment.id);
  }

  private upsertQueue(queue: AppointmentQueueRecord): void {
    this.queues.update(queues => {
      const exists = queues.some(item => item.id === queue.id || item.appointmentId === queue.appointmentId);
      return exists
        ? queues.map(item => item.id === queue.id || item.appointmentId === queue.appointmentId ? queue : item)
        : [queue, ...queues];
    });
    this.refreshSelectedAppointment(queue.appointmentId);
  }

  private refreshSelectedAppointment(forceId?: string): void {
    const selectedId = forceId ?? this.selectedAppointment()?.id;
    if (!selectedId) {
      return;
    }

    this.selectedAppointment.set(this.appointmentViewModels().find(item => item.id === selectedId) ?? null);
  }

  private applyRouteContext(): void {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('action') !== 'create') {
      return;
    }

    const form = createEmptyAppointmentForm();
    form.patientId = query.get('patientGuid') ?? '';
    form.doctorId = query.get('doctorGuid') ?? '';
    form.appointmentDate = this.calendarDate;
    this.form.set(form);
    this.drawerOpen.set(true);
  }
}

function createEmptyAppointmentForm(): AppointmentForm {
  return {
    appointmentId: '',
    appointmentNo: '',
    patientId: '',
    branchName: 'Main Branch',
    departmentName: '',
    doctorId: '',
    appointmentDate: todayInputValue(),
    appointmentTime: nextSlotTime(),
    appointmentType: 'NEW_CONSULTATION',
    statusCode: 'SCHEDULED',
    reason: '',
    notes: ''
  };
}

function createEmptyCheckInForm(): AppointmentCheckInForm {
  return {
    queueId: '',
    appointmentId: '',
    arrivalDate: todayInputValue(),
    arrivalTime: timeInputValue(new Date()),
    tokenNumber: '',
    queueNo: 0,
    priorityCode: 'NORMAL',
    notes: ''
  };
}

function createCheckInForm(appointment: AppointmentVm, queues: AppointmentQueueRecord[], appointments: AppointmentRecord[]): AppointmentCheckInForm {
  const existingQueue = queues.find(queue => queue.appointmentId === appointment.id) ?? null;
  const queueNo = existingQueue?.queueNo || nextQueueNoForDoctor(appointment, queues, appointments);
  const arrivedAt = existingQueue?.arrivedAt ? new Date(existingQueue.arrivedAt) : new Date();

  return {
    queueId: existingQueue?.id ?? '',
    appointmentId: appointment.id,
    arrivalDate: inputValue(arrivedAt),
    arrivalTime: timeInputValue(arrivedAt),
    tokenNumber: existingQueue?.tokenNumber || createTokenNumber(queueNo),
    queueNo,
    priorityCode: normalizePriority(existingQueue?.priorityCode),
    notes: existingQueue?.notes ?? ''
  };
}

function mapAppointmentToForm(appointment: AppointmentRecord): AppointmentForm {
  const date = new Date(appointment.startsAt);
  return {
    appointmentId: appointment.id,
    appointmentNo: appointment.appointmentNo || derivedAppointmentNo(appointment.id),
    patientId: appointment.patientId,
    branchName: appointment.branchName || 'Main Branch',
    departmentName: appointment.departmentName ?? '',
    doctorId: appointment.doctorId,
    appointmentDate: inputValue(date),
    appointmentTime: timeInputValue(date),
    appointmentType: normalizeAppointmentType(appointment.appointmentType),
    statusCode: normalizeStatus(appointment.statusCode),
    reason: appointment.reason ?? '',
    notes: appointment.notes ?? ''
  };
}

function normalizeStatus(value: string): AppointmentStatusCode {
  const normalized = String(value || 'SCHEDULED').toUpperCase();
  if (normalized === 'BOOKED') {
    return 'SCHEDULED';
  }

  return ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(normalized)
    ? normalized as AppointmentStatusCode
    : 'SCHEDULED';
}

function normalizeAppointmentType(value: string) {
  const normalized = String(value || 'NEW_CONSULTATION').toUpperCase();
  return ['NEW_CONSULTATION', 'FOLLOW_UP', 'WALK_IN', 'REFERRAL'].includes(normalized)
    ? normalized as AppointmentForm['appointmentType']
    : 'NEW_CONSULTATION';
}

function appointmentTypeLabel(value: string): string {
  const normalized = normalizeAppointmentType(value);
  return appointmentTypeOptions.find(option => option.value === normalized)?.label ?? 'New Consultation';
}

function normalizePriority(value: string | null | undefined): AppointmentCheckInForm['priorityCode'] {
  const normalized = String(value || 'NORMAL').toUpperCase();
  return ['NORMAL', 'URGENT', 'EMERGENCY', 'VIP'].includes(normalized)
    ? normalized as AppointmentCheckInForm['priorityCode']
    : 'NORMAL';
}

function priorityLabel(value: string): string {
  const normalized = normalizePriority(value);
  return appointmentPriorityOptions.find(option => option.value === normalized)?.label ?? 'Normal';
}

function derivedAppointmentNo(id: string): string {
  return `APT-${String(id || Date.now()).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function createTokenNumber(queueNo: number): string {
  return `TKN-${Math.max(1, queueNo).toString().padStart(3, '0')}`;
}

function nextQueueNoForDoctor(appointment: AppointmentVm, queues: AppointmentQueueRecord[], appointments: AppointmentRecord[]): number {
  const appointmentMap = new Map(appointments.map(item => [item.id, item]));
  const today = todayInputValue();
  const activeQueueNumbers = queues
    .filter(queue => dateKey(queue.arrivedAt) === today)
    .filter(queue => !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'NOSHOW'].includes(String(queue.statusCode).toUpperCase()))
    .filter(queue => appointmentMap.get(queue.appointmentId)?.doctorId === appointment.doctorId)
    .map(queue => queue.queueNo);

  return activeQueueNumbers.length ? Math.max(...activeQueueNumbers) + 1 : 1;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}

function createSlots(startsAt: string, endsAt: string, durationMinutes: number, maxPatients: number, bookedCounts: Map<string, number>): Array<{ value: string; label: string; booked: boolean }> {
  const start = parseTimeToMinutes(startsAt);
  const end = parseTimeToMinutes(endsAt);
  const duration = Math.max(5, durationMinutes || 15);
  if (start === null || end === null || end <= start) {
    return [];
  }

  const slots: Array<{ value: string; label: string; booked: boolean }> = [];
  for (let cursor = start; cursor + duration <= end; cursor += duration) {
    const value = minutesToTimeInput(cursor);
    slots.push({
      value,
      label: formatSlotLabel(value),
      booked: (bookedCounts.get(value) ?? 0) >= Math.max(1, maxPatients || 1)
    });
  }

  return slots;
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function minutesToTimeInput(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatSlotLabel(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(`2000-01-01T${value}:00`));
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

function nextSlotTime(): string {
  const date = new Date();
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return timeInputValue(date);
}

function parseDateInput(value: string): Date {
  const date = new Date(`${value || todayInputValue()}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dateKey(value: string): string {
  return inputValue(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}
