import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PatientProfile } from './patient-management.models';
import { PatientManagementService } from './patient-management.service';

type PatientProfileTab = 'overview' | 'contacts' | 'safety' | 'insurance' | 'documents' | 'appointments' | 'visits' | 'billing' | 'activity';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="patient-profile">
      <header class="profile-header">
        <a class="back-link" routerLink="/patients">
          <span class="material-symbols-rounded">arrow_back</span>
          Patient Registry
        </a>
        <button class="ac-btn ac-btn-secondary" type="button" (click)="reload()">
          <span class="material-symbols-rounded">refresh</span>
          Refresh
        </button>
      </header>

      @if (loading()) {
        <div class="profile-loader ac-card">Loading patient profile...</div>
      } @else if (patient(); as currentPatient) {
        <section class="hero-card ac-card">
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
            <strong>{{ currentPatient.statusName }}</strong>
            <small>Registered {{ formatDate(currentPatient.createdDate) }}</small>
          </div>
        </section>

        <section class="overview-grid">
          @for (card of overviewCards(); track card.label) {
            <article class="metric-card ac-card">
              <span class="material-symbols-rounded" [style.color]="card.color">{{ card.icon }}</span>
              <div>
                <strong>{{ card.value }}</strong>
                <small>{{ card.label }}</small>
              </div>
            </article>
          }
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
                <article>
                  <h2>Care summary</h2>
                  <div class="detail-grid">
                    <span><small>MRN</small><strong>{{ currentPatient.medicalRecordNo }}</strong></span>
                    <span><small>Date of birth</small><strong>{{ currentPatient.dateOfBirth ? formatDate(currentPatient.dateOfBirth) : '-' }}</strong></span>
                    <span><small>Last visit</small><strong>{{ formatDateTime(currentPatient.lastVisitDate) }}</strong></span>
                    <span><small>Outstanding</small><strong>{{ currency(currentPatient.billingSummary.outstandingBalance) }}</strong></span>
                  </div>
                </article>
                <article>
                  <h2>Clinical flags</h2>
                  @if (currentPatient.allergies.length > 0) {
                    <div class="chip-list">
                      @for (allergy of currentPatient.allergies.slice(0, 4); track allergy.allergyGuid) {
                        <span class="severity-chip">{{ allergy.allergen }} · {{ allergy.severityName }}</span>
                      }
                    </div>
                  } @else {
                    <p class="muted">No active allergy records captured.</p>
                  }
                </article>
              </div>
            }
            @case ('contacts') {
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
                  <div class="empty-state">No patient contacts captured yet.</div>
                }
              </div>
            }
            @case ('safety') {
              <div class="record-grid">
                @for (allergy of currentPatient.allergies; track allergy.allergyGuid) {
                  <article class="record-card warning">
                    <span class="material-symbols-rounded">warning</span>
                    <div>
                      <h3>{{ allergy.allergen }}</h3>
                      <p>{{ allergy.allergyType }} · {{ allergy.severityName }} · {{ allergy.statusCode }}</p>
                    </div>
                  </article>
                } @empty {
                  <div class="empty-state">No allergy or safety records captured yet.</div>
                }
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
            @case ('visits') {
              <div class="stacked-section">
                <div>
                  <h2>OPD/IPD visits</h2>
                  <div class="record-grid">
                    @for (record of currentPatient.visits; track record.recordGuid) {
                      <article class="record-card">
                        <span class="material-symbols-rounded">clinical_notes</span>
                        <div>
                          <h3>{{ record.recordType }} · {{ record.title }}</h3>
                          <p>{{ record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                        </div>
                      </article>
                    } @empty {
                      <div class="empty-state">No OPD/IPD visits linked yet.</div>
                    }
                  </div>
                </div>
                <div>
                  <h2>Lab orders</h2>
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
                      <div class="empty-state">No lab orders linked yet.</div>
                    }
                  </div>
                </div>
                <div>
                  <h2>Pharmacy</h2>
                  <div class="record-grid">
                    @for (record of currentPatient.pharmacySales; track record.recordGuid) {
                      <article class="record-card">
                        <span class="material-symbols-rounded">local_pharmacy</span>
                        <div>
                          <h3>{{ record.title }}</h3>
                          <p>{{ record.subtitle || record.statusCode }} · {{ formatDateTime(record.eventDate) }}</p>
                        </div>
                      </article>
                    } @empty {
                      <div class="empty-state">No pharmacy sales linked yet.</div>
                    }
                  </div>
                </div>
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
              <ol class="timeline">
                @for (event of currentPatient.timeline; track event.eventGuid + event.eventDate) {
                  <li>
                    <span></span>
                    <div>
                      <strong>{{ event.eventType }}</strong>
                      <p>{{ event.description }}</p>
                      <small>{{ event.sourceModule }} · {{ formatDateTime(event.eventDate) }}</small>
                    </div>
                  </li>
                } @empty {
                  <div class="empty-state">No activity captured yet.</div>
                }
              </ol>
            }
          }
        </section>
      } @else {
        <div class="profile-loader ac-card">Patient profile is not available.</div>
      }
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; }
    .patient-profile { height: 100%; min-height: 0; overflow: auto; display: grid; gap: 16px; padding-bottom: 8px; animation: slideUp .25s ease; }
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
    .chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .severity-chip { padding: 8px 10px; border-radius: var(--ac-r-full); background: rgba(244,63,94,.1); color: #e11d48; font-weight: 800; font-size: 12px; }
    .muted, .empty-state { color: var(--ac-muted); }
    .stacked-section { display: grid; gap: 18px; }
    .record-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .record-card { display: flex; align-items: flex-start; gap: 12px; min-height: 86px; padding: 14px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); background: var(--ac-surface-2); }
    .record-card .material-symbols-rounded { width: 38px; height: 38px; display: grid; place-items: center; border-radius: var(--ac-r-sm); background: var(--ac-primary-light); color: var(--ac-primary); flex: 0 0 auto; }
    .record-card.warning .material-symbols-rounded { background: rgba(244,63,94,.1); color: #e11d48; }
    .record-card h3 { margin: 0; color: var(--ac-text); font-size: 15px; }
    .record-card p { margin: 5px 0 0; color: var(--ac-muted); font-size: 13px; }
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientProfilePageComponent implements OnInit {
  protected readonly loading = signal(true);
  protected readonly patient = signal<PatientProfile | null>(null);
  protected readonly activeTab = signal<PatientProfileTab>('overview');
  protected readonly tabs: { id: PatientProfileTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'contacts', label: 'Contacts', icon: 'contact_phone' },
    { id: 'safety', label: 'Allergies', icon: 'emergency_home' },
    { id: 'insurance', label: 'Insurance', icon: 'health_and_safety' },
    { id: 'documents', label: 'Documents', icon: 'folder' },
    { id: 'appointments', label: 'Appointments', icon: 'event' },
    { id: 'visits', label: 'Visits', icon: 'stethoscope' },
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

}
