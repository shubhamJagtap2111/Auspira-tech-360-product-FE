import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AcAdminDrawerComponent } from '../../shared/ui/admin-drawer/admin-drawer.component';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { AcPaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { PatientForm, PatientRegistryStats, PatientSummary } from './patient-management.models';
import { PatientManagementService } from './patient-management.service';

type PatientDrawerMode = 'view' | 'edit' | 'create';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcPaginationComponent, AcAdminDrawerComponent],
  template: `
    <section class="patients">
      <header class="page-header">
        <div>
          <p class="ac-eyebrow">Clinical</p>
          <h1 class="ac-page-title">Patient Registry</h1>
          <p class="page-desc">Tenant-isolated patient master with history, documents, allergies, insurance, and billing context.</p>
        </div>
        <div class="header-actions">
          <button class="ac-btn ac-btn-secondary" type="button" (click)="exportCsv()" [disabled]="patients().length === 0">
            <span class="material-symbols-rounded">download</span>
            Export
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
            <span class="material-symbols-rounded">person_add</span>
            Register Patient
          </button>
        </div>
      </header>

      <div class="stats-row">
        @for (s of statCards(); track s.label) {
          <article class="stat-card ac-card">
            <div class="stat-icon" [style.background]="s.bg" [style.color]="s.color">
              <span class="material-symbols-rounded msf">{{ s.icon }}</span>
            </div>
            <div>
              <p class="stat-value">{{ s.value }}</p>
              <p class="stat-label">{{ s.label }}</p>
            </div>
          </article>
        }
      </div>

      <section class="toolbar ac-card">
        <div class="search-field">
          <span class="material-symbols-rounded search-icon">search</span>
          <input class="toolbar-input" type="text" name="searchQuery" [(ngModel)]="searchQuery" (ngModelChange)="queueSearch()" (keyup.enter)="runSearchNow()"
                 placeholder="Search by name, MRN, or mobile..." />
          @if (searchQuery) {
            <button class="clear-btn" type="button" (click)="clearSearch()">
              <span class="material-symbols-rounded">close</span>
            </button>
          }
        </div>
        <ac-dropdown class="toolbar-select" name="genderFilter" [(ngModel)]="genderFilter" (ngModelChange)="loadPatients(1)" [options]="genderOptions" />
        <ac-dropdown class="toolbar-select" name="statusFilter" [(ngModel)]="statusFilter" (ngModelChange)="loadPatients(1)" [options]="statusOptions" />
        <button class="icon-btn" type="button" (click)="loadPatients(1)" title="Refresh">
          <span class="material-symbols-rounded">refresh</span>
        </button>
        <div class="toolbar-count">
          <span>{{ totalCount() }} patients</span>
        </div>
      </section>

      <section class="ac-card table-card ac-admin-layout" [class.drawer-open]="drawerOpen()">
        @if (patients().length > 0) {
          <div class="table-scroll">
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
                @for (patient of patients(); track patient.patientGuid) {
                  <tr>
                    <td><span class="mrn-chip">{{ patient.medicalRecordNo }}</span></td>
                    <td>
                      <div class="patient-cell">
                        <div class="patient-avatar" [style.background]="avatarColor(patient.patientGuid)">{{ initials(patient) }}</div>
                        <div>
                          <p class="patient-name">{{ patient.fullName }}</p>
                          <p class="patient-meta">{{ displayPatientAge(patient) }} · {{ patient.bloodGroupName }}</p>
                        </div>
                      </div>
                    </td>
                    <td>{{ patient.mobileNo }}</td>
                    <td><span class="gender-badge" [class]="genderClass(patient.genderCode)">{{ patient.genderName }}</span></td>
                    <td>{{ formatVisit(patient.lastVisitDate) }}</td>
                    <td><span class="status-badge" [class]="statusClass(patient.statusCode)">{{ patient.statusName }}</span></td>
                    <td>
                      <div class="row-actions">
                        <button class="tbl-btn" type="button" title="View profile" (click)="openPatient(patient, 'view')">
                          <span class="material-symbols-rounded">visibility</span>
                        </button>
                        <button class="tbl-btn" type="button" title="Edit" (click)="openPatient(patient, 'edit')">
                          <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="tbl-btn danger" type="button" title="Delete" (click)="deletePatient(patient)">
                          <span class="material-symbols-rounded">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="mobile-patient-list">
            @for (patient of patients(); track patient.patientGuid) {
              <article class="patient-mobile-card">
                <div class="mobile-card-head">
                  <div class="patient-cell">
                    <div class="patient-avatar" [style.background]="avatarColor(patient.patientGuid)">{{ initials(patient) }}</div>
                    <div>
                      <p class="patient-name">{{ patient.fullName }}</p>
                      <p class="patient-meta">{{ patient.medicalRecordNo }} · {{ displayPatientAge(patient) }} · {{ patient.bloodGroupName }}</p>
                    </div>
                  </div>
                  <span class="status-badge" [class]="statusClass(patient.statusCode)">{{ patient.statusName }}</span>
                </div>
                <div class="mobile-card-grid">
                  <span><small>Mobile</small><strong>{{ patient.mobileNo }}</strong></span>
                  <span><small>Gender</small><strong>{{ patient.genderName || '-' }}</strong></span>
                  <span><small>Last visit</small><strong>{{ formatVisit(patient.lastVisitDate) }}</strong></span>
                </div>
                <div class="mobile-card-actions">
                  <button class="tbl-btn" type="button" title="View profile" (click)="openPatient(patient, 'view')">
                    <span class="material-symbols-rounded">visibility</span>
                  </button>
                  <button class="tbl-btn" type="button" title="Edit" (click)="openPatient(patient, 'edit')">
                    <span class="material-symbols-rounded">edit</span>
                  </button>
                  <button class="tbl-btn danger" type="button" title="Delete" (click)="deletePatient(patient)">
                    <span class="material-symbols-rounded">delete</span>
                  </button>
                </div>
              </article>
            }
          </div>

          <ac-pagination
            [pageNumber]="pageNumber()"
            [pageSize]="pageSize()"
            [totalCount]="totalCount()"
            itemLabel="patients"
            (pageChange)="loadPatients($event)"
            (pageSizeChange)="changePageSize($event)" />
        } @else {
          <div class="empty-state">
            <div class="empty-icon">
              <span class="material-symbols-rounded msf">person_search</span>
            </div>
            <h3 class="empty-title">No patients found</h3>
            <p class="empty-desc">Try adjusting your search or filters, or register a new patient.</p>
            <button class="ac-btn ac-btn-primary" type="button" (click)="startCreate()">
              <span class="material-symbols-rounded">person_add</span>
              Register Patient
            </button>
          </div>
        }

        @if (drawerOpen()) {
          @if (form(); as patientForm) {
            <ac-admin-drawer
              [open]="drawerOpen()"
              icon="clinical_notes"
              [eyebrow]="drawerEyebrow()"
              [title]="drawerTitle(patientForm)"
              (closed)="closeDrawer()">
              <span drawer-summary class="ac-admin-pill">
                <span class="material-symbols-rounded">tag</span>
                {{ patientForm.medicalRecordNo || 'Auto MRN' }}
              </span>
              <span drawer-summary class="ac-admin-pill">
                <span class="material-symbols-rounded">phone_iphone</span>
                {{ displayMobile(patientForm) || 'Mobile pending' }}
              </span>

              <div drawer-body class="ac-admin-drawer-content">
                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title">
                    <span class="material-symbols-rounded">badge</span>
                    <h3>Patient identity</h3>
                  </div>
                  <div class="ac-admin-form-grid">
                    <label>
                      <span>MRN</span>
                      <input name="medicalRecordNo" [(ngModel)]="patientForm.medicalRecordNo" readonly [disabled]="isViewMode()" placeholder="Auto generated" />
                    </label>
                    <label class="mobile-field">
                      <span>Mobile</span>
                      <div class="mobile-control">
                        <div class="country-select-shell" [class.open]="countryDropdownOpen()" [class.disabled]="isViewMode()">
                          <button
                            class="country-trigger"
                            type="button"
                            [disabled]="isViewMode()"
                            [attr.aria-expanded]="countryDropdownOpen()"
                            aria-label="Country code"
                            (click)="toggleCountryDropdown($event)">
                            <img
                              class="country-flag"
                              [src]="flagUrl(patientForm.countryIsoCode)"
                              [alt]="selectedCountryName(patientForm.countryIsoCode) + ' flag'"
                              loading="lazy" />
                            <span>{{ selectedCountryName(patientForm.countryIsoCode) }} ({{ patientForm.countryDialCode }})</span>
                            <span class="material-symbols-rounded">expand_more</span>
                          </button>
                          @if (countryDropdownOpen()) {
                            <div class="country-panel">
                              @for (country of countryCodeOptions(); track country.isoCode) {
                                <button
                                  class="country-option"
                                  type="button"
                                  [class.selected]="country.isoCode === patientForm.countryIsoCode"
                                  (click)="chooseCountry(patientForm, country.isoCode)">
                                  <img class="country-option-flag" [src]="flagUrl(country.isoCode)" [alt]="country.name + ' flag'" loading="lazy" />
                                  <span>{{ country.name }} ({{ country.dialCode }})</span>
                                  @if (country.isoCode === patientForm.countryIsoCode) {
                                    <span class="material-symbols-rounded">check</span>
                                  }
                                </button>
                              }
                            </div>
                          }
                        </div>
                        <input class="mobile-number-input" name="mobileNumber" [(ngModel)]="patientForm.mobileNumber" [disabled]="isViewMode()" inputmode="tel" placeholder="8230394902" />
                      </div>
                    </label>
                    <label>
                      <span>First name</span>
                      <input name="firstName" [(ngModel)]="patientForm.firstName" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>Last name</span>
                      <input name="lastName" [(ngModel)]="patientForm.lastName" [disabled]="isViewMode()" />
                    </label>
                  </div>
                </section>

                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title">
                    <span class="material-symbols-rounded">personal_injury</span>
                    <h3>Clinical basics</h3>
                  </div>
                  <div class="ac-admin-form-grid">
                    <label>
                      <span>Gender</span>
                      <select name="genderCode" [(ngModel)]="patientForm.genderCode" [disabled]="isViewMode()">
                        <option [ngValue]="null">Not specified</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                    <label>
                      <span>Blood group</span>
                      <select name="bloodGroupCode" [(ngModel)]="patientForm.bloodGroupCode" [disabled]="isViewMode()">
                        <option [ngValue]="null">Not specified</option>
                        @for (blood of bloodGroupOptions; track blood) {
                          <option [value]="blood">{{ blood }}</option>
                        }
                      </select>
                    </label>
                    <label>
                      <span>Date of birth</span>
                      <input type="date" name="dateOfBirth" [(ngModel)]="patientForm.dateOfBirth" [disabled]="isViewMode()" />
                    </label>
                  </div>
                </section>
              </div>

              <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeDrawer()">Cancel</button>
              <button drawer-actions class="ac-btn ac-btn-primary" type="button" (click)="save()" [disabled]="isViewMode() || saving() || !canSave(patientForm)">
                <span class="material-symbols-rounded">save</span>
                Save Patient
              </button>
            </ac-admin-drawer>
          }
        }
      </section>
    </section>
  `,
  styles: `
    .patients { display: flex; flex-direction: column; gap: 20px; animation: slideUp 0.3s ease; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .page-desc { font-size: 13.5px; color: var(--ac-muted); margin-top: 5px; max-width: 560px; }
    .header-actions { display: flex; gap: 10px; flex-shrink: 0; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .stat-card { display: flex; align-items: center; gap: 14px; padding: 16px; }
    .stat-icon { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: var(--ac-r-sm); flex-shrink: 0; }
    .stat-icon .material-symbols-rounded { font-size: 18px; }
    .stat-value { font-size: 20px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.01em; }
    .stat-label { font-size: 12px; color: var(--ac-muted); margin-top: 1px; }
    .toolbar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; flex-wrap: wrap; }
    .search-field { position: relative; display: flex; align-items: center; flex: 1; min-width: 240px; }
    .search-icon { position: absolute; left: 12px; color: var(--ac-muted); pointer-events: none; font-size: 18px; }
    .toolbar-input { width: 100%; height: 38px; padding: 0 36px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface-2); color: var(--ac-text); font-size: 13.5px; outline: none; transition: all var(--ac-t); }
    .toolbar-input:focus { border-color: var(--ac-primary); background: var(--ac-surface); box-shadow: 0 0 0 3px rgba(37,99,235,0.08); }
    .clear-btn { position: absolute; right: 10px; color: var(--ac-muted); cursor: pointer; display: flex; align-items: center; }
    .clear-btn .material-symbols-rounded { font-size: 16px; }
    .toolbar-select { min-width: 150px; }
    .toolbar-count { font-size: 12.5px; color: var(--ac-muted); padding: 0 4px; white-space: nowrap; }
    .icon-btn { width: 38px; height: 38px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface); color: var(--ac-muted); display: inline-grid; place-items: center; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .table-card { overflow: hidden; position: relative; display: flex; flex-direction: column; }
    .table-scroll { width: 100%; overflow-x: auto; overflow-y: hidden; }
    .table-scroll .ac-table { width: 100%; min-width: 980px; table-layout: fixed; }
    .table-scroll .ac-table th:nth-child(1), .table-scroll .ac-table td:nth-child(1) { width: 120px; }
    .table-scroll .ac-table th:nth-child(2), .table-scroll .ac-table td:nth-child(2) { width: 240px; }
    .table-scroll .ac-table th:nth-child(3), .table-scroll .ac-table td:nth-child(3) { width: 180px; }
    .table-scroll .ac-table th:nth-child(4), .table-scroll .ac-table td:nth-child(4) { width: 120px; }
    .table-scroll .ac-table th:nth-child(5), .table-scroll .ac-table td:nth-child(5) { width: 120px; }
    .table-scroll .ac-table th:nth-child(6), .table-scroll .ac-table td:nth-child(6) { width: 140px; }
    .table-scroll .ac-table th:nth-child(7), .table-scroll .ac-table td:nth-child(7) { width: 120px; }
    .mobile-patient-list { display: none; }
    .mrn-chip { font-family: monospace; font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: var(--ac-r-sm); background: var(--ac-primary-light); color: var(--ac-primary); }
    .patient-cell { display: flex; align-items: center; gap: 10px; }
    .patient-avatar { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: var(--ac-r-full); font-size: 12px; font-weight: 800; color: #fff; flex-shrink: 0; }
    .patient-name { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .patient-meta { font-size: 11.5px; color: var(--ac-muted); margin-top: 1px; }
    .gender-badge, .status-badge { display: inline-flex; padding: 3px 9px; border-radius: var(--ac-r-full); font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .gb-male { background: var(--ac-primary-light); color: var(--ac-primary); }
    .gb-female { background: rgba(236,72,153,0.1); color: #db2777; }
    .gb-other { background: var(--ac-secondary-light); color: var(--ac-secondary); }
    .gb-empty { background: var(--ac-surface-2); color: var(--ac-muted); }
    .sb-checked-in { background: var(--ac-primary-light); color: var(--ac-primary); }
    .sb-waiting { background: var(--ac-warning-light); color: var(--ac-warning); }
    .sb-completed { background: var(--ac-success-light); color: var(--ac-success); }
    .sb-scheduled { background: var(--ac-secondary-light); color: var(--ac-secondary); }
    .sb-registered { background: var(--ac-info-light); color: var(--ac-info); }
    .row-actions { display: flex; gap: 6px; }
    .tbl-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--ac-r-sm); border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-muted); cursor: pointer; transition: all var(--ac-t); }
    .tbl-btn .material-symbols-rounded { font-size: 16px; }
    .tbl-btn:hover { background: var(--ac-surface-2); color: var(--ac-text); }
    .tbl-btn.danger:hover { color: var(--ac-error); border-color: color-mix(in srgb, var(--ac-error) 32%, var(--ac-border)); background: var(--ac-error-light); }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; width: 100%; min-height: 360px; padding: 60px 24px; text-align: center; }
    .empty-icon { display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 18px; background: var(--ac-surface-2); }
    .empty-icon .material-symbols-rounded { font-size: 40px; color: var(--ac-muted-2); }
    .empty-title { font-size: 16px; font-weight: 700; color: var(--ac-text); }
    .empty-desc { font-size: 13.5px; color: var(--ac-muted); max-width: 340px; }
    input[readonly] { background: var(--ac-surface-2); color: var(--ac-text-2); cursor: not-allowed; font-weight: 800; }
    .mobile-field { grid-column: 1 / -1; }
    .mobile-control { display: grid; grid-template-columns: minmax(260px, .9fr) minmax(220px, 1.1fr); gap: 10px; width: 100%; min-width: 0; }
    .country-select-shell { position: relative; min-width: 0; }
    .country-trigger {
      width: 100%;
      min-height: 46px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 0 12px 0 16px;
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-sm);
      background: var(--ac-surface);
      color: var(--ac-text);
      cursor: pointer;
      text-align: left;
      transition: border-color var(--ac-t), box-shadow var(--ac-t), background var(--ac-t);
    }
    .country-trigger:hover { border-color: color-mix(in srgb, var(--ac-primary) 45%, var(--ac-border)); }
    .country-select-shell.open .country-trigger {
      border-color: var(--ac-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent);
    }
    .country-trigger:disabled { cursor: not-allowed; opacity: .72; }
    .country-trigger span:not(.material-symbols-rounded) {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 800;
    }
    .country-trigger .material-symbols-rounded { font-size: 19px; color: var(--ac-muted); }
    .country-flag, .country-option-flag { width: 24px; height: 17px; border-radius: 3px; object-fit: cover; box-shadow: 0 0 0 1px rgba(15,23,42,.12); flex-shrink: 0; }
    .country-panel {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 6px);
      z-index: 120;
      max-height: 280px;
      overflow-y: auto;
      padding: 7px;
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r);
      background: var(--ac-surface);
      box-shadow: 0 18px 38px rgba(15,23,42,.16);
    }
    .country-option {
      width: 100%;
      min-height: 40px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--ac-r-sm);
      background: transparent;
      color: var(--ac-text);
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .country-option:hover { background: var(--ac-subtle); }
    .country-option.selected {
      background: color-mix(in srgb, var(--ac-primary) 18%, transparent);
      color: var(--ac-primary);
      font-weight: 800;
    }
    .country-option span:not(.material-symbols-rounded) {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .country-option .material-symbols-rounded { font-size: 19px; }
    .mobile-number-input { min-width: 0; }
    @media (max-width: 900px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 760px) {
      .patients { gap: 14px; }
      .page-header { align-items: stretch; }
      .page-header > div:first-child { min-width: 0; }
      .ac-page-title { font-size: 25px; line-height: 1.12; }
      .page-desc { font-size: 13px; }
      .header-actions { width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
      .header-actions .ac-btn { width: 100%; padding-inline: 10px; }
      .stats-row { grid-template-columns: 1fr; gap: 10px; }
      .stat-card { padding: 14px; }
      .toolbar { display: grid; grid-template-columns: 1fr; padding: 12px; }
      .search-field { min-width: 0; width: 100%; }
      .toolbar-select, .toolbar ac-dropdown { min-width: 0; width: 100%; }
      .toolbar .icon-btn, .toolbar-count { width: 100%; }
      .toolbar-count { min-height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface); }
      .table-card { min-height: 0; border-radius: var(--ac-r-sm); }
      .table-scroll { display: none; }
      .mobile-patient-list { display: grid; gap: 10px; padding: 10px; }
      .patient-mobile-card { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--ac-border); border-radius: var(--ac-r); background: var(--ac-surface); box-shadow: var(--ac-sh-sm); }
      .mobile-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      .mobile-card-head .patient-cell { min-width: 0; }
      .mobile-card-head .patient-name,
      .mobile-card-head .patient-meta { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mobile-card-head .status-badge { flex: 0 0 auto; }
      .mobile-card-grid { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 10px; border-radius: var(--ac-r-sm); background: var(--ac-surface-2); }
      .mobile-card-grid span { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
      .mobile-card-grid small { color: var(--ac-muted); font-weight: 700; }
      .mobile-card-grid strong { color: var(--ac-text-2); font-weight: 700; text-align: right; overflow-wrap: anywhere; }
      .mobile-card-actions { display: flex; justify-content: flex-end; gap: 8px; }
      .mobile-card-actions .tbl-btn { width: 36px; height: 36px; }
    }
    @media (max-width: 620px) {
      .stats-row { grid-template-columns: 1fr; }
      .header-actions, .header-actions .ac-btn { width: 100%; }
      .toolbar-select { min-width: 100%; }
      .mobile-control { grid-template-columns: 1fr; }
    }
    @media (max-width: 380px) {
      .header-actions { grid-template-columns: 1fr; }
      .patient-mobile-card { padding: 12px; }
      .mobile-card-head { flex-direction: column; align-items: stretch; }
      .mobile-card-head .status-badge { width: fit-content; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientListPageComponent implements OnInit, OnDestroy {
  protected readonly patients = signal<PatientSummary[]>([]);
  protected readonly stats = signal<PatientRegistryStats>(emptyStats());
  protected readonly totalCount = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly saving = signal(false);
  protected readonly drawerOpen = signal(false);
  protected readonly drawerMode = signal<PatientDrawerMode>('view');
  protected readonly countryDropdownOpen = signal(false);
  protected readonly form = signal<PatientForm>(createEmptyPatient());
  protected searchQuery = '';
  protected genderFilter = '';
  protected statusFilter = '';

  protected readonly genderOptions = [
    { label: 'All Genders', value: '' },
    { label: 'Male', value: 'MALE' },
    { label: 'Female', value: 'FEMALE' },
    { label: 'Other', value: 'OTHER' }
  ];

  protected readonly statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Checked In', value: 'CHECKED_IN' },
    { label: 'Waiting', value: 'WAITING' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Scheduled', value: 'SCHEDULED' },
    { label: 'Registered', value: 'REGISTERED' }
  ];

  protected readonly bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  protected readonly countryCodeOptions = signal<CountryCodeOption[]>(fallbackCountryCodeOptions);

  protected readonly statCards = computed(() => {
    const current = this.stats();
    return [
      { label: 'Total Patients', value: formatNumber(current.totalPatients), icon: 'people', bg: 'rgba(37,99,235,0.08)', color: '#2563EB' },
      { label: 'Checked In Today', value: formatNumber(current.checkedInToday), icon: 'how_to_reg', bg: 'rgba(16,185,129,0.08)', color: '#10B981' },
      { label: 'New This Month', value: formatNumber(current.newThisMonth), icon: 'person_add', bg: 'rgba(124,58,237,0.08)', color: '#7C3AED' },
      { label: 'Pending Review', value: formatNumber(current.pendingReview), icon: 'pending', bg: 'rgba(245,158,11,0.08)', color: '#F59E0B' }
    ];
  });

  private readonly service = inject(PatientManagementService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private searchDebounceId: ReturnType<typeof setTimeout> | undefined;
  private patientRequestId = 0;

  async ngOnInit(): Promise<void> {
    await this.loadPatients();
  }

  ngOnDestroy(): void {
    this.clearSearchDebounce();
  }

  protected async loadPatients(pageNumber = this.pageNumber()): Promise<void> {
    const requestId = ++this.patientRequestId;
    const response = await this.service.search(this.searchQuery, this.genderFilter, this.statusFilter, pageNumber, this.pageSize());
    if (requestId !== this.patientRequestId) {
      return;
    }

    if (!response.success || !response.data) {
      this.toast.error('Unable to load patients', getApiErrorMessage(response, 'Patient API failed'));
      return;
    }

    this.patients.set(response.data.patients.map(applyCalculatedAge));
    this.stats.set(response.data.stats);
    this.totalCount.set(response.data.totalCount);
    this.pageNumber.set(response.data.pageNumber);
    this.pageSize.set(response.data.pageSize);
  }

  protected clearSearch(): void {
    this.clearSearchDebounce();
    this.searchQuery = '';
    void this.loadPatients(1);
  }

  protected queueSearch(): void {
    this.clearSearchDebounce();
    this.searchDebounceId = setTimeout(() => {
      void this.loadPatients(1);
    }, 300);
  }

  protected runSearchNow(): void {
    this.clearSearchDebounce();
    void this.loadPatients(1);
  }

  protected async changePageSize(pageSize: number): Promise<void> {
    this.clearSearchDebounce();
    this.pageSize.set(pageSize);
    await this.loadPatients(1);
  }

  private clearSearchDebounce(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = undefined;
    }
  }

  protected async startCreate(): Promise<void> {
    const emptyPatient = createEmptyPatient();
    this.form.set(emptyPatient);
    this.drawerMode.set('create');
    this.drawerOpen.set(true);

    const response = await this.service.nextMedicalRecordNo();
    if (response.success && response.data) {
      this.form.set({ ...emptyPatient, medicalRecordNo: response.data.medicalRecordNo });
      return;
    }

    this.toast.warning('MRN preview unavailable', 'MRN will still be generated when the patient is saved.');
  }

  protected async openPatient(patient: PatientSummary, mode: PatientDrawerMode): Promise<void> {
    const response = await this.service.get(patient.patientGuid);
    if (!response.success || !response.data) {
      this.toast.error('Unable to open patient', getApiErrorMessage(response, 'Patient API failed'));
      return;
    }

    this.form.set(mapProfileToForm(response.data));
    this.drawerMode.set(mode);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.countryDropdownOpen.set(false);
    this.drawerOpen.set(false);
  }

  protected isViewMode(): boolean {
    return this.drawerMode() === 'view';
  }

  protected drawerEyebrow(): string {
    return {
      view: 'View patient',
      edit: 'Edit patient',
      create: 'New patient'
    }[this.drawerMode()];
  }

  protected canSave(patient: PatientForm): boolean {
    return Boolean(patient.firstName.trim() && patient.lastName.trim() && patient.mobileNumber.trim());
  }

  protected async save(): Promise<void> {
    if (this.isViewMode()) {
      return;
    }

    if (!this.canSave(this.form())) {
      this.toast.warning('Missing details', 'First name, last name, and mobile number are required.');
      return;
    }

    this.saving.set(true);
    try {
      const patient = this.form();
      const response = patient.patientGuid
        ? await this.service.update(patient)
        : await this.service.create(patient);

      if (!response.success || !response.data) {
        this.toast.error('Unable to save patient', getApiErrorMessage(response, 'Patient API failed'));
        return;
      }

      this.form.set(mapProfileToForm(response.data));
      this.drawerOpen.set(false);
      await this.loadPatients(this.pageNumber());
      this.toast.success('Patient saved');
    } finally {
      this.saving.set(false);
    }
  }

  protected async deletePatient(patient: PatientSummary): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Delete patient?',
      message: `This will remove ${patient.fullName} from the patient registry.`,
      details: 'Patients with appointments, admissions, invoices, or other clinical activity are protected from deletion.',
      confirmText: 'Delete patient',
      cancelText: 'Cancel',
      intent: 'danger',
      icon: 'delete'
    });

    if (!confirmed) {
      return;
    }

    const response = await this.service.delete(patient.patientGuid);
    if (!response.success) {
      this.toast.error('Unable to delete patient', getApiErrorMessage(response, 'Patient API failed'));
      return;
    }

    await this.loadPatients(this.pageNumber());
    this.toast.success('Patient deleted');
  }

  protected drawerTitle(patient: PatientForm): string {
    const name = `${patient.firstName} ${patient.lastName}`.trim();
    return name || 'Register Patient';
  }

  protected displayMobile(patient: PatientForm): string {
    return `${patient.countryDialCode} ${patient.mobileNumber}`.trim();
  }

  protected setCountry(patient: PatientForm, isoCode: string): void {
    const selectedCountry = this.countryCodeOptions().find(country => country.isoCode === isoCode);
    patient.countryIsoCode = isoCode;
    patient.countryDialCode = selectedCountry?.dialCode ?? patient.countryDialCode;
  }

  protected toggleCountryDropdown(event: MouseEvent): void {
    event.stopPropagation();

    if (!this.isViewMode()) {
      this.countryDropdownOpen.update(open => !open);
    }
  }

  protected chooseCountry(patient: PatientForm, isoCode: string): void {
    this.setCountry(patient, isoCode);
    this.countryDropdownOpen.set(false);
  }

  protected flagUrl(isoCode: string | null): string {
    return `https://flagcdn.com/w40/${(isoCode || 'IN').toLowerCase()}.png`;
  }

  protected selectedCountryName(isoCode: string | null): string {
    return this.countryCodeOptions().find(country => country.isoCode === isoCode)?.name ?? 'Country';
  }

  protected initials(patient: PatientSummary): string {
    return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase() || 'PT';
  }

  protected avatarColor(patientGuid: string): string {
    const colors = ['#2563EB', '#DB2777', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'];
    const sum = [...patientGuid].reduce((total, char) => total + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  }

  protected genderClass(genderCode: string | null): string {
    const code = (genderCode ?? '').toLowerCase();
    return code ? `gb-${code}` : 'gb-empty';
  }

  protected statusClass(statusCode: string): string {
    return `sb-${statusCode.toLowerCase().replaceAll('_', '-')}`;
  }

  protected formatVisit(value: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  protected displayPatientAge(patient: PatientSummary): string {
    const age = patient.age;

    if (age === null || age === undefined || age < 0) {
      return '-';
    }

    return `${age} ${age === 1 ? 'yr' : 'yrs'}`;
  }

  protected exportCsv(): void {
    const rows = [
      ['MRN', 'First Name', 'Last Name', 'Mobile', 'Gender', 'Date of Birth', 'Blood Group', 'Last Visit', 'Status'],
      ...this.patients().map(patient => [
        patient.medicalRecordNo,
        patient.firstName,
        patient.lastName,
        patient.mobileNo,
        patient.genderName,
        patient.dateOfBirth ?? '',
        patient.bloodGroupName,
        patient.lastVisitDate ?? '',
        patient.statusName
      ])
    ];
    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  @HostListener('document:click', ['$event'])
  protected closeCountryDropdownFromOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target?.closest('.country-select-shell')) {
      this.countryDropdownOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected closeCountryDropdownWithEscape(): void {
    this.countryDropdownOpen.set(false);
  }
}

function createEmptyPatient(): PatientForm {
  return {
    patientGuid: '',
    medicalRecordNo: '',
    firstName: '',
    lastName: '',
    countryIsoCode: 'IN',
    countryDialCode: '+91',
    mobileNumber: '',
    genderCode: null,
    dateOfBirth: null,
    bloodGroupCode: null,
    rowVersion: null
  };
}

function mapProfileToForm(patient: PatientSummary): PatientForm {
  return {
    patientGuid: patient.patientGuid,
    medicalRecordNo: patient.medicalRecordNo,
    firstName: patient.firstName,
    lastName: patient.lastName,
    ...parseMobile(patient.mobileNo),
    genderCode: patient.genderCode,
    dateOfBirth: patient.dateOfBirth,
    bloodGroupCode: patient.bloodGroupCode,
    rowVersion: patient.rowVersion
  };
}

function emptyStats(): PatientRegistryStats {
  return {
    totalPatients: 0,
    checkedInToday: 0,
    newThisMonth: 0,
    pendingReview: 0
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

function applyCalculatedAge(patient: PatientSummary): PatientSummary {
  const calculatedAge = calculateAge(patient.dateOfBirth);

  return {
    ...patient,
    age: calculatedAge ?? patient.age
  };
}

function calculateAge(dateOfBirth: string | null): number | null {
  const birthDate = parseDateOnly(dateOfBirth);

  if (!birthDate) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const shortDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (shortDateMatch) {
    return new Date(Number(shortDateMatch[3]), Number(shortDateMatch[1]) - 1, Number(shortDateMatch[2]));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

interface CountryCodeOption {
  isoCode: string;
  flag: string;
  name: string;
  dialCode: string;
}

const fallbackCountryCodeOptions: CountryCodeOption[] = [
  { isoCode: 'AE', flag: flagFromIsoCode('AE'), name: 'United Arab Emirates', dialCode: '+971' },
  { isoCode: 'AU', flag: flagFromIsoCode('AU'), name: 'Australia', dialCode: '+61' },
  { isoCode: 'BD', flag: flagFromIsoCode('BD'), name: 'Bangladesh', dialCode: '+880' },
  { isoCode: 'CA', flag: flagFromIsoCode('CA'), name: 'Canada', dialCode: '+1' },
  { isoCode: 'DE', flag: flagFromIsoCode('DE'), name: 'Germany', dialCode: '+49' },
  { isoCode: 'FR', flag: flagFromIsoCode('FR'), name: 'France', dialCode: '+33' },
  { isoCode: 'GB', flag: flagFromIsoCode('GB'), name: 'United Kingdom', dialCode: '+44' },
  { isoCode: 'IN', flag: flagFromIsoCode('IN'), name: 'India', dialCode: '+91' },
  { isoCode: 'JP', flag: flagFromIsoCode('JP'), name: 'Japan', dialCode: '+81' },
  { isoCode: 'LK', flag: flagFromIsoCode('LK'), name: 'Sri Lanka', dialCode: '+94' },
  { isoCode: 'MY', flag: flagFromIsoCode('MY'), name: 'Malaysia', dialCode: '+60' },
  { isoCode: 'NP', flag: flagFromIsoCode('NP'), name: 'Nepal', dialCode: '+977' },
  { isoCode: 'NZ', flag: flagFromIsoCode('NZ'), name: 'New Zealand', dialCode: '+64' },
  { isoCode: 'OM', flag: flagFromIsoCode('OM'), name: 'Oman', dialCode: '+968' },
  { isoCode: 'QA', flag: flagFromIsoCode('QA'), name: 'Qatar', dialCode: '+974' },
  { isoCode: 'SA', flag: flagFromIsoCode('SA'), name: 'Saudi Arabia', dialCode: '+966' },
  { isoCode: 'SG', flag: flagFromIsoCode('SG'), name: 'Singapore', dialCode: '+65' },
  { isoCode: 'US', flag: flagFromIsoCode('US'), name: 'United States', dialCode: '+1' },
  { isoCode: 'ZA', flag: flagFromIsoCode('ZA'), name: 'South Africa', dialCode: '+27' }
];

function flagFromIsoCode(isoCode: string): string {
  return isoCode
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function parseMobile(mobileNo: string): Pick<PatientForm, 'countryIsoCode' | 'countryDialCode' | 'mobileNumber'> {
  const trimmed = mobileNo.trim();
  const matchedCountry = [...fallbackCountryCodeOptions]
    .sort((left, right) => right.dialCode.length - left.dialCode.length)
    .find(country => trimmed.startsWith(country.dialCode));

  if (!matchedCountry) {
    return {
      countryIsoCode: 'IN',
      countryDialCode: '+91',
      mobileNumber: trimmed
    };
  }

  return {
    countryIsoCode: matchedCountry.isoCode,
    countryDialCode: matchedCountry.dialCode,
    mobileNumber: trimmed.slice(matchedCountry.dialCode.length).trim()
  };
}
