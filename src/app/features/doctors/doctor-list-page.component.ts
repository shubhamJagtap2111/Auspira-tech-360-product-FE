import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BranchContextService } from '../../core/context/branch-context.service';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { AcAdminDrawerComponent } from '../../shared/ui/admin-drawer/admin-drawer.component';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { AcPaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DoctorForm, DoctorProfile, DoctorRegistryStats, DoctorSummary } from './doctor-management.models';
import { DoctorManagementService } from './doctor-management.service';

type DoctorDrawerMode = 'view' | 'edit' | 'create';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcGridLoaderComponent, AcPaginationComponent, AcAdminDrawerComponent],
  template: `
    <section class="doctor-registry">
      <header class="page-header">
        <div>
          <p class="ac-eyebrow">Clinical</p>
          <h1 class="ac-page-title">Doctor Registry</h1>
          <p class="page-desc">Connected doctor master with departments, availability, schedules, appointment context, credentials, and performance.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary" type="button" (click)="exportCsv()" [disabled]="doctors().length === 0">
            <span class="material-symbols-rounded">download</span>
            Export
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
            <span class="material-symbols-rounded">medical_services</span>
            Add Doctor
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

      <section class="toolbar ac-card">
        <div class="search-field">
          <span class="material-symbols-rounded search-icon">search</span>
          <input class="toolbar-input" type="text" name="searchQuery" [(ngModel)]="searchQuery" (ngModelChange)="queueSearch()" (keyup.enter)="runSearchNow()"
                 placeholder="Search doctor, code, registration, mobile..." />
          @if (searchQuery) {
            <button class="clear-btn" type="button" (click)="clearSearch()">
              <span class="material-symbols-rounded">close</span>
            </button>
          }
        </div>
        <ac-dropdown class="toolbar-select" name="departmentFilter" [(ngModel)]="departmentFilter" (ngModelChange)="loadDoctors(1)" [options]="departmentOptions" />
        <ac-dropdown class="toolbar-select" name="specializationFilter" [(ngModel)]="specializationFilter" (ngModelChange)="loadDoctors(1)" [options]="specializationOptions" />
        <ac-dropdown class="toolbar-select" name="branchFilter" [(ngModel)]="branchFilter" (ngModelChange)="loadDoctors(1)" [options]="branchOptions()" />
        <ac-dropdown class="toolbar-select" name="statusFilter" [(ngModel)]="statusFilter" (ngModelChange)="loadDoctors(1)" [options]="statusOptions" />
        <button class="icon-btn" type="button" (click)="loadDoctors(1)" title="Refresh">
          <span class="material-symbols-rounded">refresh</span>
        </button>
        <div class="toolbar-count">{{ totalCount() }} doctors</div>
      </section>

      <section class="ac-card doctor-table-card">
        @if (initialLoading()) {
          <ac-grid-loader title="Loading doctor registry..." message="Preparing departments, schedules, and doctor records." />
        } @else if (doctors().length > 0) {
          <div class="table-scroll">
            <table class="ac-table doctor-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Doctor</th>
                  <th>Department</th>
                  <th>Specialization</th>
                  <th>Mobile</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (doctor of doctors(); track doctor.doctorGuid) {
                  <tr>
                    <td><span class="code-chip">{{ doctor.doctorCode }}</span></td>
                    <td>
                      <div class="doctor-cell">
                        <div class="doctor-avatar" [style.background]="avatarColor(doctor.doctorGuid)">{{ initials(doctor.fullName) }}</div>
                        <div>
                          <p class="doctor-name">{{ doctor.fullName }}</p>
                          <p class="doctor-meta">{{ doctor.qualification }} · {{ doctor.registrationNo }}</p>
                        </div>
                      </div>
                    </td>
                    <td>{{ doctor.departmentName }}</td>
                    <td>{{ doctor.primarySpecialization }}</td>
                    <td>{{ doctor.mobileNo || '-' }}</td>
                    <td>{{ currency(doctor.consultationFee) }}</td>
                    <td><span class="status-badge" [ngClass]="statusClass(doctor.statusCode)">{{ doctor.statusName }}</span></td>
                    <td>
                      <div class="row-actions">
                        <button class="tbl-btn" type="button" title="View profile" (click)="openDoctorProfile(doctor)">
                          <span class="material-symbols-rounded">visibility</span>
                        </button>
                        <button class="tbl-btn" type="button" title="Edit" (click)="openDoctor(doctor, 'edit')">
                          <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="tbl-btn" type="button" [title]="doctor.statusCode === 'ACTIVE' ? 'Deactivate' : 'Activate'" (click)="toggleDoctorStatus(doctor)">
                          <span class="material-symbols-rounded">{{ doctor.statusCode === 'ACTIVE' ? 'toggle_off' : 'toggle_on' }}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="mobile-doctor-list">
            @for (doctor of doctors(); track doctor.doctorGuid) {
              <article class="doctor-mobile-card">
                <div class="mobile-card-head">
                  <div class="doctor-cell">
                    <div class="doctor-avatar" [style.background]="avatarColor(doctor.doctorGuid)">{{ initials(doctor.fullName) }}</div>
                    <div>
                      <p class="doctor-name">{{ doctor.fullName }}</p>
                      <p class="doctor-meta">{{ doctor.doctorCode }} · {{ doctor.departmentName }}</p>
                    </div>
                  </div>
                  <span class="status-badge" [ngClass]="statusClass(doctor.statusCode)">{{ doctor.statusName }}</span>
                </div>
                <div class="mobile-card-grid">
                  <span><small>Specialization</small><strong>{{ doctor.primarySpecialization }}</strong></span>
                  <span><small>Mobile</small><strong>{{ doctor.mobileNo || '-' }}</strong></span>
                  <span><small>Fee</small><strong>{{ currency(doctor.consultationFee) }}</strong></span>
                </div>
                <div class="mobile-card-actions">
                  <button class="tbl-btn" type="button" title="View profile" (click)="openDoctorProfile(doctor)"><span class="material-symbols-rounded">visibility</span></button>
                  <button class="tbl-btn" type="button" title="Edit" (click)="openDoctor(doctor, 'edit')"><span class="material-symbols-rounded">edit</span></button>
                  <button class="tbl-btn" type="button" [title]="doctor.statusCode === 'ACTIVE' ? 'Deactivate' : 'Activate'" (click)="toggleDoctorStatus(doctor)"><span class="material-symbols-rounded">{{ doctor.statusCode === 'ACTIVE' ? 'toggle_off' : 'toggle_on' }}</span></button>
                </div>
              </article>
            }
          </div>

          <ac-pagination
            [pageNumber]="pageNumber()"
            [pageSize]="pageSize()"
            [totalCount]="totalCount()"
            itemLabel="doctors"
            (pageChange)="loadDoctors($event)"
            (pageSizeChange)="changePageSize($event)" />
        } @else {
          <div class="empty-state">
            <span class="empty-icon material-symbols-rounded">stethoscope</span>
            <h3>No doctors found</h3>
            <p>Adjust filters or add a doctor profile to start appointment and OPD linking.</p>
            <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
              <span class="material-symbols-rounded">medical_services</span>
              Add Doctor
            </button>
          </div>
        }
      </section>

      @if (drawerOpen()) {
        @if (form(); as doctorForm) {
          <ac-admin-drawer
            [open]="drawerOpen()"
            icon="medical_services"
            [eyebrow]="drawerEyebrow()"
            [title]="drawerTitle(doctorForm)"
            (closed)="closeDrawer()">
            <span drawer-summary class="ac-admin-pill">
              <span class="material-symbols-rounded">badge</span>
              {{ doctorForm.doctorCode || 'Auto code' }}
            </span>
            <span drawer-summary class="ac-admin-pill">
              <span class="material-symbols-rounded">workspace_premium</span>
              {{ doctorForm.registrationNo || 'Registration pending' }}
            </span>

            <div drawer-body class="drawer-form">
              <section class="form-section">
                <div class="section-title">
                  <span class="material-symbols-rounded">person</span>
                  <h3>Personal information</h3>
                </div>
                <div class="form-grid">
                  <label><span>Doctor code</span><input name="doctorCode" [(ngModel)]="doctorForm.doctorCode" readonly [disabled]="isViewMode()" /></label>
                  <label><span>Mobile *</span><input name="mobileNo" [(ngModel)]="doctorForm.mobileNo" [disabled]="isViewMode()" inputmode="tel" /></label>
                  <label><span>First name *</span><input name="firstName" [(ngModel)]="doctorForm.firstName" [disabled]="isViewMode()" /></label>
                  <label><span>Middle name</span><input name="middleName" [(ngModel)]="doctorForm.middleName" [disabled]="isViewMode()" /></label>
                  <label><span>Last name *</span><input name="lastName" [(ngModel)]="doctorForm.lastName" [disabled]="isViewMode()" /></label>
                  <label><span>Display name</span><input name="displayName" [(ngModel)]="doctorForm.displayName" [disabled]="isViewMode()" placeholder="Optional" /></label>
                  <label><span>Gender</span><ac-dropdown name="genderCode" [(ngModel)]="doctorForm.genderCode" [disabled]="isViewMode()" [options]="genderOptions" /></label>
                  <label><span>Date of birth</span><input type="date" name="dateOfBirth" [(ngModel)]="doctorForm.dateOfBirth" [disabled]="isViewMode()" /></label>
                  <label><span>Email</span><input type="email" name="email" [(ngModel)]="doctorForm.email" [disabled]="isViewMode()" /></label>
                </div>
              </section>

              <section class="form-section">
                <div class="section-title">
                  <span class="material-symbols-rounded">clinical_notes</span>
                  <h3>Professional details</h3>
                </div>
                <div class="form-grid">
                  <label><span>Department *</span><input name="departmentName" [(ngModel)]="doctorForm.departmentName" [disabled]="isViewMode()" /></label>
                  <label><span>Specialization *</span><input name="primarySpecialization" [(ngModel)]="doctorForm.primarySpecialization" [disabled]="isViewMode()" /></label>
                  <label><span>Qualification *</span><input name="qualification" [(ngModel)]="doctorForm.qualification" [disabled]="isViewMode()" /></label>
                  <label><span>Designation</span><input name="designation" [(ngModel)]="doctorForm.designation" [disabled]="isViewMode()" /></label>
                  <label><span>Experience years</span><input type="number" min="0" max="80" name="experienceYears" [(ngModel)]="doctorForm.experienceYears" [disabled]="isViewMode()" /></label>
                  <label><span>Medical registration number *</span><input name="registrationNo" [(ngModel)]="doctorForm.registrationNo" [disabled]="isViewMode()" /></label>
                  <label><span>Registration authority</span><input name="registrationCouncil" [(ngModel)]="doctorForm.registrationCouncil" [disabled]="isViewMode()" /></label>
                  <label><span>Registration expiry</span><input type="date" name="registrationExpiryDate" [(ngModel)]="doctorForm.registrationExpiryDate" [disabled]="isViewMode()" /></label>
                </div>
              </section>

              <section class="form-section">
                <div class="section-title">
                  <span class="material-symbols-rounded">contact_phone</span>
                  <h3>Hospital information</h3>
                </div>
                <div class="form-grid">
                  <label><span>Branch *</span><input name="branchName" [(ngModel)]="doctorForm.branchName" [disabled]="isViewMode()" /></label>
                  <label><span>Employment type</span><ac-dropdown name="employmentType" [(ngModel)]="doctorForm.employmentType" [disabled]="isViewMode()" [options]="employmentOptions" /></label>
                  <label><span>Joining date</span><input type="date" name="joiningDate" [(ngModel)]="doctorForm.joiningDate" [disabled]="isViewMode()" /></label>
                  <label><span>Consultation fee</span><input type="number" min="0" name="consultationFee" [(ngModel)]="doctorForm.consultationFee" [disabled]="isViewMode()" /></label>
                  <label><span>Status</span><ac-dropdown name="doctorStatus" [(ngModel)]="doctorForm.statusCode" [disabled]="isViewMode()" [options]="statusEditOptions" /></label>
                  <label><span>Alternate mobile</span><input name="alternateMobileNo" [(ngModel)]="doctorForm.alternateMobileNo" [disabled]="isViewMode()" inputmode="tel" /></label>
                  <label><span>Issue date</span><input type="date" name="registrationIssueDate" [(ngModel)]="doctorForm.registrationIssueDate" [disabled]="isViewMode()" /></label>
                </div>
                <label class="wide-label">
                  <span>Address</span>
                  <textarea name="address" rows="2" [(ngModel)]="doctorForm.address" [disabled]="isViewMode()"></textarea>
                </label>
                <label class="wide-label">
                  <span>Bio</span>
                  <textarea name="bio" rows="3" [(ngModel)]="doctorForm.bio" [disabled]="isViewMode()" placeholder="Short clinical profile"></textarea>
                </label>
              </section>

              <section class="form-section">
                <div class="section-title">
                  <span class="material-symbols-rounded">verified</span>
                  <h3>Credentials</h3>
                </div>
                <div class="form-grid">
                  <label><span>Certificates</span><input name="certificateDocumentUrl" [(ngModel)]="doctorForm.certificateDocumentUrl" [disabled]="isViewMode()" placeholder="Certificate document URL" /></label>
                  <label><span>Registration documents</span><input name="registrationDocumentUrl" [(ngModel)]="doctorForm.registrationDocumentUrl" [disabled]="isViewMode()" placeholder="Registration document URL" /></label>
                  <label><span>Qualification documents</span><input name="qualificationDocumentUrl" [(ngModel)]="doctorForm.qualificationDocumentUrl" [disabled]="isViewMode()" placeholder="Qualification document URL" /></label>
                </div>
              </section>
            </div>

            <button drawer-actions class="ac-btn ac-btn-secondary drawer-action-btn" type="button" (click)="closeDrawer()">Cancel</button>
            @if (!isViewMode()) {
              <button drawer-actions class="ac-btn ac-btn-primary drawer-action-btn save-doctor-btn" type="button" (click)="saveDoctor()" [disabled]="saving()">
                <span class="material-symbols-rounded">save</span>
                {{ doctorSaveLabel() }}
              </button>
            }
          </ac-admin-drawer>
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; }
    .doctor-registry { height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 10px; }
    .page-header { flex: 0 0 auto; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .page-desc { max-width: 760px; color: var(--ac-muted); line-height: 1.35; margin: 2px 0 0; font-size: 13px; }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .stats-row { flex: 0 0 auto; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .stat-card { display: flex; align-items: center; gap: 10px; padding: 9px 12px; min-height: 58px; }
    .stat-icon { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; font-size: 18px; }
    .stat-value { margin: 0; font-size: 19px; line-height: 1; font-weight: 900; color: var(--ac-text); }
    .stat-label { margin: 2px 0 0; color: var(--ac-muted); font-size: 11.5px; }
    .toolbar { flex: 0 0 auto; display: grid; grid-template-columns: minmax(240px, 1fr) 160px 180px 160px 140px 36px auto; gap: 7px; align-items: center; padding: 8px 10px; }
    .search-field { min-width: 0; display: flex; align-items: center; gap: 8px; height: 36px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-input-bg, var(--ac-subtle)); padding: 0 10px; }
    .search-icon, .clear-btn span { color: var(--ac-muted); }
    .toolbar-input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ac-text); font: inherit; }
    .clear-btn, .icon-btn, .tbl-btn { border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-muted); cursor: pointer; border-radius: 8px; display: inline-grid; place-items: center; }
    .clear-btn { width: 26px; height: 26px; border: 0; background: transparent; }
    .icon-btn { width: 36px; height: 36px; }
    .icon-btn span { font-size: 20px; }
    .toolbar-count { color: var(--ac-muted); white-space: nowrap; font-size: 12.5px; }
    .doctor-table-card { flex: 0 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
    .table-scroll { flex: 0 1 auto; min-height: 0; max-height: min(58vh, 560px); overflow: auto; }
    .doctor-table { min-width: 1120px; width: 100%; border-collapse: collapse; }
    .doctor-table th, .doctor-table td { padding: 8px 12px; border-bottom: 1px solid var(--ac-border); text-align: left; }
    .doctor-table th { background: var(--ac-subtle); color: var(--ac-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    .doctor-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .doctor-avatar { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 999px; color: #fff; display: grid; place-items: center; font-size: 11.5px; font-weight: 900; }
    .doctor-name { margin: 0; color: var(--ac-text); font-size: 13.5px; font-weight: 900; }
    .doctor-meta { margin: 2px 0 0; color: var(--ac-muted); font-size: 11.5px; }
    .code-chip, .status-badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 11.5px; font-weight: 900; white-space: nowrap; }
    .code-chip { background: color-mix(in srgb, var(--ac-primary) 10%, transparent); color: var(--ac-primary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .status-badge { background: color-mix(in srgb, var(--ac-muted) 14%, transparent); color: var(--ac-muted); }
    .sb-active { background: #E6F8EF; color: #05854D; }
    .sb-inactive { background: #EEF2F7; color: #475569; }
    .sb-on-leave { background: #FFF7ED; color: #C2410C; }
    .sb-suspended, .sb-archived { background: #FEE2E2; color: #B91C1C; }
    :host-context(.dark) .sb-active { background: rgba(16,185,129,.16); color: #5EEAD4; }
    :host-context(.dark) .sb-on-leave { background: rgba(245,158,11,.16); color: #FBBF24; }
    :host-context(.dark) .sb-suspended, :host-context(.dark) .sb-archived { background: rgba(239,68,68,.16); color: #FCA5A5; }
    .row-actions, .mobile-card-actions { display: flex; gap: 6px; align-items: center; }
    .tbl-btn { width: 30px; height: 30px; }
    .tbl-btn span { font-size: 17px; }
    .tbl-btn:hover { color: var(--ac-primary); border-color: color-mix(in srgb, var(--ac-primary) 38%, var(--ac-border)); }
    .tbl-btn.danger:hover { color: #DC2626; border-color: #FCA5A5; }
    .mobile-doctor-list { display: none; padding: 12px; gap: 12px; }
    .doctor-mobile-card { border: 1px solid var(--ac-border); border-radius: 8px; padding: 14px; background: var(--ac-surface); }
    .mobile-card-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
    .mobile-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
    .mobile-card-grid span { border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; min-width: 0; }
    .mobile-card-grid small { display: block; color: var(--ac-muted); margin-bottom: 4px; }
    .mobile-card-grid strong { color: var(--ac-text); overflow-wrap: anywhere; }
    .empty-state { min-height: 240px; display: grid; place-items: center; align-content: center; text-align: center; gap: 10px; color: var(--ac-muted); padding: 24px; }
    .empty-state h3 { margin: 0; color: var(--ac-text); }
    .empty-state p { max-width: 420px; margin: 0; }
    .empty-icon { width: 58px; height: 58px; border-radius: 14px; display: grid; place-items: center; background: var(--ac-subtle); color: var(--ac-muted); font-size: 31px; }
    .drawer-form { display: flex; flex-direction: column; gap: 18px; }
    .form-section { border: 1px solid var(--ac-border); border-radius: 8px; padding: 18px; background: var(--ac-surface); }
    .section-title { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .section-title span { width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center; background: var(--ac-primary-light); color: var(--ac-primary); }
    .section-title h3 { margin: 0; font-size: 18px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    label { display: grid; gap: 8px; color: var(--ac-text); font-weight: 800; font-size: 13px; }
    label span { color: var(--ac-muted); }
    input, textarea { width: 100%; border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-text); border-radius: 8px; padding: 12px 14px; font: inherit; font-weight: 700; outline: 0; }
    textarea { resize: vertical; }
    input:focus, textarea:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent); }
    input:disabled, textarea:disabled { opacity: .72; cursor: not-allowed; }
    .wide-label { margin-top: 14px; }
    .drawer-action-btn {
      min-width: 98px;
      height: 44px;
      border-radius: 10px;
      font-weight: 850;
    }
    .save-doctor-btn {
      min-width: 172px;
      padding-inline: 20px;
      box-shadow: 0 10px 22px color-mix(in srgb, var(--ac-primary) 24%, transparent);
    }
    .save-doctor-btn:hover {
      box-shadow: 0 14px 28px color-mix(in srgb, var(--ac-primary) 28%, transparent);
    }
    @media (max-width: 1180px) {
      .stats-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .toolbar { grid-template-columns: 1fr 1fr; }
      .toolbar-count { justify-self: end; }
    }
    @media (max-width: 760px) {
      .page-header { flex-direction: column; }
      .header-actions, .header-actions .ac-btn { width: 100%; }
      .stats-row, .toolbar, .form-grid, .mobile-card-grid { grid-template-columns: 1fr; }
      .table-scroll { display: none; }
      .mobile-doctor-list { display: grid; }
      .toolbar-select, .toolbar-count, .icon-btn { width: 100%; }
      .icon-btn { justify-self: stretch; }
      .drawer-action-btn,
      .save-doctor-btn {
        width: 100%;
        min-width: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DoctorListPageComponent implements OnInit, OnDestroy {
  protected readonly doctors = signal<DoctorSummary[]>([]);
  protected readonly stats = signal<DoctorRegistryStats>(emptyStats());
  protected readonly totalCount = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly initialLoading = signal(true);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly drawerOpen = signal(false);
  protected readonly drawerMode = signal<DoctorDrawerMode>('create');
  protected readonly form = signal<DoctorForm | null>(null);

  protected searchQuery = '';
  protected departmentFilter = '';
  protected specializationFilter = '';
  protected branchFilter = '';
  protected statusFilter = '';

  protected readonly departmentOptions: DropdownOption<string>[] = [
    { label: 'All Departments', value: '' },
    { label: 'General Medicine', value: 'General Medicine' },
    { label: 'Cardiology', value: 'Cardiology' },
    { label: 'Orthopedics', value: 'Orthopedics' },
    { label: 'Pediatrics', value: 'Pediatrics' },
    { label: 'Gynecology', value: 'Gynecology' }
  ];
  protected readonly specializationOptions: DropdownOption<string>[] = [
    { label: 'All Specializations', value: '' },
    { label: 'General Physician', value: 'General Physician' },
    { label: 'Cardiologist', value: 'Cardiologist' },
    { label: 'Orthopedic Surgeon', value: 'Orthopedic Surgeon' },
    { label: 'Pediatrician', value: 'Pediatrician' },
    { label: 'Gynecologist', value: 'Gynecologist' }
  ];
  protected readonly statusOptions: DropdownOption<string>[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'On Leave', value: 'ON_LEAVE' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Archived', value: 'ARCHIVED' }
  ];
  protected readonly statusEditOptions = this.statusOptions.filter(option => option.value);
  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => [
    { label: 'All Branches', value: '' },
    ...this.branchContext.branches().map(branch => ({ label: branch.branchName, value: branch.branchName }))
  ]);
  protected readonly genderOptions: DropdownOption<string>[] = [
    { label: 'Not specified', value: '' },
    { label: 'Male', value: 'MALE' },
    { label: 'Female', value: 'FEMALE' },
    { label: 'Other', value: 'OTHER' }
  ];
  protected readonly employmentOptions: DropdownOption<string>[] = [
    { label: 'Full time', value: 'FULL_TIME' },
    { label: 'Part time', value: 'PART_TIME' },
    { label: 'Visiting', value: 'VISITING' },
    { label: 'Contract', value: 'CONTRACT' }
  ];

  protected readonly statCards = computed(() => [
    { label: 'Total Doctors', value: formatNumber(this.stats().totalDoctors), icon: 'medical_services', color: '#2563EB', bg: '#EAF1FF' },
    { label: 'Active Doctors', value: formatNumber(this.stats().activeDoctors), icon: 'verified_user', color: '#059669', bg: '#E7F8F0' },
    { label: 'On Leave', value: formatNumber(this.stats().onLeaveDoctors), icon: 'event_busy', color: '#EA580C', bg: '#FFF3E6' },
    { label: 'Expiring Registrations', value: formatNumber(this.stats().expiringRegistrations), icon: 'workspace_premium', color: '#7C3AED', bg: '#F1E8FF' }
  ]);

  private readonly service = inject(DoctorManagementService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly branchContext = inject(BranchContextService);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private branchReloadReady = false;
  private lastBranchCode: string | null = null;
  private readonly branchReloadEffect = effect(() => {
    const branchCode = this.branchContext.selectedBranchCode();
    if (!this.branchReloadReady) {
      this.lastBranchCode = branchCode;
      return;
    }

    if (branchCode !== this.lastBranchCode) {
      this.lastBranchCode = branchCode;
      untracked(() => void this.loadDoctors(1));
    }
  });

  async ngOnInit(): Promise<void> {
    this.initialLoading.set(true);
    try {
      await this.branchContext.loadBranches();
      this.lastBranchCode = this.branchContext.selectedBranchCode();
      this.branchReloadReady = true;
      await this.loadDoctors(1);
    } finally {
      this.initialLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  protected async loadDoctors(pageNumber = this.pageNumber()): Promise<void> {
    this.loading.set(true);
    const response = await this.service.search({
      searchText: this.searchQuery,
      departmentName: this.departmentFilter,
      specializationName: this.specializationFilter,
      branchName: this.branchFilter,
      employmentType: '',
      statusCode: this.statusFilter,
      pageNumber,
      pageSize: this.pageSize()
    });
    this.loading.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to load doctors', getApiErrorMessage(response, 'Doctor API failed'));
      return;
    }

    this.doctors.set(response.data.doctors);
    this.stats.set(response.data.stats);
    this.totalCount.set(response.data.totalCount);
    this.pageNumber.set(response.data.pageNumber);
    this.pageSize.set(response.data.pageSize);
  }

  protected queueSearch(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => void this.loadDoctors(1), 280);
  }

  protected runSearchNow(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    void this.loadDoctors(1);
  }

  protected clearSearch(): void {
    this.searchQuery = '';
    void this.loadDoctors(1);
  }

  protected changePageSize(pageSize: number): void {
    this.pageSize.set(pageSize);
    void this.loadDoctors(1);
  }

  protected async startCreate(): Promise<void> {
    const doctor = createEmptyDoctor(this.branchContext.selectedBranch()?.branchName);
    const response = await this.service.nextDoctorCode();
    if (response.success && response.data) {
      doctor.doctorCode = response.data.doctorCode;
    }
    this.drawerMode.set('create');
    this.form.set(doctor);
    this.drawerOpen.set(true);
  }

  protected async openDoctor(doctor: DoctorSummary, mode: DoctorDrawerMode): Promise<void> {
    const response = await this.service.get(doctor.doctorGuid);
    if (!response.success || !response.data) {
      this.toast.error('Unable to open doctor', getApiErrorMessage(response, 'Doctor API failed'));
      return;
    }

    this.drawerMode.set(mode);
    this.form.set(mapProfileToForm(response.data));
    this.drawerOpen.set(true);
  }

  protected openDoctorProfile(doctor: DoctorSummary): void {
    void this.router.navigate(['/doctors', doctor.doctorGuid]);
  }

  protected async toggleDoctorStatus(doctor: DoctorSummary): Promise<void> {
    const response = await this.service.get(doctor.doctorGuid);
    if (!response.success || !response.data) {
      this.toast.error('Unable to update doctor', getApiErrorMessage(response, 'Doctor API failed'));
      return;
    }

    const form = mapProfileToForm(response.data);
    form.statusCode = doctor.statusCode === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updateResponse = await this.service.update(form);
    if (!updateResponse.success || !updateResponse.data) {
      this.toast.error('Unable to update status', getApiErrorMessage(updateResponse, 'Doctor API failed'));
      return;
    }

    this.upsertDoctor(updateResponse.data, false);
    this.toast.success(form.statusCode === 'ACTIVE' ? 'Doctor activated' : 'Doctor deactivated');
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.form.set(null);
  }

  protected doctorSaveLabel(): string {
    if (this.saving()) {
      return this.drawerMode() === 'edit' ? 'Updating doctor...' : 'Saving doctor...';
    }

    return this.drawerMode() === 'edit' ? 'Update Doctor' : 'Save Doctor';
  }

  protected async saveDoctor(): Promise<void> {
    const doctor = this.form();
    if (!doctor) {
      return;
    }

    if (!doctor.firstName.trim() || !doctor.lastName.trim() || !doctor.mobileNo?.trim() || !doctor.registrationNo.trim() || !doctor.departmentName.trim() || !doctor.primarySpecialization.trim() || !doctor.qualification.trim() || !doctor.branchName.trim()) {
      this.toast.warning('Missing details', 'Name, mobile, registration, department, specialization, qualification, and branch are required.');
      return;
    }

    this.saving.set(true);
    const wasCreate = this.drawerMode() === 'create';
    const response = wasCreate
      ? await this.service.create(doctor)
      : await this.service.update(doctor);
    this.saving.set(false);

    if (!response.success || !response.data) {
      this.toast.error('Unable to save doctor', getApiErrorMessage(response, 'Doctor API failed'));
      return;
    }

    await this.saveCredentialDocuments(response.data.doctorGuid, doctor);
    this.upsertDoctor(response.data, wasCreate);
    this.toast.success('Doctor saved');
    this.closeDrawer();
  }

  protected async deleteDoctor(doctor: DoctorSummary): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Delete doctor?',
      message: `Delete ${doctor.fullName}?`,
      details: 'This is blocked automatically if appointments, OPD, or IPD activity exists.',
      confirmText: 'Delete Doctor',
      cancelText: 'Cancel',
      icon: 'delete',
      intent: 'danger'
    });
    if (!confirmed) {
      return;
    }

    const response = await this.service.delete(doctor.doctorGuid);
    if (!response.success) {
      this.toast.error('Unable to delete doctor', getApiErrorMessage(response, 'Doctor API failed'));
      return;
    }

    this.removeDoctor(doctor);
    this.toast.success('Doctor deleted');
  }

  private async saveCredentialDocuments(doctorGuid: string, doctor: DoctorForm): Promise<void> {
    const documents = [
      { documentType: 'CERTIFICATE', documentName: 'Certificate', fileUrl: doctor.certificateDocumentUrl?.trim() ?? '' },
      { documentType: 'REGISTRATION', documentName: 'Registration Document', fileUrl: doctor.registrationDocumentUrl?.trim() ?? '' },
      { documentType: 'QUALIFICATION', documentName: 'Qualification Document', fileUrl: doctor.qualificationDocumentUrl?.trim() ?? '' }
    ].filter(document => document.fileUrl);

    for (const document of documents) {
      const response = await this.service.createDocument({
        doctorId: doctorGuid,
        ...document,
        documentNo: doctor.registrationNo || null,
        issueDate: doctor.registrationIssueDate,
        expiryDate: doctor.registrationExpiryDate,
        verificationStatus: 'PENDING'
      });
      if (!response.success) {
        this.toast.warning('Credential upload skipped', getApiErrorMessage(response, 'Doctor document API failed'));
      }
    }
  }

  private upsertDoctor(doctor: DoctorProfile, isNew: boolean): void {
    const previous = this.doctors().find(item => item.doctorGuid === doctor.doctorGuid) ?? null;
    this.doctors.update(doctors => {
      const existingIndex = doctors.findIndex(item => item.doctorGuid === doctor.doctorGuid);
      if (existingIndex >= 0) {
        return doctors.map(item => item.doctorGuid === doctor.doctorGuid ? doctor : item);
      }

      const nextDoctors = [doctor, ...doctors];
      return nextDoctors.slice(0, this.pageSize());
    });

    if (isNew) {
      this.totalCount.update(count => count + 1);
      this.stats.update(stats => ({
        ...stats,
        totalDoctors: stats.totalDoctors + 1,
        activeDoctors: doctor.statusCode === 'ACTIVE' ? stats.activeDoctors + 1 : stats.activeDoctors,
        onLeaveDoctors: doctor.statusCode === 'ON_LEAVE' ? stats.onLeaveDoctors + 1 : stats.onLeaveDoctors
      }));
      return;
    }

    if (previous && previous.statusCode !== doctor.statusCode) {
      this.stats.update(stats => adjustDoctorStatusStats(stats, previous.statusCode, doctor.statusCode));
    }
  }

  private removeDoctor(doctor: DoctorSummary): void {
    this.doctors.update(doctors => doctors.filter(item => item.doctorGuid !== doctor.doctorGuid));
    this.totalCount.update(count => Math.max(0, count - 1));
    this.stats.update(stats => ({
      ...adjustDoctorStatusStats(stats, doctor.statusCode, ''),
      totalDoctors: Math.max(0, stats.totalDoctors - 1)
    }));
  }

  protected isViewMode(): boolean {
    return this.drawerMode() === 'view';
  }

  protected drawerEyebrow(): string {
    return this.drawerMode() === 'create' ? 'New Doctor' : this.drawerMode() === 'edit' ? 'Edit Doctor' : 'Doctor Details';
  }

  protected drawerTitle(doctor: DoctorForm): string {
    return [doctor.firstName, doctor.lastName].filter(Boolean).join(' ') || 'Doctor profile';
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

  protected statusClass(statusCode: string): string {
    return `sb-${statusCode.toLowerCase().replaceAll('_', '-')}`;
  }

  protected currency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  }

  protected exportCsv(): void {
    const rows = [
      ['Code', 'Doctor', 'Registration', 'Department', 'Specialization', 'Mobile', 'Fee', 'Status'],
      ...this.doctors().map(doctor => [
        doctor.doctorCode,
        doctor.fullName,
        doctor.registrationNo,
        doctor.departmentName,
        doctor.primarySpecialization,
        doctor.mobileNo ?? '',
        String(doctor.consultationFee),
        doctor.statusName
      ])
    ];
    const blob = new Blob([rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `doctors-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function createEmptyDoctor(branchName = 'Main Branch'): DoctorForm {
  return {
    doctorGuid: '',
    doctorCode: '',
    firstName: '',
    middleName: null,
    lastName: '',
    displayName: null,
    profilePhotoUrl: null,
    registrationNo: '',
    registrationCouncil: null,
    registrationIssueDate: null,
    registrationExpiryDate: null,
    genderCode: null,
    dateOfBirth: null,
    mobileNo: null,
    alternateMobileNo: null,
    email: null,
    address: null,
    emergencyContactNo: null,
    departmentName: 'General Medicine',
    primarySpecialization: 'General Physician',
    qualification: '',
    designation: null,
    experienceYears: 0,
    employmentType: 'FULL_TIME',
    branchName,
    joiningDate: null,
    consultationFee: 0,
    statusCode: 'ACTIVE',
    bio: null,
    certificateDocumentUrl: null,
    registrationDocumentUrl: null,
    qualificationDocumentUrl: null,
    rowVersion: null
  };
}

function mapProfileToForm(doctor: DoctorProfile): DoctorForm {
  return {
    doctorGuid: doctor.doctorGuid,
    doctorCode: doctor.doctorCode,
    firstName: doctor.firstName,
    middleName: doctor.middleName,
    lastName: doctor.lastName,
    displayName: doctor.fullName,
    profilePhotoUrl: doctor.profilePhotoUrl,
    registrationNo: doctor.registrationNo,
    registrationCouncil: doctor.registrationCouncil,
    registrationIssueDate: doctor.registrationIssueDate,
    registrationExpiryDate: doctor.registrationExpiryDate,
    genderCode: doctor.genderCode,
    dateOfBirth: doctor.dateOfBirth,
    mobileNo: doctor.mobileNo,
    alternateMobileNo: doctor.alternateMobileNo,
    email: doctor.email,
    address: doctor.address,
    emergencyContactNo: doctor.emergencyContactNo,
    departmentName: doctor.departmentName,
    primarySpecialization: doctor.primarySpecialization,
    qualification: doctor.qualification,
    designation: doctor.designation,
    experienceYears: doctor.experienceYears,
    employmentType: doctor.employmentType,
    branchName: doctor.branchName,
    joiningDate: doctor.joiningDate,
    consultationFee: doctor.consultationFee,
    statusCode: doctor.statusCode,
    bio: doctor.bio,
    certificateDocumentUrl: null,
    registrationDocumentUrl: null,
    qualificationDocumentUrl: null,
    rowVersion: doctor.rowVersion
  };
}

function emptyStats(): DoctorRegistryStats {
  return {
    totalDoctors: 0,
    activeDoctors: 0,
    onLeaveDoctors: 0,
    expiringRegistrations: 0
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

function adjustDoctorStatusStats(stats: DoctorRegistryStats, previousStatus: string, nextStatus: string): DoctorRegistryStats {
  const activeDelta = (nextStatus === 'ACTIVE' ? 1 : 0) - (previousStatus === 'ACTIVE' ? 1 : 0);
  const leaveDelta = (nextStatus === 'ON_LEAVE' ? 1 : 0) - (previousStatus === 'ON_LEAVE' ? 1 : 0);

  return {
    ...stats,
    activeDoctors: Math.max(0, stats.activeDoctors + activeDelta),
    onLeaveDoctors: Math.max(0, stats.onLeaveDoctors + leaveDelta)
  };
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
