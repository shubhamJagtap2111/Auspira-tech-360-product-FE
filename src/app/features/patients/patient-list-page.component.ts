import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AcAdminDrawerComponent } from '../../shared/ui/admin-drawer/admin-drawer.component';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { AcPaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { BranchContextService } from '../../core/context/branch-context.service';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { PatientDuplicate, PatientForm, PatientRegistryStats, PatientSummary } from './patient-management.models';
import { PatientManagementService } from './patient-management.service';

type PatientDrawerMode = 'view' | 'edit' | 'create';
type PatientValidationField = 'firstName' | 'lastName' | 'mobileNumber' | 'dateOfBirth' | 'genderCode' | 'email';
type PatientDatePickerMode = 'calendar' | 'years';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent, AcGridLoaderComponent, AcPaginationComponent, AcAdminDrawerComponent],
  template: `
    <section class="patients">
      <header class="page-header">
        <div>
          <p class="ac-eyebrow">Clinical</p>
          <h1 class="ac-page-title">Patient Registry</h1>
          <p class="page-desc">Tenant-isolated patient master with permanent MRN, demographics, emergency contact, and care context.</p>
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
        <label class="date-filter" title="Registration date">
          <span class="material-symbols-rounded">event</span>
          <input type="date" name="registrationDateFilter" [(ngModel)]="registrationDateFilter" (ngModelChange)="loadPatients(1)" />
        </label>
        <button class="icon-btn" type="button" (click)="loadPatients(1)" title="Refresh">
          <span class="material-symbols-rounded">refresh</span>
        </button>
        <div class="toolbar-count">
          <span>{{ totalCount() }} patients</span>
        </div>
      </section>

      <section class="ac-card table-card ac-admin-layout" [class.drawer-open]="drawerOpen()">
        @if (initialLoading()) {
          <ac-grid-loader title="Loading patient registry..." message="Preparing MRNs, demographics, and patient records." />
        } @else if (patients().length > 0) {
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
                    <td><span class="status-badge" [class]="statusClass(displayStatusCode(patient))">{{ displayStatusName(patient) }}</span></td>
                    <td>
                      <div class="row-actions">
                        <button class="tbl-btn" type="button" title="View profile" (click)="openPatientProfile(patient)">
                          <span class="material-symbols-rounded">visibility</span>
                        </button>
                        <button class="tbl-btn" type="button" title="Edit" (click)="openPatient(patient, 'edit')">
                          <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="tbl-btn" type="button" title="Create appointment" (click)="createAppointment(patient)">
                          <span class="material-symbols-rounded">event_available</span>
                        </button>
                        <button class="tbl-btn" type="button" title="Start OPD visit" (click)="startOpdVisit(patient)">
                          <span class="material-symbols-rounded">clinical_notes</span>
                        </button>
                        <button class="tbl-btn" type="button" title="Admit patient" (click)="admitPatient(patient)">
                          <span class="material-symbols-rounded">bed</span>
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
                  <span class="status-badge" [class]="statusClass(displayStatusCode(patient))">{{ displayStatusName(patient) }}</span>
                </div>
                <div class="mobile-card-grid">
                  <span><small>Mobile</small><strong>{{ patient.mobileNo }}</strong></span>
                  <span><small>Gender</small><strong>{{ patient.genderName || '-' }}</strong></span>
                  <span><small>Last visit</small><strong>{{ formatVisit(patient.lastVisitDate) }}</strong></span>
                </div>
                <div class="mobile-card-actions">
                  <button class="tbl-btn" type="button" title="View profile" (click)="openPatientProfile(patient)">
                    <span class="material-symbols-rounded">visibility</span>
                  </button>
                  <button class="tbl-btn" type="button" title="Edit" (click)="openPatient(patient, 'edit')">
                    <span class="material-symbols-rounded">edit</span>
                  </button>
                  <button class="tbl-btn" type="button" title="Create appointment" (click)="createAppointment(patient)">
                    <span class="material-symbols-rounded">event_available</span>
                  </button>
                  <button class="tbl-btn" type="button" title="Start OPD visit" (click)="startOpdVisit(patient)">
                    <span class="material-symbols-rounded">clinical_notes</span>
                  </button>
                  <button class="tbl-btn" type="button" title="Admit patient" (click)="admitPatient(patient)">
                    <span class="material-symbols-rounded">bed</span>
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
                @if (patientFormSubmitted() && patientValidationErrors(patientForm).length) {
                  <section class="validation-summary" role="alert" aria-live="polite">
                    <span class="material-symbols-rounded">error</span>
                    <div>
                      <strong>Please complete required patient details.</strong>
                      <p>{{ patientValidationErrors(patientForm).join(' ') }}</p>
                    </div>
                  </section>
                }

                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title">
                    <span class="material-symbols-rounded">badge</span>
                    <h3>Basic information</h3>
                  </div>
                  <div class="ac-admin-form-grid">
                    <label>
                      <span>MRN</span>
                      <input name="medicalRecordNo" [(ngModel)]="patientForm.medicalRecordNo" readonly [disabled]="isViewMode()" placeholder="Auto generated" />
                    </label>
                    <label>
                      <span>Status</span>
                      <ac-dropdown name="statusCode" [(ngModel)]="patientForm.statusCode" [disabled]="isViewMode()" [options]="patientStatusOptions" />
                    </label>
                    <label class="mobile-field" [class.invalid]="patientFieldInvalid(patientForm, 'mobileNumber')">
                      <span>Mobile *</span>
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
                        <input class="mobile-number-input" name="mobileNumber" [(ngModel)]="patientForm.mobileNumber" [disabled]="isViewMode()" inputmode="tel" placeholder="8230394902" [attr.aria-invalid]="patientFieldInvalid(patientForm, 'mobileNumber')" />
                      </div>
                      @if (patientFieldInvalid(patientForm, 'mobileNumber')) {
                        <small class="validation-message">{{ patientFieldError(patientForm, 'mobileNumber') }}</small>
                      }
                    </label>
                    <label [class.invalid]="patientFieldInvalid(patientForm, 'firstName')">
                      <span>First name *</span>
                      <input name="firstName" [(ngModel)]="patientForm.firstName" [disabled]="isViewMode()" [attr.aria-invalid]="patientFieldInvalid(patientForm, 'firstName')" />
                      @if (patientFieldInvalid(patientForm, 'firstName')) {
                        <small class="validation-message">{{ patientFieldError(patientForm, 'firstName') }}</small>
                      }
                    </label>
                    <label>
                      <span>Middle name</span>
                      <input name="middleName" [(ngModel)]="patientForm.middleName" [disabled]="isViewMode()" />
                    </label>
                    <label [class.invalid]="patientFieldInvalid(patientForm, 'lastName')">
                      <span>Last name *</span>
                      <input name="lastName" [(ngModel)]="patientForm.lastName" [disabled]="isViewMode()" [attr.aria-invalid]="patientFieldInvalid(patientForm, 'lastName')" />
                      @if (patientFieldInvalid(patientForm, 'lastName')) {
                        <small class="validation-message">{{ patientFieldError(patientForm, 'lastName') }}</small>
                      }
                    </label>
                    <label [class.invalid]="patientFieldInvalid(patientForm, 'dateOfBirth')">
                      <span>Date of birth *</span>
                      <div class="date-picker-shell" [class.open]="patientDobPickerOpen()">
                        <button
                          class="date-trigger"
                          type="button"
                          [disabled]="isViewMode()"
                          [attr.aria-invalid]="patientFieldInvalid(patientForm, 'dateOfBirth')"
                          (click)="togglePatientDobPicker($event, patientForm)">
                          <span class="material-symbols-rounded">calendar_month</span>
                          <strong [class.placeholder]="!patientForm.dateOfBirth">{{ displayPatientDate(patientForm.dateOfBirth) }}</strong>
                          <span class="material-symbols-rounded">expand_more</span>
                        </button>
                        @if (patientDobPickerOpen()) {
                          <div class="modern-date-popover" (click)="$event.stopPropagation()">
                            <div class="date-picker-head">
                              <button type="button" title="Previous month" (click)="movePatientDobMonth(-1)">
                                <span class="material-symbols-rounded">chevron_left</span>
                              </button>
                              <button class="date-title-button" type="button" title="Select year" (click)="togglePatientDobYearPicker()">
                                {{ patientDobCalendarTitle() }}
                              </button>
                              <button type="button" title="Next month" (click)="movePatientDobMonth(1)">
                                <span class="material-symbols-rounded">chevron_right</span>
                              </button>
                            </div>
                            @if (patientDobPickerMode() === 'years') {
                              <div class="date-year-grid" aria-label="Select birth year">
                                @for (year of patientDobYearOptions(patientForm); track year.value) {
                                  <button
                                    type="button"
                                    [class.selected]="year.selected"
                                    [class.current]="year.current"
                                    (click)="selectPatientDobYear(year.value)">
                                    {{ year.value }}
                                  </button>
                                }
                              </div>
                            } @else {
                              <div class="date-weekdays" aria-hidden="true">
                                @for (day of datePickerWeekdays; track day) {
                                  <span>{{ day }}</span>
                                }
                              </div>
                              <div class="date-grid">
                                @for (day of patientDobCalendarDays(patientForm); track day.dateKey) {
                                  <button
                                    type="button"
                                    [class.muted]="!day.currentMonth"
                                    [class.today]="day.isToday"
                                    [class.selected]="day.selected"
                                    [disabled]="day.future || isViewMode()"
                                    (click)="selectPatientDob(patientForm, day.dateKey)">
                                    <span>{{ day.dayNo }}</span>
                                  </button>
                                }
                              </div>
                              <div class="date-picker-actions">
                                <button type="button" (click)="clearPatientDob(patientForm)">Clear</button>
                                <button type="button" (click)="selectPatientDobToday(patientForm)">Today</button>
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (patientFieldInvalid(patientForm, 'dateOfBirth')) {
                        <small class="validation-message">{{ patientFieldError(patientForm, 'dateOfBirth') }}</small>
                      }
                    </label>
                    <label>
                      <span>Age</span>
                      <input [value]="displayFormAge(patientForm)" readonly disabled />
                    </label>
                    <label [class.invalid]="patientFieldInvalid(patientForm, 'genderCode')">
                      <span>Gender *</span>
                      <ac-dropdown name="genderCode" [(ngModel)]="patientForm.genderCode" [disabled]="isViewMode()" [options]="patientGenderOptions" />
                      @if (patientFieldInvalid(patientForm, 'genderCode')) {
                        <small class="validation-message">{{ patientFieldError(patientForm, 'genderCode') }}</small>
                      }
                    </label>
                    <label>
                      <span>Blood group</span>
                      <ac-dropdown name="bloodGroupCode" [(ngModel)]="patientForm.bloodGroupCode" [disabled]="isViewMode()" [options]="patientBloodGroupOptions" />
                    </label>
                  </div>
                </section>

                @if (drawerMode() === 'create' && duplicateMatches().length > 0) {
                  <section class="duplicate-panel">
                    <div class="duplicate-head">
                      <span class="material-symbols-rounded">patient_list</span>
                      <div>
                        <h3>Possible existing patient</h3>
                        <p>Review these matches before creating a new record.</p>
                      </div>
                    </div>
                    <div class="duplicate-list">
                      @for (match of duplicateMatches(); track match.patientGuid) {
                        <button class="duplicate-card" type="button" (click)="openDuplicate(match)">
                          <span class="mrn-chip">{{ match.medicalRecordNo }}</span>
                          <span class="duplicate-name">{{ match.fullName }}</span>
                          <span class="duplicate-meta">{{ match.maskedMobileNo }} · {{ match.matchReason }}</span>
                        </button>
                      }
                    </div>
                    <button class="continue-btn" type="button" (click)="continueRegistration()">
                      Continue as new patient
                    </button>
                  </section>
                }

                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title">
                    <span class="material-symbols-rounded">contact_emergency</span>
                    <h3>Contact details</h3>
                  </div>
                  <div class="ac-admin-form-grid">
                    <label [class.invalid]="patientFieldInvalid(patientForm, 'email')">
                      <span>Email</span>
                      <input type="email" name="email" [(ngModel)]="patientForm.email" [disabled]="isViewMode()" [attr.aria-invalid]="patientFieldInvalid(patientForm, 'email')" />
                      @if (patientFieldInvalid(patientForm, 'email')) {
                        <small class="validation-message">{{ patientFieldError(patientForm, 'email') }}</small>
                      }
                    </label>
                    <label class="span-2">
                      <span>Address</span>
                      <textarea name="address" [(ngModel)]="patientForm.address" [disabled]="isViewMode()" rows="3" maxlength="500"></textarea>
                    </label>
                    <label>
                      <span>City</span>
                      <input name="city" [(ngModel)]="patientForm.city" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>State</span>
                      <input name="state" [(ngModel)]="patientForm.state" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>Country</span>
                      <input name="country" [(ngModel)]="patientForm.country" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>Pincode</span>
                      <input name="pincode" [(ngModel)]="patientForm.pincode" [disabled]="isViewMode()" />
                    </label>
                  </div>
                </section>

                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title">
                    <span class="material-symbols-rounded">contact_emergency</span>
                    <h3>Emergency contact</h3>
                  </div>
                  <div class="ac-admin-form-grid">
                    <label>
                      <span>Contact person</span>
                      <input name="emergencyContactName" [(ngModel)]="patientForm.emergencyContactName" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>Relationship</span>
                      <input name="emergencyContactRelationship" [(ngModel)]="patientForm.emergencyContactRelationship" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>Emergency mobile</span>
                      <input name="emergencyContactMobile" [(ngModel)]="patientForm.emergencyContactMobile" [disabled]="isViewMode()" inputmode="tel" />
                    </label>
                  </div>
                </section>

                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title">
                    <span class="material-symbols-rounded">personal_injury</span>
                    <h3>Medical information</h3>
                  </div>
                  <div class="ac-admin-form-grid">
                    <label class="span-2">
                      <span>Known allergies</span>
                      <textarea name="knownAllergies" [(ngModel)]="patientForm.knownAllergies" [disabled]="isViewMode()" rows="2"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Existing conditions</span>
                      <textarea name="knownConditions" [(ngModel)]="patientForm.knownConditions" [disabled]="isViewMode()" rows="2"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Chronic diseases</span>
                      <textarea name="chronicDiseases" [(ngModel)]="patientForm.chronicDiseases" [disabled]="isViewMode()" rows="2"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Past medical history</span>
                      <textarea name="pastMedicalHistory" [(ngModel)]="patientForm.pastMedicalHistory" [disabled]="isViewMode()" rows="2"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Family history</span>
                      <textarea name="familyHistory" [(ngModel)]="patientForm.familyHistory" [disabled]="isViewMode()" rows="2"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Surgical history</span>
                      <textarea name="surgicalHistory" [(ngModel)]="patientForm.surgicalHistory" [disabled]="isViewMode()" rows="2"></textarea>
                    </label>
                    <label class="span-2">
                      <span>Medical notes</span>
                      <textarea name="medicalNotes" [(ngModel)]="patientForm.medicalNotes" [disabled]="isViewMode()" rows="3"></textarea>
                    </label>
                  </div>
                </section>

                <section class="ac-admin-form-section">
                  <div class="ac-admin-section-title">
                    <span class="material-symbols-rounded">verified_user</span>
                    <h3>Identification & insurance</h3>
                  </div>
                  <div class="ac-admin-form-grid">
                    <label>
                      <span>National ID</span>
                      <input name="nationalId" [(ngModel)]="patientForm.nationalId" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>Insurance provider</span>
                      <input name="insuranceProvider" [(ngModel)]="patientForm.insuranceProvider" [disabled]="isViewMode()" />
                    </label>
                    <label>
                      <span>Insurance number</span>
                      <input name="insuranceNumber" [(ngModel)]="patientForm.insuranceNumber" [disabled]="isViewMode()" />
                    </label>
                  </div>
                </section>

                <section class="system-panel">
                  <div>
                    <small>PatientId</small>
                    <strong>{{ patientForm.patientGuid || 'Generated on save' }}</strong>
                  </div>
                  <div>
                    <small>Registration date</small>
                    <strong>{{ patientForm.patientGuid ? formatVisit(patientForm.createdDate || null) : 'Generated on save' }}</strong>
                  </div>
                  <div>
                    <small>Status</small>
                    <strong>{{ patientForm.statusCode }}</strong>
                  </div>
                </section>
              </div>

              <button drawer-actions class="ac-btn ac-btn-secondary" type="button" (click)="closeDrawer()">Cancel</button>
              <button drawer-actions class="ac-btn ac-btn-primary" type="button" (click)="save()" [disabled]="isViewMode() || saving()">
                <span class="material-symbols-rounded">save</span>
                {{ patientSaveLabel() }}
              </button>
            </ac-admin-drawer>
          }
        }
      </section>
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; }
    .patients { height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 10px; }
    .page-header { flex: 0 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .page-desc { font-size: 13px; line-height: 1.35; color: var(--ac-muted); margin-top: 2px; max-width: 620px; }
    .header-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .stats-row { flex: 0 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .stat-card { display: flex; align-items: center; gap: 10px; padding: 9px 12px; min-height: 58px; }
    .stat-icon { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--ac-r-sm); flex-shrink: 0; }
    .stat-icon .material-symbols-rounded { font-size: 16px; }
    .stat-value { font-size: 18px; line-height: 1; font-weight: 850; color: var(--ac-text); letter-spacing: 0; }
    .stat-label { font-size: 11.5px; color: var(--ac-muted); margin-top: 1px; }
    .toolbar { flex: 0 0 auto; display: flex; align-items: center; gap: 7px; padding: 8px 10px; flex-wrap: wrap; }
    .search-field { position: relative; display: flex; align-items: center; flex: 1; min-width: 240px; }
    .search-icon { position: absolute; left: 12px; color: var(--ac-muted); pointer-events: none; font-size: 18px; }
    .toolbar-input { width: 100%; height: 34px; padding: 0 34px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface-2); color: var(--ac-text); font-size: 13px; outline: none; transition: all var(--ac-t); }
    .toolbar-input:focus { border-color: var(--ac-primary); background: var(--ac-surface); box-shadow: 0 0 0 3px rgba(37,99,235,0.08); }
    .clear-btn { position: absolute; right: 10px; color: var(--ac-muted); cursor: pointer; display: flex; align-items: center; }
    .clear-btn .material-symbols-rounded { font-size: 16px; }
    .toolbar-select { min-width: 140px; }
    .date-filter { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 9px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface); color: var(--ac-muted); }
    .date-filter .material-symbols-rounded { font-size: 18px; }
    .date-filter input { width: 132px; height: 28px; border: 0; background: transparent; color: var(--ac-text); outline: none; font-size: 13px; }
    .toolbar-count { font-size: 12.5px; color: var(--ac-muted); padding: 0 4px; white-space: nowrap; }
    .icon-btn { width: 34px; height: 34px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface); color: var(--ac-muted); display: inline-grid; place-items: center; }
    .icon-btn .material-symbols-rounded { font-size: 19px; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .table-card { flex: 0 1 auto; min-height: 0; overflow: hidden; position: relative; display: flex; flex-direction: column; }
    .table-scroll { flex: 0 1 auto; width: 100%; min-height: 0; max-height: min(58vh, 560px); overflow: auto; }
    .table-scroll .ac-table { width: 100%; min-width: 900px; table-layout: fixed; }
    .table-scroll .ac-table th,
    .table-scroll .ac-table td { padding: 7px 12px; }
    .table-scroll .ac-table th { padding: 8px 12px; font-size: 10.5px; letter-spacing: .05em; }
    .table-scroll .ac-table th:nth-child(1), .table-scroll .ac-table td:nth-child(1) { width: 106px; }
    .table-scroll .ac-table th:nth-child(2), .table-scroll .ac-table td:nth-child(2) { width: 220px; }
    .table-scroll .ac-table th:nth-child(3), .table-scroll .ac-table td:nth-child(3) { width: 170px; }
    .table-scroll .ac-table th:nth-child(4), .table-scroll .ac-table td:nth-child(4) { width: 104px; }
    .table-scroll .ac-table th:nth-child(5), .table-scroll .ac-table td:nth-child(5) { width: 112px; }
    .table-scroll .ac-table th:nth-child(6), .table-scroll .ac-table td:nth-child(6) { width: 124px; }
    .table-scroll .ac-table th:nth-child(7), .table-scroll .ac-table td:nth-child(7) { width: 184px; }
    .mobile-patient-list { display: none; }
    .mrn-chip { font-family: monospace; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: var(--ac-r-sm); background: var(--ac-primary-light); color: var(--ac-primary); }
    .patient-cell { display: flex; align-items: center; gap: 8px; }
    .patient-avatar { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--ac-r-full); font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0; }
    .patient-name { font-size: 13px; font-weight: 600; color: var(--ac-text); }
    .patient-meta { font-size: 11.25px; color: var(--ac-muted); margin-top: 0; }
    .gender-badge, .status-badge { display: inline-flex; padding: 2px 7px; border-radius: var(--ac-r-full); font-size: 11px; font-weight: 700; white-space: nowrap; }
    .gb-male { background: var(--ac-primary-light); color: var(--ac-primary); }
    .gb-female { background: rgba(236,72,153,0.1); color: #db2777; }
    .gb-other { background: var(--ac-secondary-light); color: var(--ac-secondary); }
    .gb-empty { background: var(--ac-surface-2); color: var(--ac-muted); }
    .sb-checked-in { background: var(--ac-primary-light); color: var(--ac-primary); }
    .sb-waiting { background: var(--ac-warning-light); color: var(--ac-warning); }
    .sb-completed { background: var(--ac-success-light); color: var(--ac-success); }
    .sb-scheduled { background: var(--ac-secondary-light); color: var(--ac-secondary); }
    .sb-registered { background: var(--ac-info-light); color: var(--ac-info); }
    .sb-active { background: var(--ac-success-light); color: var(--ac-success); }
    .sb-opd { background: rgba(37,99,235,0.1); color: #1d4ed8; }
    .sb-ipd { background: rgba(20,184,166,0.12); color: #0f766e; }
    .sb-discharged { background: rgba(100,116,139,0.12); color: #475569; }
    .sb-inactive { background: var(--ac-warning-light); color: var(--ac-warning); }
    .sb-archived { background: var(--ac-surface-2); color: var(--ac-muted); }
    .row-actions { display: flex; gap: 5px; }
    .tbl-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--ac-r-sm); border: 1px solid var(--ac-border); background: var(--ac-surface); color: var(--ac-muted); cursor: pointer; transition: all var(--ac-t); }
    .tbl-btn .material-symbols-rounded { font-size: 15px; }
    .tbl-btn:hover { background: var(--ac-surface-2); color: var(--ac-text); }
    .tbl-btn.danger:hover { color: var(--ac-error); border-color: color-mix(in srgb, var(--ac-error) 32%, var(--ac-border)); background: var(--ac-error-light); }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 240px; padding: 34px 24px; text-align: center; }
    .empty-icon { display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 18px; background: var(--ac-surface-2); }
    .empty-icon .material-symbols-rounded { font-size: 40px; color: var(--ac-muted-2); }
    .empty-title { font-size: 16px; font-weight: 700; color: var(--ac-text); }
    .empty-desc { font-size: 13.5px; color: var(--ac-muted); max-width: 340px; }
    input[readonly] { background: var(--ac-surface-2); color: var(--ac-text-2); cursor: not-allowed; font-weight: 800; }
    textarea { min-height: 86px; resize: vertical; }
    .system-panel { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 12px; border: 1px dashed var(--ac-border); border-radius: var(--ac-r); background: var(--ac-surface-2); }
    .system-panel div { min-width: 0; }
    .system-panel small { display: block; color: var(--ac-muted); font-weight: 800; }
    .system-panel strong { display: block; margin-top: 4px; color: var(--ac-text); font-size: 12.5px; overflow-wrap: anywhere; }
    .span-2 { grid-column: 1 / -1; }
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
    .date-picker-shell { position: relative; min-width: 0; }
    .date-trigger {
      width: 100%;
      min-height: 46px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 0 12px;
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-sm);
      background: var(--ac-surface);
      color: var(--ac-text);
      text-align: left;
      font: inherit;
      cursor: pointer;
      transition: border-color var(--ac-t), box-shadow var(--ac-t), background var(--ac-t);
    }
    .date-trigger:hover { border-color: color-mix(in srgb, var(--ac-primary) 45%, var(--ac-border)); }
    .date-picker-shell.open .date-trigger {
      border-color: var(--ac-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent);
    }
    .date-trigger:disabled { cursor: not-allowed; opacity: .72; }
    .date-trigger .material-symbols-rounded { color: var(--ac-muted); font-size: 20px; }
    .date-trigger strong { min-width: 0; color: var(--ac-text); font-size: 13.5px; font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .date-trigger strong.placeholder { color: var(--ac-muted); font-weight: 750; }
    .modern-date-popover {
      position: absolute;
      left: 0;
      top: calc(100% + 8px);
      z-index: 140;
      width: min(292px, calc(100vw - 40px));
      display: grid;
      gap: 9px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 84%, transparent);
      border-radius: 14px;
      background: var(--ac-surface);
      box-shadow: 0 18px 42px rgba(15,23,42,.16);
    }
    .date-picker-head {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr) 30px;
      align-items: center;
      gap: 6px;
    }
    .date-picker-head button,
    .date-picker-actions button,
    .date-picker-year-jump button {
      border: 0;
      background: transparent;
      color: var(--ac-muted);
      font: inherit;
      cursor: pointer;
    }
    .date-picker-head > button:not(.date-title-button) {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 999px;
    }
    .date-title-button {
      min-width: 0;
      min-height: 30px;
      padding: 0 8px;
      border-radius: 999px;
      color: var(--ac-text) !important;
      text-align: center;
      font-size: 14px !important;
      font-weight: 900;
    }
    .date-title-button:hover,
    .date-picker-head > button:not(.date-title-button):hover,
    .date-picker-year-jump button:hover {
      background: var(--ac-subtle);
      color: var(--ac-text);
    }
    .date-picker-year-jump { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .date-picker-year-jump button {
      min-height: 30px;
      border-radius: 999px;
      background: var(--ac-subtle);
      font-size: 11.5px;
      font-weight: 850;
    }
    .date-weekdays,
    .date-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .date-weekdays span {
      color: var(--ac-muted);
      text-align: center;
      font-size: 11px;
      font-weight: 900;
    }
    .date-grid button {
      position: relative;
      min-width: 0;
      width: 100%;
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--ac-text);
      font: inherit;
      font-size: 12px;
      font-weight: 780;
      cursor: pointer;
    }
    .date-grid button:hover:not(:disabled) { background: var(--ac-subtle); }
    .date-grid button.muted { color: color-mix(in srgb, var(--ac-muted) 72%, transparent); }
    .date-grid button.selected { background: #111827; color: #ffffff; font-weight: 950; box-shadow: 0 12px 24px rgba(15,23,42,.2); }
    .date-grid button.today:not(.selected)::after {
      content: '';
      position: absolute;
      bottom: 5px;
      width: 4px;
      height: 4px;
      border-radius: 999px;
      background: var(--ac-primary);
    }
    .date-grid button:disabled { color: color-mix(in srgb, var(--ac-muted) 38%, transparent); cursor: not-allowed; }
    .date-year-grid {
      max-height: 214px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      padding-right: 2px;
    }
    .date-year-grid button {
      min-height: 32px;
      border: 1px solid var(--ac-border);
      border-radius: 9px;
      background: var(--ac-surface);
      color: var(--ac-text);
      font: inherit;
      font-size: 12px;
      font-weight: 850;
      cursor: pointer;
    }
    .date-year-grid button:hover {
      border-color: color-mix(in srgb, var(--ac-primary) 38%, var(--ac-border));
      background: var(--ac-primary-light);
      color: var(--ac-primary);
    }
    .date-year-grid button.current { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ac-primary) 18%, transparent); }
    .date-year-grid button.selected {
      border-color: #111827;
      background: #111827;
      color: #ffffff;
    }
    .date-picker-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 0; }
    .date-picker-actions button { min-height: 26px; padding: 0 6px; color: var(--ac-primary); font-size: 11.5px; font-weight: 900; }
    label.invalid > span { color: var(--ac-error); }
    label.invalid input,
    label.invalid textarea,
    label.invalid .country-trigger,
    label.invalid .date-trigger,
    label.invalid ac-dropdown {
      border-color: color-mix(in srgb, var(--ac-error) 72%, var(--ac-border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-error) 13%, transparent);
    }
    label.invalid input,
    label.invalid textarea,
    label.invalid .date-trigger {
      background: color-mix(in srgb, var(--ac-error) 4%, var(--ac-surface));
    }
    .validation-summary {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 10px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--ac-error) 46%, var(--ac-border));
      border-radius: var(--ac-r-sm);
      background: color-mix(in srgb, var(--ac-error) 7%, var(--ac-surface));
      color: var(--ac-text);
    }
    .validation-summary > .material-symbols-rounded {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: var(--ac-r-sm);
      background: color-mix(in srgb, var(--ac-error) 12%, var(--ac-surface));
      color: var(--ac-error);
      font-size: 20px;
    }
    .validation-summary strong { display: block; color: var(--ac-error); font-size: 13px; }
    .validation-summary p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12px; line-height: 1.35; }
    .validation-message {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
      color: var(--ac-error);
      font-size: 11.5px;
      font-weight: 800;
      line-height: 1.25;
    }
    .validation-message::before {
      content: 'error';
      font-family: 'Material Symbols Rounded';
      font-size: 15px;
      font-weight: 400;
      line-height: 1;
    }
    .duplicate-panel { display: grid; gap: 12px; padding: 14px; border: 1px solid rgba(245,158,11,0.28); border-radius: var(--ac-r); background: linear-gradient(135deg, rgba(255,251,235,0.92), rgba(255,255,255,0.86)); }
    :host-context([data-theme='dark']) .duplicate-panel { background: linear-gradient(135deg, rgba(69,43,9,0.42), rgba(17,24,39,0.92)); border-color: rgba(245,158,11,0.36); }
    .duplicate-head { display: flex; gap: 10px; align-items: flex-start; }
    .duplicate-head > .material-symbols-rounded { width: 36px; height: 36px; display: grid; place-items: center; border-radius: var(--ac-r-sm); color: #d97706; background: rgba(245,158,11,0.12); }
    .duplicate-head h3 { font-size: 15px; color: var(--ac-text); margin: 0; }
    .duplicate-head p { margin: 3px 0 0; color: var(--ac-muted); font-size: 12.5px; }
    .duplicate-list { display: grid; gap: 8px; }
    .duplicate-card { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 10px; width: 100%; padding: 10px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface); text-align: left; cursor: pointer; }
    .duplicate-card:hover { border-color: color-mix(in srgb, var(--ac-primary) 38%, var(--ac-border)); box-shadow: var(--ac-sh-sm); }
    .duplicate-name { color: var(--ac-text); font-weight: 800; }
    .duplicate-meta { grid-column: 2; color: var(--ac-muted); font-size: 12px; }
    .continue-btn { justify-self: end; color: var(--ac-primary); font-weight: 800; font-size: 12.5px; }
    @media (max-width: 900px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 760px) {
      :host { height: auto; min-height: 100%; }
      .patients { height: auto; min-height: auto; overflow: visible; gap: 14px; }
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
      .modern-date-popover {
        position: fixed;
        left: 16px;
        right: 16px;
        top: auto;
        bottom: 78px;
        width: auto;
      }
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
  protected readonly initialLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly drawerOpen = signal(false);
  protected readonly drawerMode = signal<PatientDrawerMode>('view');
  protected readonly countryDropdownOpen = signal(false);
  protected readonly patientDobPickerOpen = signal(false);
  protected readonly patientDobPickerMode = signal<PatientDatePickerMode>('calendar');
  protected readonly patientDobCalendarMonth = signal(startOfMonth(new Date()));
  protected readonly duplicateMatches = signal<PatientDuplicate[]>([]);
  protected readonly patientFormSubmitted = signal(false);
  private readonly duplicateOverride = signal(false);
  protected readonly form = signal<PatientForm>(createEmptyPatient());
  protected searchQuery = '';
  protected genderFilter = '';
  protected statusFilter = '';
  protected registrationDateFilter = '';

  protected readonly genderOptions: DropdownOption<string>[] = [
    { label: 'All Genders', value: '' },
    { label: 'Male', value: 'MALE' },
    { label: 'Female', value: 'FEMALE' },
    { label: 'Other', value: 'OTHER' }
  ];

  protected readonly statusOptions: DropdownOption<string>[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Registered', value: 'REGISTERED' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'Archived', value: 'ARCHIVED' }
  ];

  protected readonly bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  protected readonly patientStatusOptions: DropdownOption<string>[] = this.statusOptions.filter(option => option.value !== '');
  protected readonly patientGenderOptions: DropdownOption<string | null>[] = [
    { label: 'Select gender', value: null },
    ...this.genderOptions.filter(option => option.value !== '')
  ];
  protected readonly patientBloodGroupOptions: DropdownOption<string | null>[] = [
    { label: 'Not specified', value: null },
    ...this.bloodGroupOptions.map(bloodGroup => ({ label: bloodGroup, value: bloodGroup }))
  ];
  protected readonly countryCodeOptions = signal<CountryCodeOption[]>(fallbackCountryCodeOptions);
  protected readonly datePickerWeekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

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
  private readonly router = inject(Router);
  private readonly branchContext = inject(BranchContextService);
  private searchDebounceId: ReturnType<typeof setTimeout> | undefined;
  private patientRequestId = 0;
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
      untracked(() => void this.loadPatients(1));
    }
  });

  async ngOnInit(): Promise<void> {
    this.initialLoading.set(true);
    try {
      await this.branchContext.loadBranches();
      this.lastBranchCode = this.branchContext.selectedBranchCode();
      this.branchReloadReady = true;
      await this.loadPatients();
    } finally {
      this.initialLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.clearSearchDebounce();
  }

  protected async loadPatients(pageNumber = this.pageNumber()): Promise<void> {
    const requestId = ++this.patientRequestId;
    const response = await this.service.search(
      this.searchQuery,
      this.genderFilter,
      this.statusFilter,
      this.branchContext.selectedBranchCode() ?? '',
      this.registrationDateFilter,
      pageNumber,
      this.pageSize()
    );
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
    this.duplicateMatches.set([]);
    this.duplicateOverride.set(false);
    this.patientFormSubmitted.set(false);
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

  protected async openPatientProfile(patient: PatientSummary): Promise<void> {
    await this.router.navigate(['/patients', patient.patientGuid]);
  }

  protected async createAppointment(patient: PatientSummary): Promise<void> {
    await this.router.navigate(['/appointments'], { queryParams: { patientGuid: patient.patientGuid, mrn: patient.medicalRecordNo, action: 'create' } });
  }

  protected async startOpdVisit(patient: PatientSummary): Promise<void> {
    await this.router.navigate(['/opd'], { queryParams: { patientGuid: patient.patientGuid, mrn: patient.medicalRecordNo, action: 'start-visit' } });
  }

  protected async admitPatient(patient: PatientSummary): Promise<void> {
    await this.router.navigate(['/ipd'], { queryParams: { patientGuid: patient.patientGuid, mrn: patient.medicalRecordNo, action: 'admit' } });
  }

  protected async openPatient(patient: PatientSummary, mode: PatientDrawerMode): Promise<void> {
    const response = await this.service.get(patient.patientGuid);
    if (!response.success || !response.data) {
      this.toast.error('Unable to open patient', getApiErrorMessage(response, 'Patient API failed'));
      return;
    }

    this.form.set(mapProfileToForm(response.data));
    this.patientFormSubmitted.set(false);
    this.drawerMode.set(mode);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.countryDropdownOpen.set(false);
    this.duplicateMatches.set([]);
    this.duplicateOverride.set(false);
    this.patientFormSubmitted.set(false);
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

  protected patientSaveLabel(): string {
    if (this.saving()) {
      return this.drawerMode() === 'edit' ? 'Updating patient...' : 'Saving patient...';
    }

    return this.drawerMode() === 'edit' ? 'Update Patient' : 'Save Patient';
  }

  protected canSave(patient: PatientForm): boolean {
    return getPatientValidationErrors(patient).length === 0;
  }

  protected patientValidationErrors(patient: PatientForm): string[] {
    return getPatientValidationErrors(patient).map(error => error.message);
  }

  protected patientFieldInvalid(patient: PatientForm, field: PatientValidationField): boolean {
    return this.patientFormSubmitted() && Boolean(getPatientFieldError(patient, field));
  }

  protected patientFieldError(patient: PatientForm, field: PatientValidationField): string {
    return getPatientFieldError(patient, field)?.message ?? '';
  }

  protected async save(): Promise<void> {
    if (this.isViewMode() || this.saving()) {
      return;
    }

    this.patientFormSubmitted.set(true);
    if (!this.canSave(this.form())) {
      this.focusFirstInvalidPatientField();
      this.toast.warning('Missing details', getPatientValidationErrors(this.form())[0]?.message ?? 'Complete required patient details.');
      return;
    }

    this.saving.set(true);
    try {
      const patient = this.form();
      if (!patient.patientGuid && !this.duplicateOverride()) {
        const duplicateResponse = await this.service.checkDuplicates(patient);
        if (duplicateResponse.success && duplicateResponse.data?.matches.length) {
          this.duplicateMatches.set(duplicateResponse.data.matches);
          this.toast.warning('Possible duplicate found', 'Review existing patients before continuing.');
          return;
        }
      }

      const response = patient.patientGuid
        ? await this.service.update(patient)
        : await this.service.create(patient);

      if (!response.success || !response.data) {
        this.toast.error('Unable to save patient', getApiErrorMessage(response, 'Patient API failed'));
        return;
      }

      const wasCreate = !patient.patientGuid;
      this.form.set(mapProfileToForm(response.data));
      this.upsertPatient(response.data, wasCreate);
      this.patientFormSubmitted.set(false);
      this.drawerOpen.set(false);
      this.toast.success('Patient saved');
    } finally {
      this.saving.set(false);
    }
  }

  protected async openDuplicate(match: PatientDuplicate): Promise<void> {
    this.closeDrawer();
    await this.router.navigate(['/patients', match.patientGuid]);
  }

  protected async continueRegistration(): Promise<void> {
    this.duplicateOverride.set(true);
    this.duplicateMatches.set([]);
    await this.save();
  }

  private focusFirstInvalidPatientField(): void {
    setTimeout(() => {
      const firstInvalidControl = document.querySelector<HTMLElement>(
        '.ac-admin-drawer-content label.invalid input:not([disabled]), .ac-admin-drawer-content label.invalid textarea:not([disabled]), .ac-admin-drawer-content label.invalid button:not([disabled])'
      );
      firstInvalidControl?.focus();
      firstInvalidControl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
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

    this.removePatient(patient);
    this.toast.success('Patient deleted');
  }

  private upsertPatient(patient: PatientSummary, isNew: boolean): void {
    const nextPatient = applyCalculatedAge(patient);
    this.patients.update(patients => {
      const existingIndex = patients.findIndex(item => item.patientGuid === nextPatient.patientGuid);
      if (existingIndex >= 0) {
        return patients.map(item => item.patientGuid === nextPatient.patientGuid ? nextPatient : item);
      }

      const nextPatients = [nextPatient, ...patients];
      return nextPatients.slice(0, this.pageSize());
    });

    if (isNew) {
      this.totalCount.update(count => count + 1);
      this.stats.update(stats => ({
        ...stats,
        totalPatients: stats.totalPatients + 1,
        newThisMonth: isCurrentMonth(nextPatient.createdDate) ? stats.newThisMonth + 1 : stats.newThisMonth
      }));
    }
  }

  private removePatient(patient: PatientSummary): void {
    this.patients.update(patients => patients.filter(item => item.patientGuid !== patient.patientGuid));
    this.totalCount.update(count => Math.max(0, count - 1));
    this.stats.update(stats => ({
      ...stats,
      totalPatients: Math.max(0, stats.totalPatients - 1),
      newThisMonth: isCurrentMonth(patient.createdDate) ? Math.max(0, stats.newThisMonth - 1) : stats.newThisMonth
    }));
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

  protected togglePatientDobPicker(event: MouseEvent, patient: PatientForm): void {
    event.stopPropagation();

    if (this.isViewMode()) {
      return;
    }

    this.countryDropdownOpen.set(false);
    const selectedDate = parseDateOnly(patient.dateOfBirth);
    this.patientDobCalendarMonth.set(startOfMonth(selectedDate ?? new Date()));
    this.patientDobPickerMode.set('calendar');
    this.patientDobPickerOpen.update(open => !open);
  }

  protected movePatientDobMonth(months: number): void {
    this.patientDobPickerMode.set('calendar');
    this.patientDobCalendarMonth.update(month => addMonths(month, months));
  }

  protected patientDobCalendarTitle(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.patientDobCalendarMonth());
  }

  protected togglePatientDobYearPicker(): void {
    this.patientDobPickerMode.update(mode => mode === 'years' ? 'calendar' : 'years');
  }

  protected patientDobYearOptions(patient: PatientForm): DatePickerYear[] {
    return buildDatePickerYears(this.patientDobCalendarMonth(), patient.dateOfBirth);
  }

  protected patientDobCalendarDays(patient: PatientForm): DatePickerDay[] {
    return buildDatePickerDays(this.patientDobCalendarMonth(), patient.dateOfBirth);
  }

  protected selectPatientDobYear(year: number): void {
    this.patientDobCalendarMonth.update(month => clampDobCalendarMonth(new Date(year, month.getMonth(), 1)));
    this.patientDobPickerMode.set('calendar');
  }

  protected selectPatientDob(patient: PatientForm, dateKey: string): void {
    patient.dateOfBirth = dateKey;
    this.patientDobPickerOpen.set(false);
  }

  protected selectPatientDobToday(patient: PatientForm): void {
    this.selectPatientDob(patient, inputDateValue(new Date()));
  }

  protected clearPatientDob(patient: PatientForm): void {
    patient.dateOfBirth = null;
    this.patientDobPickerMode.set('calendar');
    this.patientDobPickerOpen.set(false);
  }

  protected displayPatientDate(value: string | null): string {
    const date = parseDateOnly(value);
    if (!date) {
      return 'mm/dd/yyyy';
    }

    return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date);
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

  protected displayStatusCode(patient: PatientSummary): string {
    return patient.careStatusCode || patient.statusCode || 'REGISTERED';
  }

  protected displayStatusName(patient: PatientSummary): string {
    return patient.careStatusName || patient.statusName || 'Registered';
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

  protected displayFormAge(patient: PatientForm): string {
    const age = calculateAge(patient.dateOfBirth);
    return age === null ? 'Auto-calculated' : `${age} ${age === 1 ? 'yr' : 'yrs'}`;
  }

  protected exportCsv(): void {
    const rows = [
      ['MRN', 'First Name', 'Middle Name', 'Last Name', 'Mobile', 'Email', 'Address', 'City', 'State', 'Country', 'Pincode', 'Emergency Contact', 'Emergency Relationship', 'Emergency Mobile', 'Gender', 'Date of Birth', 'Blood Group', 'National ID', 'Insurance Provider', 'Insurance Number', 'Registration Date', 'Last Visit', 'Status'],
      ...this.patients().map(patient => [
        patient.medicalRecordNo,
        patient.firstName,
        patient.middleName ?? '',
        patient.lastName,
        patient.mobileNo,
        patient.email ?? '',
        patient.address ?? '',
        patient.city ?? '',
        patient.state ?? '',
        patient.country ?? '',
        patient.pincode ?? '',
        patient.emergencyContactName ?? '',
        patient.emergencyContactRelationship ?? '',
        patient.emergencyContactMobile ?? '',
        patient.genderName,
        patient.dateOfBirth ?? '',
        patient.bloodGroupName,
        patient.nationalId ?? '',
        patient.insuranceProvider ?? '',
        patient.insuranceNumber ?? '',
        patient.createdDate ?? '',
        patient.lastVisitDate ?? '',
        this.displayStatusName(patient)
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

    if (!target?.closest('.date-picker-shell')) {
      this.patientDobPickerOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected closeCountryDropdownWithEscape(): void {
    this.countryDropdownOpen.set(false);
    this.patientDobPickerOpen.set(false);
  }
}

function createEmptyPatient(): PatientForm {
  return {
    patientGuid: '',
    medicalRecordNo: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    countryIsoCode: 'IN',
    countryDialCode: '+91',
    mobileNumber: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactMobile: '',
    genderCode: null,
    dateOfBirth: null,
    bloodGroupCode: null,
    knownAllergies: '',
    knownConditions: '',
    chronicDiseases: '',
    pastMedicalHistory: '',
    familyHistory: '',
    surgicalHistory: '',
    medicalNotes: '',
    nationalId: '',
    insuranceProvider: '',
    insuranceNumber: '',
    statusCode: 'REGISTERED',
    createdDate: null,
    rowVersion: null
  };
}

function mapProfileToForm(patient: PatientSummary): PatientForm {
  return {
    patientGuid: patient.patientGuid,
    medicalRecordNo: patient.medicalRecordNo,
    firstName: patient.firstName,
    middleName: patient.middleName ?? '',
    lastName: patient.lastName,
    email: patient.email ?? '',
    ...parseMobile(patient.mobileNo),
    address: patient.address ?? '',
    city: patient.city ?? '',
    state: patient.state ?? '',
    country: patient.country ?? '',
    pincode: patient.pincode ?? '',
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactRelationship: patient.emergencyContactRelationship ?? '',
    emergencyContactMobile: patient.emergencyContactMobile ?? '',
    genderCode: patient.genderCode,
    dateOfBirth: patient.dateOfBirth,
    bloodGroupCode: patient.bloodGroupCode,
    knownAllergies: patient.knownAllergies ?? '',
    knownConditions: patient.knownConditions ?? '',
    chronicDiseases: patient.chronicDiseases ?? '',
    pastMedicalHistory: patient.pastMedicalHistory ?? '',
    familyHistory: patient.familyHistory ?? '',
    surgicalHistory: patient.surgicalHistory ?? '',
    medicalNotes: patient.medicalNotes ?? '',
    nationalId: patient.nationalId ?? '',
    insuranceProvider: patient.insuranceProvider ?? '',
    insuranceNumber: patient.insuranceNumber ?? '',
    statusCode: patient.statusCode || 'REGISTERED',
    createdDate: patient.createdDate,
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

function isCurrentMonth(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const now = new Date();
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
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
    return strictDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const shortDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (shortDateMatch) {
    return strictDate(Number(shortDateMatch[3]), Number(shortDateMatch[1]), Number(shortDateMatch[2]));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface DatePickerDay {
  dateKey: string;
  dayNo: string;
  currentMonth: boolean;
  selected: boolean;
  isToday: boolean;
  future: boolean;
}

interface DatePickerYear {
  value: number;
  selected: boolean;
  current: boolean;
}

function strictDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValid ? date : null;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  return startOfMonth(next);
}

function clampDobCalendarMonth(date: Date): Date {
  const today = new Date();
  const month = startOfMonth(date);
  const currentMonth = startOfMonth(today);
  return month.getTime() > currentMonth.getTime() ? currentMonth : month;
}

function inputDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDatePickerDays(monthDate: Date, selectedValue: string | null): DatePickerDay[] {
  const monthStart = startOfMonth(monthDate);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - mondayOffset);

  const selectedDate = parseDateOnly(selectedValue);
  const selectedKey = selectedDate ? inputDateValue(selectedDate) : '';
  const todayKey = inputDateValue(new Date());
  const todayStart = parseDateOnly(todayKey) ?? new Date();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    date.setHours(0, 0, 0, 0);
    const dateKey = inputDateValue(date);

    return {
      dateKey,
      dayNo: `${date.getDate()}`,
      currentMonth: date.getMonth() === monthStart.getMonth() && date.getFullYear() === monthStart.getFullYear(),
      selected: dateKey === selectedKey,
      isToday: dateKey === todayKey,
      future: date.getTime() > todayStart.getTime()
    };
  });
}

function buildDatePickerYears(monthDate: Date, selectedValue: string | null): DatePickerYear[] {
  const currentYear = new Date().getFullYear();
  const selectedYear = parseDateOnly(selectedValue)?.getFullYear() ?? null;
  const focusedYear = monthDate.getFullYear();

  return Array.from({ length: 121 }, (_, index) => {
    const value = currentYear - index;
    return {
      value,
      selected: selectedYear === value || (!selectedYear && focusedYear === value),
      current: currentYear === value
    };
  });
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

interface PatientValidationError {
  field: PatientValidationField;
  message: string;
}

function getPatientValidationErrors(patient: PatientForm): PatientValidationError[] {
  const errors: PatientValidationError[] = [];
  const mobileDigits = patient.mobileNumber.replace(/\D/g, '');

  if (!patient.firstName.trim()) {
    errors.push({ field: 'firstName', message: 'First name is required.' });
  }

  if (!patient.lastName.trim()) {
    errors.push({ field: 'lastName', message: 'Last name is required.' });
  }

  if (!patient.mobileNumber.trim()) {
    errors.push({ field: 'mobileNumber', message: 'Mobile number is required.' });
  } else if (mobileDigits.length < 6 || mobileDigits.length > 15) {
    errors.push({ field: 'mobileNumber', message: 'Enter a valid mobile number.' });
  }

  if (!patient.dateOfBirth) {
    errors.push({ field: 'dateOfBirth', message: 'Date of birth is required.' });
  } else {
    const dateOfBirth = parseDateOnly(patient.dateOfBirth);
    const today = parseDateOnly(inputDateValue(new Date())) ?? new Date();

    if (!dateOfBirth) {
      errors.push({ field: 'dateOfBirth', message: 'Enter a valid date of birth.' });
    } else if (dateOfBirth.getTime() > today.getTime()) {
      errors.push({ field: 'dateOfBirth', message: 'Date of birth cannot be in the future.' });
    }
  }

  if (!patient.genderCode) {
    errors.push({ field: 'genderCode', message: 'Gender is required.' });
  }

  if (patient.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email.trim())) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  return errors;
}

function getPatientFieldError(patient: PatientForm, field: PatientValidationField): PatientValidationError | null {
  return getPatientValidationErrors(patient).find(error => error.field === field) ?? null;
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
