import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { DialogFieldOption, DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { AcPageActionsComponent } from '../../shared/ui/page-actions/page-actions.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PatientAllergy, PatientConnectedRecord, PatientProfile, PatientProfileOverview } from './patient-management.models';
import { PatientAllergyRecord } from './patient-management.service';
import { PatientManagementService } from './patient-management.service';

type PatientProfileTab = 'overview' | 'personal' | 'medical' | 'allergies' | 'insurance' | 'documents' | 'appointments' | 'opd' | 'ipd' | 'prescriptions' | 'lab-results' | 'billing' | 'activity';

@Component({
  standalone: true,
  imports: [CommonModule, AcGridLoaderComponent, AcPageActionsComponent],
  template: `
    <section class="patient-profile">
      <ac-page-actions backLink="/patients" backLabel="Patient Registry" (refreshed)="reload()" />

      @if (loading()) {
        <div class="ac-card">
          <ac-grid-loader title="Loading patient profile..." message="Preparing Patient 360 timeline, clinical records, and billing context." [compact]="true" />
        </div>
      } @else if (patient(); as currentPatient) {
        <section class="patient-summary-card ac-card">
          <div class="hero-card">
            <div class="hero-main">
              <div class="patient-avatar" [style.background]="avatarColor(currentPatient.patientGuid)">{{ initials(currentPatient) }}</div>
              <div>
                <p class="ac-eyebrow">Patient 360</p>
                <h1 class="ac-page-title">{{ currentPatient.fullName }}</h1>
                <div class="hero-pills">
                  <span class="pill strong"># {{ currentPatient.medicalRecordNo }}</span>
                  <span class="pill">{{ displayAge(currentPatient.age) }}</span>
                  <span class="pill">{{ currentPatient.genderName }}</span>
                  <span class="pill">{{ currentPatient.bloodGroupName }}</span>
                  <span class="pill">{{ currentPatient.mobileNo }}</span>
                </div>
              </div>
            </div>
            <div class="hero-status">
              <span class="status-dot"></span>
              <strong>{{ displayCareStatusName(currentPatient) }}</strong>
              <small>Registered {{ formatDate(currentPatient.createdDate) }}</small>
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

        <nav class="tab-bar ac-card" aria-label="Patient profile sections">
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
                      <p class="ac-eyebrow">Patient snapshot</p>
                      <h2>Care summary</h2>
                    </div>
                  </div>
                  <div class="detail-grid overview-detail-grid">
                    <span class="detail-tile"><small>MRN</small><strong>{{ currentPatient.medicalRecordNo }}</strong><em>Master record</em></span>
                    <span class="detail-tile"><small>Current status</small><strong>{{ displayCareStatusName(currentPatient) }}</strong><em>Current care journey</em></span>
                    <span class="detail-tile"><small>Date of birth</small><strong>{{ currentPatient.dateOfBirth ? formatDate(currentPatient.dateOfBirth) : '-' }}</strong><em>{{ displayAge(currentPatient.age) }}</em></span>
                    <span class="detail-tile"><small>Address</small><strong>{{ currentPatient.address || '-' }}</strong><em>Registered address</em></span>
                    <span class="detail-tile"><small>Emergency contact</small><strong>{{ emergencyContact(currentPatient) }}</strong><em>Patient support</em></span>
                    <span class="detail-tile"><small>Last visit</small><strong>{{ formatDateTime(currentPatient.lastVisitDate) }}</strong><em>Clinical touchpoint</em></span>
                    <span class="detail-tile"><small>Upcoming appointment</small><strong>{{ currentPatient.overview.upcomingAppointments }}</strong><em>Scheduled care</em></span>
                    <span class="detail-tile"><small>Active admission</small><strong>{{ currentPatient.overview.activeAdmissions }}</strong><em>IPD status</em></span>
                    <span class="detail-tile"><small>Critical alerts</small><strong>{{ criticalAlerts(currentPatient) }}</strong><em>Safety watch</em></span>
                    <span class="detail-tile"><small>Outstanding</small><strong>{{ currency(currentPatient.billingSummary.outstandingBalance) }}</strong><em>Billing exposure</em></span>
                  </div>
                </article>
                <article class="overview-panel flags-panel">
                  <div class="panel-title">
                    <span class="panel-icon warning-icon material-symbols-rounded">health_and_safety</span>
                    <div>
                      <p class="ac-eyebrow">Safety watch</p>
                      <h2>Clinical flags</h2>
                    </div>
                  </div>

                  <div class="safety-overview" [class.clear]="currentPatient.allergies.length === 0 && criticalAlerts(currentPatient) === 0">
                    <span class="material-symbols-rounded">{{ currentPatient.allergies.length > 0 || criticalAlerts(currentPatient) > 0 ? 'warning' : 'verified_user' }}</span>
                    <div>
                      <strong>{{ currentPatient.allergies.length > 0 || criticalAlerts(currentPatient) > 0 ? 'Review before consultation' : 'No active safety alerts' }}</strong>
                      <p>{{ currentPatient.allergies.length > 0 ? currentPatient.allergies.length + ' allergy record(s) need clinical attention.' : 'Allergy and safety watch is clear for this patient.' }}</p>
                    </div>
                    <small>{{ criticalAlerts(currentPatient) }} critical</small>
                  </div>

                  <div class="safety-metric-grid">
                    <span>
                      <small>Active allergies</small>
                      <strong>{{ currentPatient.overview.activeAllergies }}</strong>
                    </span>
                    <span>
                      <small>Critical flags</small>
                      <strong>{{ criticalAlerts(currentPatient) }}</strong>
                    </span>
                    <span>
                      <small>Blood group</small>
                      <strong>{{ currentPatient.bloodGroupName || '-' }}</strong>
                    </span>
                    <span>
                      <small>Outstanding</small>
                      <strong>{{ currency(currentPatient.billingSummary.outstandingBalance) }}</strong>
                    </span>
                  </div>

                  @if (currentPatient.allergies.length > 0) {
                    <div class="flag-list">
                      @for (allergy of currentPatient.allergies.slice(0, 4); track allergy.allergyGuid) {
                        <article class="flag-card" [class.critical]="allergy.isCritical || allergy.severityCode === 'HIGH' || allergy.severityCode === 'SEVERE'">
                          <span class="material-symbols-rounded">warning</span>
                          <div>
                            <strong>{{ allergy.allergen }}</strong>
                            <p>{{ allergy.allergyType || 'Allergy' }} @if (allergy.reaction) { · {{ allergy.reaction }} }</p>
                          </div>
                          <small>{{ allergy.severityName || allergy.severityCode }}</small>
                        </article>
                      }
                    </div>
                  } @else {
                    <div class="flag-empty">
                      <span class="material-symbols-rounded">verified_user</span>
                      <div>
                        <strong>Clear for routine workflow</strong>
                        <p class="muted">No allergy records captured. Add one if the patient reports medicine, food, or material sensitivity.</p>
                      </div>
                    </div>
                  }

                  <div class="safety-actions">
                    <button type="button" class="ac-btn ac-btn-primary" (click)="activeTab.set('allergies')">
                      <span class="material-symbols-rounded">add</span>
                      Manage Allergies
                    </button>
                    <button type="button" class="ac-btn ac-btn-secondary" (click)="activeTab.set('medical')">
                      <span class="material-symbols-rounded">medical_information</span>
                      Medical Profile
                    </button>
                    <button type="button" class="ac-btn ac-btn-secondary" (click)="activeTab.set('billing')">
                      <span class="material-symbols-rounded">payments</span>
                      Billing
                    </button>
                  </div>

                  <div class="touchpoint-strip">
                    <span>
                      <small>Last visit</small>
                      <strong>{{ formatDateTime(currentPatient.lastVisitDate) }}</strong>
                    </span>
                    <span>
                      <small>Upcoming</small>
                      <strong>{{ currentPatient.overview.upcomingAppointments }}</strong>
                    </span>
                    <span>
                      <small>Documents</small>
                      <strong>{{ currentPatient.overview.documents }}</strong>
                    </span>
                  </div>
                </article>
              </div>
            }
            @case ('personal') {
              <div class="stacked-section">
                <div class="detail-grid overview-detail-grid">
                  <span class="detail-tile"><small>Name</small><strong>{{ currentPatient.fullName }}</strong><em>Permanent patient identity</em></span>
                  <span class="detail-tile"><small>Mobile</small><strong>{{ currentPatient.mobileNo }}</strong><em>Primary contact</em></span>
                  <span class="detail-tile"><small>Email</small><strong>{{ currentPatient.email || '-' }}</strong><em>Contact channel</em></span>
                  <span class="detail-tile"><small>Address</small><strong>{{ patientAddress(currentPatient) }}</strong><em>Registered address</em></span>
                  <span class="detail-tile"><small>Emergency contact</small><strong>{{ emergencyContact(currentPatient) }}</strong><em>{{ currentPatient.emergencyContactRelationship || 'Patient support' }}</em></span>
                  <span class="detail-tile"><small>National ID</small><strong>{{ currentPatient.nationalId || '-' }}</strong><em>Identification</em></span>
                </div>
                <div class="record-grid">
                  @for (contact of currentPatient.contacts; track contact.contactGuid) {
                    <article class="record-card">
                      <span class="material-symbols-rounded">contact_phone</span>
                      <div>
                        <h3>{{ contact.fullName }}</h3>
                        <p>{{ contact.relationship }} · {{ contact.mobileNo }}</p>
                      </div>
                    </article>
                  } @empty {
                    <div class="empty-state">No additional patient contacts captured yet.</div>
                  }
                </div>
              </div>
            }
            @case ('medical') {
              <div class="stacked-section">
                <header class="tracker-head">
                  <div>
                    <p class="ac-eyebrow">Medical profile</p>
                    <h2>Edit Medical Profile</h2>
                  </div>
                  <span class="tracker-count">{{ currentPatient.bloodGroupName }}</span>
                </header>
                <div class="medical-form-grid">
                  <label><span>Blood Group</span><textarea readonly [value]="currentPatient.bloodGroupName"></textarea></label>
                  <label><span>Known Conditions</span><textarea readonly [value]="currentPatient.knownConditions || '-'"></textarea></label>
                  <label><span>Chronic Diseases</span><textarea readonly [value]="currentPatient.chronicDiseases || '-'"></textarea></label>
                  <label><span>Past Medical History</span><textarea readonly [value]="currentPatient.pastMedicalHistory || '-'"></textarea></label>
                  <label><span>Family History</span><textarea readonly [value]="currentPatient.familyHistory || '-'"></textarea></label>
                  <label><span>Surgical History</span><textarea readonly [value]="currentPatient.surgicalHistory || '-'"></textarea></label>
                  <label class="span-2"><span>Important Notes</span><textarea readonly [value]="currentPatient.medicalNotes || '-'"></textarea></label>
                </div>
              </div>
            }
            @case ('allergies') {
              <div class="stacked-section">
                <div class="allergy-actions">
                  <button type="button" class="ac-btn ac-btn-primary" (click)="allergyAction('Add Allergy')"><span class="material-symbols-rounded">add</span>Add Allergy</button>
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="allergyAction('Edit Allergy')"><span class="material-symbols-rounded">edit</span>Edit Allergy</button>
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="allergyAction('Mark Critical')"><span class="material-symbols-rounded">priority_high</span>Mark Critical</button>
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="allergyAction('Deactivate Allergy')"><span class="material-symbols-rounded">block</span>Deactivate</button>
                </div>
                <div class="record-grid">
                  @for (allergy of currentPatient.allergies; track allergy.allergyGuid) {
                    <article class="record-card warning">
                      <span class="material-symbols-rounded">warning</span>
                      <div>
                        <h3>{{ allergy.allergen }}</h3>
                        <p>{{ allergy.allergyType }} · {{ allergy.reaction || 'Reaction not set' }} · {{ allergy.severityName }} · {{ allergy.statusCode }}{{ allergy.isCritical ? ' · Critical' : '' }}</p>
                      </div>
                    </article>
                  } @empty {
                    <div class="empty-state">No allergy or safety records captured yet.</div>
                  }
                </div>
              </div>
            }
            @case ('insurance') {
              <div class="record-grid">
                @for (insurance of currentPatient.insurance; track insurance.insuranceGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">health_and_safety</span>
                    <div>
                      <h3>{{ insurance.providerName }}</h3>
                      <p>{{ insurance.policyNo }} · {{ insurance.statusCode }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No insurance policies linked yet.</div>
                }
              </div>
            }
            @case ('documents') {
              <div class="record-grid">
                @for (document of currentPatient.documents; track document.documentGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">description</span>
                    <div>
                      <h3>{{ document.documentName }}</h3>
                      <p>{{ document.documentType }} · {{ formatDateTime(document.uploadedDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No documents uploaded yet.</div>
                }
              </div>
            }
            @case ('appointments') {
              <div class="record-grid">
                @for (record of currentPatient.appointments; track record.recordGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">event_available</span>
                    <div>
                      <h3>{{ record.title }}</h3>
                      <p>{{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No appointments linked yet.</div>
                }
              </div>
            }
            @case ('opd') {
              <div class="record-grid">
                @for (record of opdVisits(currentPatient); track record.recordGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">clinical_notes</span>
                    <div>
                      <h3>{{ record.title }}</h3>
                      <p>{{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No OPD visits linked yet.</div>
                }
              </div>
            }
            @case ('ipd') {
              <div class="record-grid">
                @for (record of ipdAdmissions(currentPatient); track record.recordGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">bed</span>
                    <div>
                      <h3>{{ record.title }}</h3>
                      <p>{{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No IPD admissions linked yet.</div>
                }
              </div>
            }
            @case ('prescriptions') {
              <section class="prescription-history">
                <header class="tracker-head">
                  <div>
                    <p class="ac-eyebrow">Patient-wise prescriptions</p>
                    <h2>Prescription History</h2>
                  </div>
                  <span class="tracker-count">{{ currentPatient.prescriptions.length }} records</span>
                </header>

                @if (currentPatient.prescriptions.length > 0) {
                  <div class="prescription-history-table">
                    <div class="prescription-history-head">
                      <span>Prescription No.</span>
                      <span>Doctor</span>
                      <span>Date</span>
                      <span>Status</span>
                      <span>Actions</span>
                    </div>
                    @for (record of currentPatient.prescriptions; track record.recordGuid; let index = $index) {
                      <div class="prescription-history-row">
                        <span><strong>{{ prescriptionNo(record, index) }}</strong><small>{{ record.recordType }}</small></span>
                        <span>{{ prescriptionDoctor(record) }}</span>
                        <span>{{ formatDate(record.eventDate) }}</span>
                        <span><mark>{{ prescriptionStatus(record) }}</mark></span>
                        <span class="prescription-actions">
                          <button type="button" title="View prescription" (click)="viewPrescription(currentPatient, record, index)">
                            <span class="material-symbols-rounded">visibility</span>
                          </button>
                          <button type="button" title="Print prescription" (click)="printPatientPrescription(currentPatient, record, index)">
                            <span class="material-symbols-rounded">print</span>
                          </button>
                          <button type="button" title="Download PDF" (click)="downloadPatientPrescription(currentPatient, record, index)">
                            <span class="material-symbols-rounded">picture_as_pdf</span>
                          </button>
                          <button type="button" title="Share prescription" (click)="sharePatientPrescription(currentPatient, record, index)">
                            <span class="material-symbols-rounded">ios_share</span>
                          </button>
                        </span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-state">No prescriptions linked yet.</div>
                }
              </section>
            }
            @case ('lab-results') {
              <div class="record-grid">
                @for (record of currentPatient.labOrders; track record.recordGuid) {
                  <article class="record-card">
                    <span class="material-symbols-rounded">biotech</span>
                    <div>
                      <h3>{{ record.title }}</h3>
                      <p>{{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No lab orders or results linked yet.</div>
                }
              </div>
            }
            @case ('billing') {
              <div class="billing-grid">
                <div><small>Outstanding</small><strong>{{ currency(currentPatient.billingSummary.outstandingBalance) }}</strong></div>
                <div><small>Paid</small><strong>{{ currency(currentPatient.billingSummary.paidAmount) }}</strong></div>
                <div><small>Last payment</small><strong>{{ currency(currentPatient.billingSummary.lastPaymentAmount) }}</strong></div>
                <div><small>Open claims</small><strong>{{ currentPatient.billingSummary.insurancePendingAmount }}</strong></div>
              </div>
            }
            @case ('activity') {
              <section class="activity-tracker">
                <header class="tracker-head">
                  <div>
                    <p class="ac-eyebrow">Care timeline</p>
                    <h2>Patient activity tracker</h2>
                  </div>
                  <span class="tracker-count">{{ currentPatient.timeline.length }} events</span>
                </header>
                <ol class="timeline tracker-list">
                  @for (event of currentPatient.timeline; track event.eventGuid + event.eventDate; let index = $index) {
                    <li class="tracker-item">
                      <div class="tracker-marker">
                        <span class="tracker-step">{{ index + 1 }}</span>
                      </div>
                      <article class="tracker-card">
                        <div class="tracker-card-head">
                          <div>
                            <strong>{{ event.eventType }}</strong>
                            <p>{{ event.description }}</p>
                          </div>
                          <span class="tracker-date">{{ formatDateTime(event.eventDate) }}</span>
                        </div>
                        <div class="tracker-meta">
                          <span class="material-symbols-rounded">apps</span>
                          {{ event.sourceModule }}
                        </div>
                      </article>
                    </li>
                  } @empty {
                    <div class="empty-state">No activity captured yet.</div>
                  }
                </ol>
              </section>
            }
          }
        </section>
      } @else {
        <div class="profile-loader ac-card">Patient profile is not available.</div>
      }

      @if (selectedPrescription(); as prescription) {
        <div class="patient-modal-backdrop" (click)="closePrescriptionView()">
          <section class="patient-prescription-modal" (click)="$event.stopPropagation()" aria-label="Prescription preview">
            <header>
              <div>
                <p class="ac-eyebrow">Medication Prescription</p>
                <h2>{{ prescription.prescriptionNo }}</h2>
                <span>{{ prescription.patientName }} · {{ prescription.mrn }} · {{ prescription.date }}</span>
              </div>
              <button type="button" class="modal-close" aria-label="Close prescription preview" (click)="closePrescriptionView()">
                <span class="material-symbols-rounded">close</span>
              </button>
            </header>
            <div class="patient-prescription-sheet">
              <div class="sheet-row">
                <small>Patient</small>
                <strong>{{ prescription.patientName }}</strong>
              </div>
              <div class="sheet-row">
                <small>MRN</small>
                <strong>{{ prescription.mrn }}</strong>
              </div>
              <div class="sheet-row">
                <small>Doctor</small>
                <strong>{{ prescription.doctor }}</strong>
              </div>
              <div class="sheet-row">
                <small>Status</small>
                <strong>{{ prescription.status }}</strong>
              </div>
              <article>
                <small>Prescription details</small>
                @if (prescription.details.hasStructuredContent) {
                  <div class="prescription-section-grid">
                    @if (prescription.details.medicines.length) {
                      <section class="rx-preview-section rx-medicine-focus">
                        <h3>Medicines</h3>
                        <div class="rx-medicine-list">
                          @for (medicine of prescription.details.medicines; track medicine.name + medicine.instruction) {
                            <div>
                              <strong>{{ medicine.name }}</strong>
                              <p>
                                @if (medicine.dosage) { <span>{{ medicine.dosage }}</span> }
                                @if (medicine.frequency) { <span>{{ medicine.frequency }}</span> }
                                @if (medicine.duration) { <span>{{ medicine.duration }}</span> }
                                @if (medicine.route) { <span>{{ medicine.route }}</span> }
                                @if (medicine.quantity) { <span>{{ medicine.quantity }}</span> }
                              </p>
                              @if (medicine.instruction && medicine.instruction !== '-') {
                                <small>{{ medicine.instruction }}</small>
                              }
                            </div>
                          }
                        </div>
                      </section>
                    }

                    @if (prescription.details.vitals.length) {
                      <section class="rx-preview-section">
                        <h3>Vitals</h3>
                        <div class="rx-key-grid compact">
                          @for (item of prescription.details.vitals; track item.label) {
                            <span><small>{{ item.label }}</small><strong>{{ item.value }}</strong></span>
                          }
                        </div>
                      </section>
                    }

                    @if (prescription.details.investigations.length || prescription.details.procedures.length) {
                      <section class="rx-preview-section">
                        <h3>Orders & Procedures</h3>
                        <div class="rx-chip-list">
                          @for (item of prescription.details.investigations; track item) {
                            <span>{{ item }}</span>
                          }
                          @for (item of prescription.details.procedures; track item) {
                            <span>{{ item }}</span>
                          }
                        </div>
                      </section>
                    }

                    @if (prescription.details.advice.length || prescription.details.dietAdvice.length) {
                      <section class="rx-preview-section">
                        <h3>Advice</h3>
                        <div class="rx-chip-list">
                          @for (item of prescription.details.advice; track item) {
                            <span>{{ item }}</span>
                          }
                          @for (item of prescription.details.dietAdvice; track item) {
                            <span>{{ item }}</span>
                          }
                        </div>
                      </section>
                    }

                    @if (prescription.details.followUp.length) {
                      <section class="rx-preview-section">
                        <h3>Follow-up</h3>
                        <div class="rx-key-grid compact">
                          @for (item of prescription.details.followUp; track item.label) {
                            <span><small>{{ item.label }}</small><strong>{{ item.value }}</strong></span>
                          }
                        </div>
                      </section>
                    }
                  </div>
                } @else {
                  <p>{{ prescription.summary }}</p>
                }
              </article>
            </div>
            <footer>
              <button class="ac-btn ac-btn-secondary" type="button" (click)="shareSelectedPrescription()">
                <span class="material-symbols-rounded">ios_share</span>
                Share
              </button>
              <button class="ac-btn ac-btn-secondary" type="button" (click)="downloadSelectedPrescription()">
                <span class="material-symbols-rounded">picture_as_pdf</span>
                PDF
              </button>
              <button class="ac-btn ac-btn-primary" type="button" (click)="printSelectedPrescription()">
                <span class="material-symbols-rounded">print</span>
                Print
              </button>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; min-width: 0; overflow: hidden; }
    .patient-profile { width: 100%; max-width: 100%; height: 100%; min-height: 0; min-width: 0; overflow: auto; overflow-x: hidden; display: grid; grid-auto-rows: max-content; align-content: start; gap: 16px; padding-bottom: 8px; }
    .patient-profile > * { min-width: 0; max-width: 100%; }
    .profile-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .back-link { display: inline-flex; align-items: center; gap: 7px; color: var(--ac-muted); font-weight: 800; font-size: 13px; }
    .back-link:hover { color: var(--ac-primary); }
    .profile-loader { padding: 24px; color: var(--ac-muted); }
    .hero-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px; background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 10%, var(--ac-surface)), var(--ac-surface)); }
    .hero-main { display: flex; gap: 16px; align-items: center; min-width: 0; }
    .patient-avatar { width: 72px; height: 72px; border-radius: 22px; display: grid; place-items: center; color: #fff; font-size: 24px; font-weight: 900; box-shadow: var(--ac-sh); flex: 0 0 auto; }
    .hero-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .pill { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: var(--ac-r-full); background: var(--ac-surface); border: 1px solid var(--ac-border); color: var(--ac-text-2); font-size: 12.5px; font-weight: 700; }
    .pill.strong { color: var(--ac-primary); background: var(--ac-primary-light); border-color: transparent; }
    .hero-status { display: grid; gap: 4px; justify-items: end; color: var(--ac-text); }
    .hero-status small { color: var(--ac-muted); }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 5px rgba(16,185,129,.12); }
    .overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric-card { display: flex; align-items: center; gap: 12px; padding: 15px; }
    .metric-card .material-symbols-rounded { width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--ac-r-sm); background: var(--ac-surface-2); }
    .metric-card strong { display: block; color: var(--ac-text); font-size: 22px; }
    .metric-card small { color: var(--ac-muted); font-weight: 700; }
    .tab-bar { display: flex; gap: 8px; padding: 8px; overflow-x: auto; }
    .tab-bar button { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 12px; border-radius: var(--ac-r-sm); color: var(--ac-muted); font-weight: 800; white-space: nowrap; }
    .tab-bar button.active { color: var(--ac-primary); background: var(--ac-primary-light); }
    .tab-bar .material-symbols-rounded { font-size: 18px; }
    .tab-content { padding: 18px; min-height: 300px; }
    .split-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    h2 { margin: 0 0 14px; color: var(--ac-text); font-size: 18px; }
    .detail-grid, .billing-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .detail-grid span, .billing-grid div { padding: 14px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface-2); }
    small { color: var(--ac-muted); }
    .detail-grid strong, .billing-grid strong { display: block; margin-top: 5px; color: var(--ac-text); font-size: 16px; }
    .chip-list { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
    .severity-chip { display: inline-flex; align-items: center; max-width: 100%; padding: 8px 10px; border-radius: var(--ac-r-full); background: rgba(244,63,94,.1); color: #e11d48; font-weight: 800; font-size: 12px; }
    .flag-list {
      display: grid;
      gap: 10px;
      align-content: start;
      margin-top: 4px;
    }
    .flag-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      min-height: 72px;
      padding: 13px 14px;
      border: 1px solid color-mix(in srgb, #f43f5e 18%, var(--ac-border));
      border-radius: 14px;
      background:
        linear-gradient(135deg, color-mix(in srgb, #fff1f2 70%, var(--ac-surface)), var(--ac-surface));
      box-shadow: 0 12px 28px rgba(244, 63, 94, 0.08);
    }
    .flag-card > .material-symbols-rounded {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #ffe4e6;
      color: #e11d48;
      font-size: 20px;
    }
    .flag-card strong {
      display: block;
      color: var(--ac-text);
      font-size: 15px;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }
    .flag-card p {
      margin: 4px 0 0;
      color: var(--ac-muted);
      font-size: 12.5px;
      line-height: 1.35;
    }
    .flag-card small {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      background: #e11d48;
      color: #fff;
      font-size: 11.5px;
      font-weight: 900;
      white-space: nowrap;
      box-shadow: 0 8px 18px rgba(225, 29, 72, 0.18);
    }
    .flag-card.critical {
      border-color: color-mix(in srgb, #e11d48 28%, var(--ac-border));
      background:
        linear-gradient(135deg, color-mix(in srgb, #ffe4e6 76%, var(--ac-surface)), color-mix(in srgb, #fff7ed 46%, var(--ac-surface)));
    }
    .muted, .empty-state { color: var(--ac-muted); }
    .stacked-section { display: grid; gap: 18px; }
    .record-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .record-card { display: flex; align-items: flex-start; gap: 12px; min-height: 86px; padding: 14px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface-2); }
    .record-card .material-symbols-rounded { width: 38px; height: 38px; display: grid; place-items: center; border-radius: var(--ac-r-sm); background: var(--ac-primary-light); color: var(--ac-primary); flex: 0 0 auto; }
    .record-card.warning .material-symbols-rounded { background: rgba(244,63,94,.1); color: #e11d48; }
    .record-card h3 { margin: 0; color: var(--ac-text); font-size: 15px; }
    .record-card p { margin: 5px 0 0; color: var(--ac-muted); font-size: 13px; }
    .medical-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .medical-form-grid label { display: grid; gap: 6px; }
    .medical-form-grid span { color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .medical-form-grid textarea { min-height: 82px; resize: vertical; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface-2); color: var(--ac-text); padding: 11px 12px; font: inherit; }
    .medical-form-grid .span-2 { grid-column: 1 / -1; }
    .allergy-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .allergy-actions .ac-btn { min-height: 36px; padding-inline: 11px; }
    .allergy-actions .material-symbols-rounded { font-size: 18px; }
    .timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
    .timeline li { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 12px; padding: 0 0 18px; }
    .timeline li > span { width: 10px; height: 10px; border-radius: 50%; background: var(--ac-primary); margin-top: 6px; box-shadow: 0 0 0 5px var(--ac-primary-light); }
    .timeline strong { color: var(--ac-text); }
    .timeline p { margin: 3px 0; color: var(--ac-text-2); }
    @media (max-width: 980px) {
      .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .split-layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 620px) {
      .hero-card, .profile-header { align-items: stretch; flex-direction: column; }
      .hero-main { align-items: flex-start; }
      .hero-status { justify-items: start; }
      .overview-grid, .detail-grid, .billing-grid, .record-grid { grid-template-columns: 1fr; }
      .patient-avatar { width: 58px; height: 58px; border-radius: 18px; font-size: 20px; }
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
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 13%, var(--ac-surface)) 0%, color-mix(in srgb, #14b8a6 8%, var(--ac-surface)) 52%, var(--ac-surface) 100%);
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.07);
    }
    .hero-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: linear-gradient(90deg, var(--ac-primary), #14b8a6, #7c3aed);
    }
    .hero-main, .hero-status { position: relative; z-index: 1; }
    .patient-avatar {
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
      min-width: 210px;
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
    .overview-grid { grid-template-columns: repeat(4, minmax(170px, 1fr)); gap: 14px; }
    .metric-card {
      position: relative;
      overflow: hidden;
      min-height: 108px;
      border-color: color-mix(in srgb, var(--ac-border) 84%, var(--ac-surface));
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .metric-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--ac-primary), color-mix(in srgb, var(--ac-primary) 35%, transparent));
    }
    .metric-card:hover {
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
    .split-layout, .stacked-section, .record-grid { gap: 16px; }
    .split-layout > section,
    .record-card,
    .detail-grid > div,
    .billing-grid > div,
    .empty-state,
    .timeline li {
      border-color: color-mix(in srgb, var(--ac-border) 84%, var(--ac-surface));
      background: color-mix(in srgb, var(--ac-surface) 92%, var(--ac-subtle));
    }
    .detail-grid > div, .billing-grid > div { border-radius: 14px; }
    .empty-state {
      min-height: 190px;
      justify-content: center;
      border-style: dashed;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 5%, var(--ac-surface)), color-mix(in srgb, #14b8a6 5%, var(--ac-surface)));
      text-align: center;
    }
    .record-card { box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04); }

    @media (max-width: 980px) {
      .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 620px) {
      .patient-profile { gap: 14px; padding-bottom: 18px; }
      .hero-card { padding: 20px; }
      .hero-main { align-items: flex-start; }
      .patient-avatar { width: 64px; height: 64px; border-radius: 18px; }
      .hero-status { width: 100%; min-width: 0; text-align: left; }
      .overview-grid { grid-template-columns: 1fr; }
    }

    .patient-profile {
      gap: 12px;
      padding-bottom: 0;
      grid-auto-rows: max-content;
      align-content: start;
    }
    .profile-header {
      min-height: 42px;
    }
    .hero-card {
      min-height: 118px;
      padding: 16px 18px;
      gap: 16px;
      border-radius: 12px;
    }
    .hero-main {
      gap: 14px;
    }
    .patient-avatar {
      width: 58px;
      height: 58px;
      border-radius: 16px;
      font-size: 22px;
      outline-width: 4px;
    }
    .hero-main .ac-eyebrow {
      margin-bottom: 4px;
      font-size: 11px;
    }
    .hero-main h1 {
      font-size: 25px;
      line-height: 1.08;
    }
    .hero-pills {
      margin-top: 9px;
      gap: 6px;
    }
    .pill {
      min-height: 28px;
      padding: 3px 9px;
      font-size: 12px;
    }
    .hero-status {
      min-width: 188px;
      padding: 13px 15px;
      border-radius: 14px;
    }
    .hero-status strong {
      margin-top: 5px;
      font-size: 16px;
    }
    .overview-grid {
      gap: 12px;
    }
    .metric-card {
      min-height: 78px;
      padding: 12px 14px;
      border-radius: 10px;
    }
    .metric-card .material-symbols-rounded {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      font-size: 20px;
    }
    .metric-card strong {
      font-size: 22px;
      line-height: 1;
    }
    .metric-card small {
      margin-top: 4px;
      display: block;
      font-size: 12.5px;
    }
    .tab-bar {
      position: relative;
      top: auto;
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
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
      position: relative;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      overflow: visible;
      min-height: 0;
      padding: 14px;
      border-radius: 12px;
    }
    .split-layout {
      min-width: 0;
      gap: 14px;
    }
    .split-layout > article,
    .split-layout > section {
      min-width: 0;
      padding: 16px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 84%, var(--ac-surface));
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-surface) 96%, var(--ac-subtle));
    }
    h2 {
      margin-bottom: 10px;
      font-size: 17px;
    }
    .detail-grid,
    .billing-grid {
      gap: 8px;
    }
    .detail-grid span,
    .billing-grid div {
      padding: 11px 12px;
      min-height: 70px;
      border-radius: 10px;
    }
    .detail-grid strong,
    .billing-grid strong {
      margin-top: 3px;
      font-size: 15px;
    }
    .record-grid {
      gap: 10px;
    }
    .record-card {
      min-height: 70px;
      padding: 12px;
      border-radius: 10px;
    }
    .record-card .material-symbols-rounded {
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
    .empty-state {
      min-height: 120px;
      padding: 18px;
      border-radius: 10px;
      grid-column: 1 / -1;
      width: 100%;
      display: grid;
      place-items: center;
      align-content: center;
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
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 8%, var(--ac-surface)), color-mix(in srgb, #14b8a6 5%, var(--ac-surface)));
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
      background: linear-gradient(180deg, var(--ac-primary), color-mix(in srgb, #14b8a6 72%, var(--ac-primary)));
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
      background: linear-gradient(135deg, var(--ac-primary), #14b8a6);
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
      background: linear-gradient(90deg, var(--ac-primary), color-mix(in srgb, #14b8a6 74%, var(--ac-primary)));
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
    .warning-icon {
      background: var(--ac-warning-light);
      color: var(--ac-warning);
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
    .flag-empty {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 86px;
      padding: 14px;
      border: 1px dashed color-mix(in srgb, var(--ac-success) 26%, var(--ac-border));
      border-radius: 12px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-success) 8%, var(--ac-surface)), var(--ac-surface));
    }
    .flag-empty > .material-symbols-rounded {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--ac-success-light);
      color: var(--ac-success);
    }
    .flag-empty strong {
      display: block;
      color: var(--ac-text);
      font-size: 14px;
    }
    .flag-empty p {
      margin: 3px 0 0;
    }
    .flags-panel {
      align-content: start;
      gap: 14px;
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--ac-surface) 96%, white), color-mix(in srgb, #f8fafc 88%, var(--ac-surface))),
        var(--ac-surface);
    }
    .safety-overview {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      min-height: 82px;
      padding: 14px;
      border: 1px solid color-mix(in srgb, #f59e0b 28%, var(--ac-border));
      border-radius: 14px;
      background: linear-gradient(135deg, color-mix(in srgb, #fffbeb 72%, var(--ac-surface)), var(--ac-surface));
      box-shadow: 0 12px 26px rgba(245, 158, 11, 0.08);
    }
    .safety-overview.clear {
      border-color: color-mix(in srgb, var(--ac-success) 26%, var(--ac-border));
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-success-light) 64%, var(--ac-surface)), var(--ac-surface));
      box-shadow: 0 12px 26px color-mix(in srgb, var(--ac-success) 9%, transparent);
    }
    .safety-overview > .material-symbols-rounded {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: #fef3c7;
      color: #d97706;
      font-size: 21px;
    }
    .safety-overview.clear > .material-symbols-rounded {
      background: var(--ac-success-light);
      color: var(--ac-success);
    }
    .safety-overview strong,
    .safety-metric-grid strong,
    .touchpoint-strip strong {
      color: var(--ac-text);
      overflow-wrap: anywhere;
    }
    .safety-overview p {
      margin: 4px 0 0;
      color: var(--ac-text-2);
      font-size: 13px;
      line-height: 1.35;
      font-weight: 750;
    }
    .safety-overview small {
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--ac-surface);
      color: var(--ac-muted);
      font-size: 11.5px;
      font-weight: 900;
      white-space: nowrap;
      box-shadow: inset 0 0 0 1px var(--ac-border);
    }
    .safety-metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .safety-metric-grid span,
    .touchpoint-strip span {
      min-width: 0;
      display: grid;
      gap: 5px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--ac-border) 86%, var(--ac-surface));
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-surface) 94%, var(--ac-subtle));
    }
    .safety-metric-grid small,
    .touchpoint-strip small {
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .safety-metric-grid strong {
      font-size: 18px;
      line-height: 1.1;
    }
    .flags-panel .flag-empty {
      min-height: 82px;
      text-align: left;
      justify-content: flex-start;
      border-style: solid;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-success-light) 56%, var(--ac-surface)), var(--ac-surface));
    }
    .safety-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .safety-actions .ac-btn {
      min-height: 38px;
      padding-inline: 10px;
      justify-content: center;
      white-space: nowrap;
    }
    .safety-actions .material-symbols-rounded {
      font-size: 18px;
    }
    .touchpoint-strip {
      display: grid;
      grid-template-columns: 1.4fr .8fr .8fr;
      gap: 10px;
    }
    .touchpoint-strip strong {
      font-size: 14px;
      line-height: 1.25;
    }

    @media (max-width: 620px) {
      .hero-card {
        padding: 15px;
      }
      .hero-main h1 {
        font-size: 22px;
      }
      .patient-avatar {
        width: 52px;
        height: 52px;
        font-size: 19px;
      }
      .tab-bar {
        min-height: 50px;
      }
      .tab-content {
        padding: 12px;
      }
      .tracker-head,
      .tracker-card-head {
        align-items: flex-start;
        flex-direction: column;
      }
      .tracker-date {
        white-space: normal;
      }
      .overview-detail-grid {
        grid-template-columns: 1fr;
      }
      .safety-overview,
      .safety-actions,
      .touchpoint-strip {
        grid-template-columns: 1fr;
      }
    }

    .patient-summary-card {
      position: relative;
      overflow: hidden;
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      border-color: color-mix(in srgb, var(--ac-primary) 14%, var(--ac-border));
      background: linear-gradient(120deg, color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)) 0%, color-mix(in srgb, #14b8a6 6%, var(--ac-surface)) 52%, var(--ac-surface) 100%);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
    }
    .patient-summary-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: linear-gradient(90deg, var(--ac-primary), #14b8a6, #7c3aed);
    }
    .patient-summary-card .hero-card {
      min-height: 0;
      padding: 12px 12px 8px;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .patient-summary-card .hero-card::before {
      display: none;
    }
    .patient-summary-card .hero-main {
      flex: 1 1 auto;
      min-width: 0;
    }
    .patient-summary-card .patient-avatar {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      font-size: 20px;
      outline-width: 4px;
      box-shadow: 0 10px 22px color-mix(in srgb, var(--ac-primary) 18%, transparent);
    }
    .patient-summary-card .hero-main h1 {
      font-size: 23px;
    }
    .patient-summary-card .hero-pills {
      margin-top: 7px;
    }
    .patient-summary-card .hero-status {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      column-gap: 9px;
      row-gap: 2px;
      min-width: 210px;
      padding: 10px 12px;
      text-align: left;
    }
    .patient-summary-card .hero-status .status-dot {
      grid-row: 1 / span 2;
    }
    .patient-summary-card .hero-status strong {
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
    .summary-kpis .metric-card::before {
      display: none;
    }
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
      font-size: 12px;
    }

    @media (max-width: 980px) {
      .summary-kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 620px) {
      .patient-summary-card {
        padding: 10px;
      }
      .patient-summary-card .hero-card {
        padding: 10px;
      }
      .patient-summary-card .hero-status {
        width: 100%;
        min-width: 0;
      }
      .summary-kpis {
        grid-template-columns: 1fr;
      }
    }

    .patient-profile {
      --profile-accent: var(--ac-primary);
      --profile-accent-2: #14b8a6;
      --profile-success: #7c3aed;
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
    .billing-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .record-card,
    .billing-grid > div,
    .detail-tile {
      position: relative;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--ac-border) 82%, var(--ac-surface));
      border-radius: 14px;
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--ac-surface) 96%, white), color-mix(in srgb, var(--profile-accent-2) 4%, var(--ac-surface))),
        var(--ac-surface);
      box-shadow: 0 10px 26px rgba(15, 23, 42, 0.045);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    }
    .record-card::before,
    .billing-grid > div::before,
    .detail-tile::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--profile-accent), var(--profile-accent-2), var(--profile-success));
      opacity: 0.76;
    }
    .record-card:hover,
    .billing-grid > div:hover,
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
    .record-card .material-symbols-rounded {
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
    .billing-grid > div {
      min-height: 112px;
      display: grid;
      align-content: center;
      gap: 6px;
      padding: 18px;
    }
    .billing-grid small {
      color: var(--ac-muted);
      font-size: 13px;
      font-weight: 850;
    }
    .billing-grid strong {
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
    .prescription-history {
      display: grid;
      gap: 14px;
    }
    .prescription-history-table {
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--profile-accent) 18%, var(--ac-border));
      border-radius: 16px;
      background: var(--ac-surface);
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.055);
    }
    .prescription-history-head,
    .prescription-history-row {
      display: grid;
      grid-template-columns: minmax(170px, 1.1fr) minmax(150px, 1fr) minmax(120px, .75fr) minmax(105px, .65fr) minmax(190px, auto);
      gap: 12px;
      align-items: center;
      padding: 13px 16px;
    }
    .prescription-history-head {
      background: color-mix(in srgb, var(--profile-accent) 8%, var(--ac-subtle));
      color: var(--ac-muted);
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .prescription-history-row {
      border-top: 1px solid var(--ac-border);
      color: var(--ac-text);
      font-weight: 820;
    }
    .prescription-history-row > span {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .prescription-history-row strong,
    .prescription-history-row small {
      display: block;
    }
    .prescription-history-row small {
      margin-top: 3px;
      color: var(--ac-muted);
      font-size: 11.5px;
      font-weight: 850;
    }
    .prescription-history-row mark {
      display: inline-flex;
      min-height: 28px;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, #10b981 12%, var(--ac-surface));
      color: #047857;
      font-weight: 950;
    }
    .prescription-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .prescription-actions button,
    .modal-close {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      color: var(--ac-muted);
      cursor: pointer;
      transition: color .16s ease, background .16s ease, border-color .16s ease, transform .16s ease;
    }
    .prescription-actions button:hover,
    .modal-close:hover {
      color: var(--profile-accent);
      border-color: color-mix(in srgb, var(--profile-accent) 26%, var(--ac-border));
      background: var(--ac-primary-light);
      transform: translateY(-1px);
    }
    .prescription-actions .material-symbols-rounded,
    .modal-close .material-symbols-rounded {
      font-size: 19px;
    }
    .patient-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(15, 23, 42, .42);
      backdrop-filter: blur(6px);
    }
    .patient-prescription-modal {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: min(900px, 100%);
      max-height: min(90vh, 860px);
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--profile-accent) 20%, var(--ac-border));
      border-radius: 18px;
      background: var(--ac-surface);
      box-shadow: 0 30px 90px rgba(15, 23, 42, .24);
    }
    .patient-prescription-modal > header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 22px 24px;
      border-bottom: 1px solid var(--ac-border);
      background: linear-gradient(120deg, color-mix(in srgb, var(--profile-accent) 11%, var(--ac-surface)), color-mix(in srgb, var(--profile-accent-2) 7%, var(--ac-surface)));
    }
    .patient-prescription-modal h2 {
      margin: 2px 0 3px;
      color: var(--ac-text);
      font-size: 24px;
    }
    .patient-prescription-modal header span {
      color: var(--ac-muted);
      font-weight: 850;
    }
    .patient-prescription-sheet {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      padding: 20px 24px;
      min-height: 0;
      overflow: auto;
    }
    .patient-prescription-sheet .sheet-row,
    .patient-prescription-sheet article {
      min-width: 0;
      display: grid;
      gap: 5px;
      padding: 13px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--profile-accent) 3%, var(--ac-surface));
    }
    .patient-prescription-sheet small {
      color: var(--ac-muted);
      font-size: 11px;
      font-weight: 950;
      text-transform: uppercase;
    }
    .patient-prescription-sheet strong {
      color: var(--ac-text);
      overflow-wrap: anywhere;
    }
    .patient-prescription-sheet article {
      grid-column: 1 / -1;
    }
    .patient-prescription-sheet article p {
      margin: 0;
      color: var(--ac-text-2);
      font-weight: 780;
      line-height: 1.5;
    }
    .prescription-section-grid {
      display: grid;
      gap: 12px;
    }
    .rx-preview-section {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
    }
    .rx-preview-section.rx-medicine-focus {
      padding: 14px;
      border-color: color-mix(in srgb, var(--profile-accent) 22%, var(--ac-border));
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--profile-accent) 12%, transparent), transparent 34%),
        linear-gradient(135deg, color-mix(in srgb, var(--profile-accent) 5%, var(--ac-surface)), var(--ac-surface));
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
    }
    .rx-preview-section h3 {
      margin: 0;
      color: var(--ac-text);
      font-size: 15px;
    }
    .rx-key-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .rx-key-grid.compact {
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
    }
    .rx-key-grid span {
      min-width: 0;
      display: grid;
      gap: 3px;
      padding: 9px 10px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: color-mix(in srgb, var(--profile-accent) 3%, var(--ac-surface));
    }
    .rx-key-grid strong {
      color: var(--ac-text);
      overflow-wrap: anywhere;
    }
    .rx-medicine-list {
      display: grid;
      gap: 8px;
    }
    .rx-medicine-list div {
      display: grid;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: color-mix(in srgb, var(--profile-accent) 3%, var(--ac-surface));
    }
    .rx-medicine-focus .rx-medicine-list div {
      padding: 13px 14px;
      border-color: color-mix(in srgb, var(--profile-accent) 14%, var(--ac-border));
      background: rgba(255, 255, 255, 0.86);
    }
    .rx-medicine-list strong {
      color: var(--ac-text);
      font-size: 14px;
    }
    .rx-medicine-list p {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      color: var(--ac-text-2);
      font-size: 13px;
      font-weight: 800;
      line-height: 1.45;
    }
    .rx-medicine-list p span {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 3px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--profile-accent) 8%, var(--ac-primary-light));
      color: var(--ac-primary);
    }
    .rx-medicine-list small {
      color: var(--ac-muted);
      font-weight: 760;
      line-height: 1.45;
    }
    .rx-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .rx-chip-list span {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border: 1px solid var(--ac-border);
      border-radius: 999px;
      background: color-mix(in srgb, var(--profile-accent) 5%, var(--ac-surface));
      color: var(--ac-text);
      font-size: 12.5px;
      font-weight: 850;
    }
    .patient-prescription-modal footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
      padding: 14px 24px 18px;
      border-top: 1px solid var(--ac-border);
      background: color-mix(in srgb, var(--ac-surface) 94%, white);
    }
    .patient-prescription-modal footer .ac-btn {
      min-height: 42px;
      padding: 9px 16px;
    }

    @media (max-width: 620px) {
      .tab-bar {
        min-height: 52px;
        padding: 7px 7px 11px;
      }
      .tab-content {
        padding: 12px;
      }
      .record-grid,
      .billing-grid {
        grid-template-columns: 1fr;
      }
      .prescription-history-head {
        display: none;
      }
      .prescription-history-row {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .prescription-actions {
        justify-content: flex-start;
      }
      .patient-modal-backdrop {
        padding: 12px;
      }
      .patient-prescription-sheet {
        grid-template-columns: 1fr;
        padding: 14px;
      }
      .rx-key-grid {
        grid-template-columns: 1fr;
      }
      .patient-prescription-modal footer {
        flex-direction: column-reverse;
      }
      .patient-prescription-modal .ac-btn {
        width: 100%;
      }
    }

    :host {
      margin-top: 0;
      padding-top: 2px;
    }

    .patient-profile {
      gap: 12px;
      grid-auto-rows: max-content;
      align-content: start;
    }

    ac-page-actions {
      position: relative;
      z-index: 2;
      margin-bottom: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientProfilePageComponent implements OnInit {
  protected readonly loading = signal(true);
  protected readonly patient = signal<PatientProfile | null>(null);
  protected readonly activeTab = signal<PatientProfileTab>('overview');
  protected readonly selectedPrescription = signal<PatientPrescriptionPreview | null>(null);
  protected readonly allergyTypeOptions: DialogFieldOption[] = [
    { label: 'Drug', value: 'Drug' },
    { label: 'Food', value: 'Food' },
    { label: 'Environmental', value: 'Environmental' },
    { label: 'Latex', value: 'Latex' },
    { label: 'General', value: 'General' }
  ];
  protected readonly allergySeverityOptions: DialogFieldOption[] = [
    { label: 'Low', value: 'LOW' },
    { label: 'Mild', value: 'MILD' },
    { label: 'Moderate', value: 'MODERATE' },
    { label: 'High', value: 'HIGH' },
    { label: 'Severe', value: 'SEVERE' }
  ];
  protected readonly tabs: { id: PatientProfileTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'personal', label: 'Personal & Contacts', icon: 'contact_phone' },
    { id: 'medical', label: 'Medical Profile', icon: 'clinical_notes' },
    { id: 'allergies', label: 'Allergies', icon: 'emergency_home' },
    { id: 'insurance', label: 'Insurance', icon: 'health_and_safety' },
    { id: 'documents', label: 'Documents', icon: 'folder' },
    { id: 'appointments', label: 'Appointments', icon: 'event' },
    { id: 'opd', label: 'OPD History', icon: 'stethoscope' },
    { id: 'ipd', label: 'IPD History', icon: 'bed' },
    { id: 'prescriptions', label: 'Prescriptions', icon: 'prescriptions' },
    { id: 'lab-results', label: 'Lab Reports', icon: 'biotech' },
    { id: 'billing', label: 'Billing', icon: 'payments' },
    { id: 'activity', label: 'Activity', icon: 'timeline' }
  ];

  protected readonly overviewCards = computed(() => {
    const overview = this.patient()?.overview;
    return [
      { label: 'Appointments', value: overview?.totalAppointments ?? 0, icon: 'event_available', color: '#2563eb' },
      { label: 'Visits', value: overview?.totalVisits ?? 0, icon: 'clinical_notes', color: '#0ea5e9' },
      { label: 'Allergies', value: overview?.activeAllergies ?? 0, icon: 'warning', color: '#f97316' },
      { label: 'Outstanding', value: this.currency(overview?.outstandingBalance ?? 0), icon: 'receipt_long', color: '#7c3aed' }
    ];
  });

  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PatientManagementService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    const patientGuid = this.route.snapshot.paramMap.get('patientGuid');
    if (!patientGuid) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const response = await this.service.get(patientGuid);
      if (!response.success || !response.data) {
        this.toast.error('Unable to load patient profile', getApiErrorMessage(response, 'Patient API failed'));
        this.patient.set(null);
        return;
      }

      this.patient.set(response.data);
    } finally {
      this.loading.set(false);
    }
  }

  protected initials(patient: PatientProfile): string {
    return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase() || 'PT';
  }

  protected avatarColor(patientGuid: string): string {
    const colors = ['#2563EB', '#DB2777', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'];
    const sum = [...patientGuid].reduce((total, char) => total + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  }

  protected displayAge(age: number | null): string {
    return age === null || age === undefined ? 'Age not set' : `${age} ${age === 1 ? 'yr' : 'yrs'}`;
  }

  protected displayCareStatusName(patient: PatientProfile): string {
    return patient.careStatusName || patient.statusName || 'Registered';
  }

  protected emergencyContact(patient: PatientProfile): string {
    const name = patient.emergencyContactName?.trim();
    const mobile = patient.emergencyContactMobile?.trim();

    if (name && mobile) {
      return `${name} · ${mobile}`;
    }

    return name || mobile || '-';
  }

  protected patientAddress(patient: PatientProfile): string {
    const parts = [patient.address, patient.city, patient.state, patient.country, patient.pincode]
      .map(part => part?.trim())
      .filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : '-';
  }

  protected opdVisits(patient: PatientProfile): PatientConnectedRecord[] {
    return patient.visits.filter(record => record.sourceModule === 'OPD' || record.recordType === 'Consultation');
  }

  protected ipdAdmissions(patient: PatientProfile): PatientConnectedRecord[] {
    return patient.visits.filter(record => record.sourceModule === 'IPD' || record.recordType === 'Admission');
  }

  protected prescriptionNo(record: PatientConnectedRecord, index: number): string {
    return buildPatientPrescriptionPreview(this.patient(), record, index).prescriptionNo;
  }

  protected prescriptionDoctor(record: PatientConnectedRecord): string {
    return extractPrescriptionDoctor(record);
  }

  protected prescriptionStatus(record: PatientConnectedRecord): string {
    return titleCase(record.statusCode || 'Finalized');
  }

  protected viewPrescription(patient: PatientProfile, record: PatientConnectedRecord, index: number): void {
    this.selectedPrescription.set(buildPatientPrescriptionPreview(patient, record, index));
  }

  protected closePrescriptionView(): void {
    this.selectedPrescription.set(null);
  }

  protected printPatientPrescription(patient: PatientProfile, record: PatientConnectedRecord, index: number): void {
    const prescription = buildPatientPrescriptionPreview(patient, record, index);
    if (!openPatientPrescriptionDocument(prescription, true)) {
      this.toast.error('Unable to open prescription', 'Allow pop-ups for this site and try again.');
    }
  }

  protected downloadPatientPrescription(patient: PatientProfile, record: PatientConnectedRecord, index: number): void {
    const prescription = buildPatientPrescriptionPreview(patient, record, index);
    if (openPatientPrescriptionDocument(prescription, true)) {
      this.toast.info('Download prescription', 'Use the print dialog and choose Save as PDF.');
    } else {
      this.toast.error('Unable to open prescription', 'Allow pop-ups for this site and try again.');
    }
  }

  protected async sharePatientPrescription(patient: PatientProfile, record: PatientConnectedRecord, index: number): Promise<void> {
    await this.sharePrescriptionPreview(buildPatientPrescriptionPreview(patient, record, index));
  }

  protected printSelectedPrescription(): void {
    const prescription = this.selectedPrescription();
    if (!prescription) {
      return;
    }

    if (!openPatientPrescriptionDocument(prescription, true)) {
      this.toast.error('Unable to open prescription', 'Allow pop-ups for this site and try again.');
    }
  }

  protected downloadSelectedPrescription(): void {
    const prescription = this.selectedPrescription();
    if (!prescription) {
      return;
    }

    if (openPatientPrescriptionDocument(prescription, true)) {
      this.toast.info('Download prescription', 'Use the print dialog and choose Save as PDF.');
    } else {
      this.toast.error('Unable to open prescription', 'Allow pop-ups for this site and try again.');
    }
  }

  protected async shareSelectedPrescription(): Promise<void> {
    const prescription = this.selectedPrescription();
    if (!prescription) {
      return;
    }

    await this.sharePrescriptionPreview(prescription);
  }

  protected criticalAlerts(patient: PatientProfile): number {
    return patient.allergies.filter(allergy => allergy.isCritical || ['HIGH', 'SEVERE'].includes(allergy.severityCode)).length;
  }

  private async sharePrescriptionPreview(prescription: PatientPrescriptionPreview): Promise<void> {
    const text = patientPrescriptionPlainText(prescription);
    try {
      const browserNavigator = navigator as PatientPrescriptionNavigator;
      if (browserNavigator.share) {
        await browserNavigator.share({ title: `Prescription - ${prescription.prescriptionNo}`, text });
        this.toast.success('Prescription shared');
        return;
      }

      await browserNavigator.clipboard?.writeText(text);
      this.toast.success('Prescription copied', 'Prescription details copied to clipboard.');
    } catch {
      this.toast.error('Unable to share prescription');
    }
  }

  protected async allergyAction(action: 'Add Allergy' | 'Edit Allergy' | 'Mark Critical' | 'Deactivate Allergy'): Promise<void> {
    const currentPatient = this.patient();
    if (!currentPatient) {
      return;
    }

    try {
      if (action === 'Add Allergy') {
        const values = await this.dialog.form({
          title: 'Add Allergy',
          message: 'Capture allergy information for clinical safety alerts.',
          confirmText: 'Save Allergy',
          cancelText: 'Cancel',
          icon: 'emergency_home',
          intent: 'info',
          fields: [
            { name: 'allergen', label: 'Allergen name', required: true, placeholder: 'Example: Penicillin' },
            { name: 'allergyType', label: 'Allergy type', type: 'select', value: 'Drug', options: this.allergyTypeOptions, required: true },
            { name: 'reaction', label: 'Reaction', placeholder: 'Example: Rash, swelling, breathing issue' },
            { name: 'severityCode', label: 'Severity', type: 'select', value: 'MODERATE', options: this.allergySeverityOptions, required: true },
            { name: 'notes', label: 'Notes', type: 'textarea', rows: 3, placeholder: 'Clinical notes' }
          ]
        });
        if (!values) {
          return;
        }

        const severityCode = normalizeSeverity(values['severityCode']);
        const response = await this.service.createAllergy(currentPatient.patientGuid, {
          allergen: values['allergen'],
          allergyType: values['allergyType'] || 'General',
          reaction: values['reaction'] || '',
          severityCode,
          notes: values['notes'] || '',
          statusCode: 'ACTIVE',
          isCritical: isCriticalSeverity(severityCode)
        });
        if (!response.success || !response.data) {
          this.toast.error('Unable to save allergy', getApiErrorMessage(response, 'Patient allergy API failed'));
          return;
        }

        this.upsertAllergy(mapAllergyRecord(response.data), null);
      } else {
        const allergy = await this.selectAllergy(currentPatient.allergies);
        if (!allergy) {
          return;
        }

        if (action === 'Edit Allergy') {
          const values = await this.dialog.form({
            title: 'Edit Allergy',
            message: `Update the safety record for ${allergy.allergen}.`,
            confirmText: 'Save Allergy',
            cancelText: 'Cancel',
            icon: 'edit',
            intent: 'info',
            fields: [
              { name: 'allergen', label: 'Allergen name', value: allergy.allergen, required: true },
              { name: 'allergyType', label: 'Allergy type', type: 'select', value: allergy.allergyType || 'General', options: this.allergyTypeOptions, required: true },
              { name: 'reaction', label: 'Reaction', value: allergy.reaction || '' },
              { name: 'severityCode', label: 'Severity', type: 'select', value: normalizeSeverity(allergy.severityCode), options: this.allergySeverityOptions, required: true },
              { name: 'notes', label: 'Notes', type: 'textarea', rows: 3, value: allergy.notes || '' }
            ]
          });
          if (!values) {
            return;
          }

          const severityCode = normalizeSeverity(values['severityCode']);
          const response = await this.service.updateAllergy(currentPatient.patientGuid, allergy, {
            allergen: values['allergen'],
            allergyType: values['allergyType'] || 'General',
            reaction: values['reaction'],
            severityCode,
            notes: values['notes'],
            isCritical: allergy.isCritical || isCriticalSeverity(severityCode)
          });
          if (!response.success || !response.data) {
            this.toast.error('Unable to save allergy', getApiErrorMessage(response, 'Patient allergy API failed'));
            return;
          }

          this.upsertAllergy(mapAllergyRecord(response.data), allergy);
        } else if (action === 'Mark Critical') {
          const confirmed = await this.dialog.confirm({
            title: 'Mark allergy as critical?',
            message: `${allergy.allergen} will be highlighted as a critical clinical alert.`,
            confirmText: 'Mark Critical',
            cancelText: 'Cancel',
            icon: 'priority_high',
            intent: 'warning'
          });
          if (!confirmed) {
            return;
          }

          const response = await this.service.updateAllergy(currentPatient.patientGuid, allergy, { isCritical: true, severityCode: allergy.severityCode === 'UNKNOWN' ? 'SEVERE' : allergy.severityCode });
          if (!response.success || !response.data) {
            this.toast.error('Unable to save allergy', getApiErrorMessage(response, 'Patient allergy API failed'));
            return;
          }

          this.upsertAllergy(mapAllergyRecord(response.data), allergy);
        } else {
          const confirmed = await this.dialog.confirm({
            title: 'Deactivate allergy?',
            message: `${allergy.allergen} will no longer appear as an active allergy alert.`,
            confirmText: 'Deactivate',
            cancelText: 'Cancel',
            icon: 'block',
            intent: 'warning'
          });
          if (!confirmed) {
            return;
          }

          const response = await this.service.updateAllergy(currentPatient.patientGuid, allergy, { statusCode: 'INACTIVE' });
          if (!response.success || !response.data) {
            this.toast.error('Unable to save allergy', getApiErrorMessage(response, 'Patient allergy API failed'));
            return;
          }

          this.upsertAllergy(mapAllergyRecord(response.data), allergy);
        }
      }

      this.toast.success(`${action} saved`);
    } catch {
      this.toast.error('Unable to save allergy');
    }
  }

  private async selectAllergy(allergies: PatientAllergy[]): Promise<PatientAllergy | null> {
    if (allergies.length === 0) {
      this.toast.warning('No allergy selected', 'Add an allergy before editing or deactivating.');
      return null;
    }

    if (allergies.length === 1) {
      return allergies[0];
    }

    const values = await this.dialog.form({
      title: 'Select Allergy',
      message: 'Choose the allergy record to update.',
      confirmText: 'Continue',
      cancelText: 'Cancel',
      icon: 'emergency_home',
      intent: 'info',
      fields: [
        {
          name: 'allergyGuid',
          label: 'Allergy',
          type: 'select',
          value: allergies[0]?.allergyGuid,
          required: true,
          options: allergies.map(allergy => ({
            label: `${allergy.allergen} - ${allergy.severityName || allergy.severityCode}`,
            value: allergy.allergyGuid
          }))
        }
      ]
    });

    return allergies.find(allergy => allergy.allergyGuid === values?.['allergyGuid']) ?? null;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  protected formatDateTime(value: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  protected currency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private upsertAllergy(allergy: PatientAllergy, previous: PatientAllergy | null): void {
    this.patient.update(current => {
      if (!current) {
        return current;
      }

      const exists = current.allergies.some(item => item.allergyGuid === allergy.allergyGuid);
      const allergies = exists
        ? current.allergies.map(item => item.allergyGuid === allergy.allergyGuid ? allergy : item)
        : [allergy, ...current.allergies];

      return {
        ...current,
        allergies,
        overview: updateAllergyOverview(current.overview, previous, allergy)
      };
    });
  }
}

interface PatientPrescriptionPreview {
  prescriptionNo: string;
  patientName: string;
  mrn: string;
  doctor: string;
  date: string;
  status: string;
  sourceModule: string;
  recordType: string;
  summary: string;
  details: PatientPrescriptionDetails;
}

interface PrescriptionKeyValue {
  label: string;
  value: string;
}

interface PrescriptionMedicinePreview {
  name: string;
  dosage: string;
  quantity: string;
  frequency: string;
  route: string;
  duration: string;
  instruction: string;
}

interface PatientPrescriptionDetails {
  context: PrescriptionKeyValue[];
  vitals: PrescriptionKeyValue[];
  medicines: PrescriptionMedicinePreview[];
  investigations: string[];
  procedures: string[];
  advice: string[];
  dietAdvice: string[];
  followUp: PrescriptionKeyValue[];
  hasStructuredContent: boolean;
}

interface PatientPrescriptionNavigator {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: Clipboard;
}

function buildPatientPrescriptionPreview(patient: PatientProfile | null, record: PatientConnectedRecord, index: number): PatientPrescriptionPreview {
  const summary = record.subtitle || record.title || 'Prescription linked to patient OPD encounter.';
  return {
    prescriptionNo: extractPrescriptionNo(record, index),
    patientName: patient?.fullName || 'Patient',
    mrn: patient?.medicalRecordNo || '-',
    doctor: extractPrescriptionDoctor(record),
    date: formatPatientPrescriptionDate(record.eventDate),
    status: titleCase(record.statusCode || 'Finalized'),
    sourceModule: record.sourceModule || 'OPD',
    recordType: record.recordType || 'Prescription',
    summary,
    details: parsePatientPrescriptionDetails(summary)
  };
}

function extractPrescriptionNo(record: PatientConnectedRecord, index: number): string {
  const source = [record.title, record.subtitle, record.recordGuid].filter(Boolean).join(' ');
  const matched = source.match(/\bRX[-\w]*\d+\b/i);
  if (matched) {
    return matched[0].toUpperCase();
  }

  const digits = record.recordGuid.replace(/\D/g, '').slice(-6);
  return `RX-${(digits || String(index + 1)).padStart(6, '0')}`;
}

function extractPrescriptionDoctor(record: PatientConnectedRecord): string {
  const source = record.subtitle || record.title || '';
  const doctorMatch = source.match(/Dr\.?\s+[A-Za-z .]+/i);
  if (doctorMatch) {
    return doctorMatch[0].trim();
  }

  const parts = source.split(/[·|,-]/).map(part => part.trim()).filter(Boolean);
  const probableDoctor = parts.find(part => /doctor|dr\.?/i.test(part)) || parts.find(part => /^[A-Za-z .]{3,}$/.test(part));
  return probableDoctor || 'Doctor not available';
}

function formatPatientPrescriptionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function parsePatientPrescriptionDetails(summary: string): PatientPrescriptionDetails {
  const sections = splitPrescriptionSections(summary);
  const details: PatientPrescriptionDetails = {
    context: parseKeyValues(sections.get('prescription context') ?? []),
    vitals: parseKeyValues(sections.get('vitals') ?? []),
    medicines: parseMedicines(sections.get('medicines') ?? []),
    investigations: sections.get('investigations') ?? [],
    procedures: sections.get('procedures') ?? [],
    advice: sections.get('advice') ?? [],
    dietAdvice: sections.get('diet advice') ?? [],
    followUp: parseKeyValues(sections.get('follow-up') ?? []),
    hasStructuredContent: false
  };

  details.hasStructuredContent = Boolean(
    details.context.length ||
    details.vitals.length ||
    details.medicines.length ||
    details.investigations.length ||
    details.procedures.length ||
    details.advice.length ||
    details.dietAdvice.length ||
    details.followUp.length
  );
  return details;
}

function splitPrescriptionSections(summary: string): Map<string, string[]> {
  const normalized = summary.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  const headingPattern = /##\s+([A-Za-z][A-Za-z /-]*?)(?=\s+-\s+|$)/g;
  const headings = [...normalized.matchAll(headingPattern)];
  const sections = new Map<string, string[]>();

  headings.forEach((heading, index) => {
    const title = normalizePrescriptionHeading(heading[1]);
    const contentStart = (heading.index ?? 0) + heading[0].length;
    const contentEnd = headings[index + 1]?.index ?? normalized.length;
    const items = normalized
      .slice(contentStart, contentEnd)
      .split(/\s+-\s+/)
      .map(item => item.trim())
      .filter(Boolean);

    if (items.length) {
      sections.set(title, items);
    }
  });

  return sections;
}

function normalizePrescriptionHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseKeyValues(items: string[]): PrescriptionKeyValue[] {
  return items
    .map(item => {
      const separatorIndex = item.indexOf(':');
      if (separatorIndex < 1) {
        return { label: 'Detail', value: item };
      }

      return {
        label: item.slice(0, separatorIndex).trim(),
        value: item.slice(separatorIndex + 1).trim() || '-'
      };
    })
    .filter(item => item.value && item.value !== '-');
}

function parseMedicines(items: string[]): PrescriptionMedicinePreview[] {
  return items
    .map(item => {
      const parts = item.split('|').map(part => part.trim()).filter(Boolean);
      const [medicine = '', strength = '', dosageForm = '', dosage = '', quantity = '', frequency = '', route = '', duration = '', ...instructionParts] = parts;
      const name = [medicine, strength, dosageForm].filter(Boolean).join(' ') || item;
      const instruction = instructionParts.join(' · ') || '-';
      return {
        name,
        dosage,
        quantity,
        frequency,
        route,
        duration,
        instruction
      };
    })
    .filter(item => item.name.length > 0);
}

function patientPrescriptionPlainText(prescription: PatientPrescriptionPreview): string {
  const details = prescription.details;
  const medicines = details.medicines.map((medicine, index) => {
    const schedule = [medicine.dosage, medicine.frequency, medicine.route, medicine.duration, medicine.quantity].filter(Boolean).join(' · ');
    return `${index + 1}. ${medicine.name}${schedule ? ` — ${schedule}` : ''}${medicine.instruction && medicine.instruction !== '-' ? ` (${medicine.instruction})` : ''}`;
  });

  return [
    'Care360 Medication Prescription',
    `Prescription No: ${prescription.prescriptionNo}`,
    `Patient: ${prescription.patientName}`,
    `MRN: ${prescription.mrn}`,
    `Doctor: ${prescription.doctor}`,
    `Date: ${prescription.date}`,
    `Status: ${prescription.status}`,
    '',
    'Medicines:',
    ...(medicines.length ? medicines : ['No medicines recorded.']),
    ...(details.advice.length || details.dietAdvice.length ? ['', 'Advice:', ...[...details.advice, ...details.dietAdvice].map(item => `- ${item}`)] : []),
    ...(details.followUp.length ? ['', 'Follow-up:', ...details.followUp.map(item => `- ${item.label}: ${item.value}`)] : [])
  ].join('\n');
}

function openPatientPrescriptionDocument(prescription: PatientPrescriptionPreview, autoPrint: boolean): boolean {
  const popup = window.open('', '_blank', 'width=900,height=780');
  if (!popup) {
    return false;
  }

  popup.document.open();
  popup.document.write(printablePatientPrescriptionHtml(prescription, autoPrint));
  popup.document.close();
  popup.focus();
  return true;
}

function printablePatientPrescriptionHtml(prescription: PatientPrescriptionPreview, autoPrint: boolean): string {
  return `<!doctype html>
<html>
<head>
  <title>${escapeHtml(prescription.prescriptionNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; color: #0f172a; font-family: Arial, sans-serif; background: #eef4fb; }
    main { max-width: 900px; margin: 0 auto; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 18px; background: #fff; box-shadow: 0 24px 70px rgba(15, 23, 42, .12); }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 30px 34px; color: #fff; background: linear-gradient(135deg, #0f4c81, #1d64d8); }
    h1, h2, p { margin: 0; }
    .eyebrow { color: #bfdbfe; font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin-top: 8px; font-size: 30px; line-height: 1.05; }
    .header-meta { display: grid; gap: 8px; min-width: 180px; text-align: right; }
    .rx-no { font-size: 22px; font-weight: 900; }
    .status-pill { justify-self: end; display: inline-flex; padding: 6px 11px; border-radius: 999px; background: rgba(255, 255, 255, .16); color: #eff6ff; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .muted { color: #dbeafe; font-weight: 700; }
    .meta-grid { display: grid; grid-template-columns: 1.1fr .9fr 1fr; gap: 12px; padding: 20px 34px; border-bottom: 1px solid #dbe4f0; background: #f8fbff; }
    .meta-grid > div { display: grid; gap: 5px; min-height: 74px; padding: 14px 16px; border: 1px solid #dbe4f0; border-radius: 14px; background: #fff; }
    small { color: #64748b; font-size: 11px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
    strong { font-size: 16px; line-height: 1.3; }
    article { padding: 22px 34px 28px; }
    article p { margin-top: 8px; color: #334155; font-weight: 700; line-height: 1.55; }
    .rx-section { margin-top: 14px; padding: 16px; border: 1px solid #dbe4f0; border-radius: 16px; background: #f8fafc; }
    .rx-section.primary { border-color: #bfdbfe; background: linear-gradient(180deg, #f8fbff, #fff); }
    .rx-section h2 { margin: 0 0 12px; font-size: 17px; color: #0f172a; }
    .rx-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .rx-grid.compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .rx-grid div, .rx-chip { border: 1px solid #dbe4f0; border-radius: 10px; background: #fff; }
    .rx-grid div { display: grid; gap: 5px; padding: 10px 11px; }
    .rx-grid strong, .rx-med strong { overflow-wrap: anywhere; }
    .rx-table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 12px; background: #fff; }
    .rx-table th { padding: 10px 11px; color: #475569; background: #eaf2fb; font-size: 11px; letter-spacing: .06em; text-align: left; text-transform: uppercase; }
    .rx-table td { padding: 12px 11px; border-top: 1px solid #e5edf7; vertical-align: top; font-size: 13px; line-height: 1.35; }
    .rx-table td:first-child { color: #64748b; font-weight: 900; }
    .rx-table strong { display: block; font-size: 14px; }
    .rx-table .muted-cell { color: #64748b; font-weight: 700; }
    .empty-note { padding: 16px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b; font-weight: 800; text-align: center; background: #fff; }
    .rx-chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .rx-chip { padding: 7px 10px; color: #334155; font-size: 13px; font-weight: 700; }
    .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; padding: 18px 34px 26px; border-top: 1px solid #dbe4f0; }
    .sign-box { min-height: 74px; display: grid; align-content: end; gap: 5px; border-top: 1px solid #94a3b8; padding-top: 8px; color: #0f172a; font-weight: 900; }
    .sign-box span { color: #64748b; font-size: 12px; font-weight: 800; }
    footer { padding: 13px 34px; color: #64748b; font-size: 12px; font-weight: 700; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    @media (max-width: 700px) { header, .sign-row { grid-template-columns: 1fr; } header { display: grid; } .header-meta { text-align: left; } .status-pill { justify-self: start; } .rx-grid, .rx-grid.compact, .meta-grid { grid-template-columns: 1fr; } }
    @media print { body { padding: 0; background: white; } main { border-radius: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Care360 Hospital</p>
        <h1>Medication Prescription</h1>
        <p class="muted">Clinical prescription for pharmacy dispensing and patient counselling</p>
      </div>
      <div class="header-meta">
        <span class="rx-no">${escapeHtml(prescription.prescriptionNo)}</span>
        <span class="muted">${escapeHtml(prescription.date)}</span>
        <span class="status-pill">${escapeHtml(prescription.status)}</span>
      </div>
    </header>
    <section class="meta-grid">
      <div><small>Patient</small><strong>${escapeHtml(prescription.patientName)}</strong></div>
      <div><small>MRN</small><strong>${escapeHtml(prescription.mrn)}</strong></div>
      <div><small>Doctor</small><strong>${escapeHtml(prescription.doctor)}</strong></div>
    </section>
    <article>
      ${patientPrescriptionPrintableContent(prescription)}
    </article>
    <section class="sign-row">
      <div class="sign-box">Dr. ${escapeHtml(prescription.doctor.replace(/^Dr\.?\s*/i, ''))}<span>Prescribing doctor</span></div>
      <div class="sign-box">Care360 e-Prescription<span>Generated electronically · no internal IDs shown</span></div>
    </section>
    <footer>Review dose, route, frequency, duration, and counselling instructions before dispensing.</footer>
  </main>
  ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 150));</script>' : ''}
</body>
</html>`;
}

function patientPrescriptionPrintableContent(prescription: PatientPrescriptionPreview): string {
  const details = prescription.details;
  if (!details.hasStructuredContent) {
    return `<p>${escapeHtml(prescription.summary)}</p>`;
  }

  return [
    printableMedicineSection(details.medicines),
    printableKeyValueSection('Vitals', details.vitals, 'compact'),
    printableChipSection('Orders & Procedures', [...details.investigations, ...details.procedures]),
    printableChipSection('Advice', [...details.advice, ...details.dietAdvice]),
    printableKeyValueSection('Follow-up', details.followUp, 'compact')
  ].filter(Boolean).join('');
}

function printableKeyValueSection(title: string, items: PrescriptionKeyValue[], className = ''): string {
  if (!items.length) {
    return '';
  }

  return `<div class="rx-section"><h2>${escapeHtml(title)}</h2><div class="rx-grid ${className}">${items.map(item => `
    <div><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></div>
  `).join('')}</div></div>`;
}

function printableMedicineSection(items: PrescriptionMedicinePreview[]): string {
  return `<div class="rx-section primary"><h2>Medicines</h2>${items.length ? `
    <table class="rx-table">
      <thead>
        <tr><th>#</th><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Route</th><th>Duration / Qty</th><th>Instructions</th></tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${escapeHtml(item.dosage || '-')}</td>
            <td>${escapeHtml(item.frequency || '-')}</td>
            <td>${escapeHtml(item.route || '-')}</td>
            <td>${escapeHtml([item.duration, item.quantity].filter(Boolean).join(' / ') || '-')}</td>
            <td class="muted-cell">${escapeHtml(item.instruction && item.instruction !== '-' ? item.instruction : 'As directed')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<div class="empty-note">No medicines recorded for this prescription.</div>'}</div>`;
}

function printableChipSection(title: string, items: string[]): string {
  if (!items.length) {
    return '';
  }

  return `<div class="rx-section"><h2>${escapeHtml(title)}</h2><div class="rx-chip-list">${items.map(item => `
    <span class="rx-chip">${escapeHtml(item)}</span>
  `).join('')}</div></div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char] || char);
}

function normalizeSeverity(value: string | null | undefined): string {
  const severity = (value || 'MODERATE').trim().toUpperCase();
  return ['LOW', 'MILD', 'MODERATE', 'HIGH', 'SEVERE'].includes(severity) ? severity : 'MODERATE';
}

function isCriticalSeverity(value: string): boolean {
  return ['HIGH', 'SEVERE'].includes(normalizeSeverity(value));
}

function mapAllergyRecord(record: PatientAllergyRecord): PatientAllergy {
  const severityCode = normalizeSeverity(record.severityCode);
  return {
    allergyGuid: record.id,
    allergyType: record.allergyType || 'General',
    allergen: record.allergyName,
    reaction: record.reaction,
    severityCode,
    severityName: severityName(severityCode),
    statusCode: record.statusCode || 'ACTIVE',
    isCritical: Boolean(record.isCritical),
    recordedOn: null,
    notes: record.notes
  };
}

function updateAllergyOverview(overview: PatientProfileOverview, previous: PatientAllergy | null, next: PatientAllergy): PatientProfileOverview {
  const previousActive = previous && previous.statusCode !== 'INACTIVE' ? 1 : 0;
  const nextActive = next.statusCode !== 'INACTIVE' ? 1 : 0;

  return {
    ...overview,
    activeAllergies: Math.max(0, overview.activeAllergies + nextActive - previousActive)
  };
}

function severityName(severityCode: string): string {
  const label = severityCode.toLowerCase().replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
