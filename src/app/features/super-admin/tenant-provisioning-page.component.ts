import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  ProvisionTenantResponse,
  ProvisioningFeatureOption,
  ProvisioningPlanOption,
  TenantProvisioningSnapshot
} from './tenant-provisioning.models';
import { TenantProvisioningService } from './tenant-provisioning.service';

type WizardStep = 'basic' | 'plan' | 'database' | 'admin' | 'features' | 'review' | 'provision';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="provision-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Tenant Provisioning</p>
          <h1 class="ac-page-title">Create Hospital</h1>
          <p>Provision PostgreSQL databases, seed RBAC, create the hospital admin, issue licenses, and update the master control plane.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/tenants" title="Open hospital list">
            <span class="material-symbols-rounded">corporate_fare</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh provisioning">
            <span class="material-symbols-rounded">refresh</span>
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="startWizard()">
            <span class="material-symbols-rounded">add_business</span>
            Create Hospital
          </button>
        </div>
      </header>

      @if (snapshot(); as model) {
        <section class="stat-grid">
          <article class="stat">
            <span class="material-symbols-rounded">deployed_code</span>
            <p>Provision Jobs</p>
            <strong>{{ model.recentJobs.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">pending_actions</span>
            <p>Running</p>
            <strong>{{ runningJobs() }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">dns</span>
            <p>DB Servers</p>
            <strong>{{ model.databaseServers.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">toggle_on</span>
            <p>Features</p>
            <strong>{{ model.features.length }}</strong>
          </article>
        </section>

        <section class="workspace-grid">
          <main class="wizard-panel">
            @if (wizardOpen()) {
              <nav class="stepper" aria-label="Create hospital wizard">
                @for (step of steps; track step.id; let index = $index) {
                  <button type="button" [class.active]="currentStepIndex() === index" [class.done]="currentStepIndex() > index" (click)="goTo(index)">
                    <span class="material-symbols-rounded">{{ step.icon }}</span>
                    <small>{{ index + 1 }}</small>
                    {{ step.label }}
                  </button>
                }
              </nav>

              <section class="step-body">
                @if (activeStep() === 'basic') {
                  <div class="form-grid">
                    <label>
                      Hospital Name
                      <input [(ngModel)]="form.hospitalName" name="hospitalName" (ngModelChange)="syncTenantCode()" placeholder="Apollo Care Center" />
                    </label>
                    <label>
                      Tenant Code
                      <input [(ngModel)]="form.tenantCode" name="tenantCode" placeholder="apollo-care" />
                    </label>
                    <label>
                      Mobile
                      <input [(ngModel)]="form.mobileNo" name="mobileNo" placeholder="+91 98765 43210" />
                    </label>
                    <label>
                      Time Zone
                      <input [(ngModel)]="form.timeZone" name="timeZone" placeholder="Asia/Kolkata" />
                    </label>
                  </div>
                }

                @if (activeStep() === 'plan') {
                  <div class="plan-grid">
                    @for (plan of model.plans; track plan.code) {
                      <button class="plan-card" type="button" [class.selected]="form.planCode === plan.code" (click)="selectPlan(plan)">
                        <span class="material-symbols-rounded">workspace_premium</span>
                        <strong>{{ plan.name }}</strong>
                        <small>{{ plan.code }}</small>
                        <b>{{ formatMoney(plan.annualPrice, plan.currencyCode) }}/yr</b>
                      </button>
                    }
                  </div>
                }

                @if (activeStep() === 'database') {
                  <div class="form-grid">
                    <label>
                      Database Server
                      <select [(ngModel)]="form.databaseServerKey" name="databaseServerKey">
                        @for (server of model.databaseServers; track server.serverKey) {
                          <option [value]="server.serverKey">{{ server.serverKey }} - {{ server.provider }} / {{ server.region }}</option>
                        }
                      </select>
                    </label>
                    <label>
                      Database Name
                      <input [(ngModel)]="form.databaseName" name="databaseName" [placeholder]="derivedDatabaseName()" />
                    </label>
                  </div>
                  <div class="server-list">
                    @for (server of model.databaseServers; track server.serverKey) {
                      <article>
                        <span class="material-symbols-rounded">dns</span>
                        <strong>{{ server.serverKey }}</strong>
                        <small>{{ server.status }} - {{ server.usedStorageGb }}GB / {{ server.capacityGb }}GB</small>
                      </article>
                    }
                  </div>
                }

                @if (activeStep() === 'admin') {
                  <div class="form-grid">
                    <label>
                      First Name
                      <input [(ngModel)]="form.adminFirstName" name="adminFirstName" />
                    </label>
                    <label>
                      Last Name
                      <input [(ngModel)]="form.adminLastName" name="adminLastName" />
                    </label>
                    <label>
                      Admin Email
                      <input [(ngModel)]="form.adminEmail" name="adminEmail" type="email" />
                    </label>
                    <label>
                      Password
                      <input [(ngModel)]="form.adminPassword" name="adminPassword" type="password" />
                    </label>
                    <label>
                      Admin Mobile
                      <input [(ngModel)]="form.adminMobileNo" name="adminMobileNo" />
                    </label>
                  </div>
                }

                @if (activeStep() === 'features') {
                  <div class="feature-toolbar">
                    <button class="ac-btn ac-btn-light" type="button" (click)="applyPlanFeatures()">
                      <span class="material-symbols-rounded">rule_settings</span>
                      Match Plan
                    </button>
                    <button class="ac-btn ac-btn-light" type="button" (click)="selectAllFeatures()">
                      <span class="material-symbols-rounded">select_check_box</span>
                      All
                    </button>
                    <button class="ac-btn ac-btn-light" type="button" (click)="clearFeatures()">
                      <span class="material-symbols-rounded">disabled_by_default</span>
                      None
                    </button>
                  </div>
                  <div class="feature-grid">
                    @for (feature of model.features; track feature.code) {
                      <button class="feature-toggle" type="button" [class.enabled]="featureEnabled(feature.code)" (click)="toggleFeature(feature)">
                        <span class="material-symbols-rounded">{{ featureEnabled(feature.code) ? 'check_circle' : 'radio_button_unchecked' }}</span>
                        <strong>{{ feature.name }}</strong>
                        <small>{{ feature.category }}</small>
                      </button>
                    }
                  </div>
                }

                @if (activeStep() === 'review') {
                  <div class="review-grid">
                    <article><span>Hospital</span><strong>{{ form.hospitalName || '-' }}</strong><small>{{ form.tenantCode || '-' }}</small></article>
                    <article><span>Plan</span><strong>{{ selectedPlan()?.name || '-' }}</strong><small>{{ selectedPlan()?.code || '-' }}</small></article>
                    <article><span>Database</span><strong>{{ form.databaseName || derivedDatabaseName() }}</strong><small>{{ form.databaseServerKey }}</small></article>
                    <article><span>Admin</span><strong>{{ form.adminFirstName }} {{ form.adminLastName }}</strong><small>{{ form.adminEmail || '-' }}</small></article>
                    <article><span>Features</span><strong>{{ enabledFeatureCount() }}</strong><small>enabled for this tenant</small></article>
                  </div>
                }

                @if (activeStep() === 'provision') {
                  <div class="provision-flow">
                    @for (item of progressItems; track item.percent) {
                      <article [class.done]="currentProgress() >= item.percent">
                        <b>{{ item.percent }}%</b>
                        <span>{{ item.label }}</span>
                      </article>
                    }
                  </div>

                  @if (lastResult(); as result) {
                    <div class="result-panel">
                      <span class="material-symbols-rounded">verified</span>
                      <div>
                        <strong>{{ result.hospitalName }} provisioned</strong>
                        <p>{{ result.databaseName }} - {{ result.licenseKey }}</p>
                      </div>
                    </div>
                  }

                  <button class="ac-btn ac-btn-primary provision-btn" type="button" [disabled]="provisioning()" (click)="provision()">
                    <span class="material-symbols-rounded">{{ provisioning() ? 'hourglass_top' : 'rocket_launch' }}</span>
                    {{ provisioning() ? 'Provisioning...' : 'Provision' }}
                  </button>
                }
              </section>

              <footer class="wizard-actions">
                <button class="ac-btn ac-btn-light" type="button" (click)="cancelWizard()">Cancel</button>
                <button class="ac-btn ac-btn-light" type="button" [disabled]="currentStepIndex() === 0" (click)="previousStep()">
                  <span class="material-symbols-rounded">chevron_left</span>
                  Back
                </button>
                <button class="ac-btn ac-btn-primary" type="button" [disabled]="currentStepIndex() === steps.length - 1" (click)="nextStep()">
                  Next
                  <span class="material-symbols-rounded">chevron_right</span>
                </button>
              </footer>
            } @else {
              <div class="empty-state">
                <span class="material-symbols-rounded">add_business</span>
                <h2>Create Hospital</h2>
                <p>Start the provisioning wizard to create a tenant database, admin user, license, and master control-plane records.</p>
                <button class="ac-btn ac-btn-primary" type="button" (click)="startWizard()">Create Hospital</button>
              </div>
            }
          </main>

          <aside class="jobs-panel">
            <h2>Recent Provisioning</h2>
            @for (job of model.recentJobs; track job.jobId) {
              <article class="job-card">
                <header>
                  <strong>{{ job.hospitalName || job.tenantCode }}</strong>
                  <span class="pill" [class]="statusClass(job.status)">{{ job.status }}</span>
                </header>
                <div class="bar"><i [style.width.%]="job.progressPercent"></i></div>
                <p>{{ job.currentStep || job.message }}</p>
                <small>{{ job.tenantCode }} - {{ job.createdAt | date:'medium' }}</small>
              </article>
            } @empty {
              <p class="empty">No provisioning jobs yet.</p>
            }
          </aside>
        </section>
      } @else {
        <section class="loading">Loading provisioning workspace...</section>
      }
    </section>
  `,
  styles: [`
    .provision-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .stat, .wizard-panel, .jobs-panel, .empty-state { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 8px; box-shadow: var(--ac-shadow-sm); }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); max-width: 820px; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .head-actions, .wizard-actions, .feature-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .icon-btn { width: 38px; height: 38px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); background: var(--ac-surface); text-decoration: none; cursor: pointer; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat { padding: 16px; display: grid; gap: 6px; }
    .stat span { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .stat strong { font-size: 28px; }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
    .wizard-panel, .jobs-panel { padding: 16px; }
    .stepper { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
    .stepper button { min-height: 72px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); color: var(--ac-text); display: grid; justify-items: center; gap: 2px; cursor: pointer; font-size: 12px; }
    .stepper button.active, .stepper button.done { border-color: var(--ac-primary); background: color-mix(in srgb, var(--ac-primary) 10%, var(--ac-surface)); }
    .stepper small { color: var(--ac-muted); }
    .step-body { min-height: 360px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    label { display: grid; gap: 6px; font-size: 13px; color: var(--ac-muted); font-weight: 700; }
    input, select { min-height: 40px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text); }
    .plan-grid, .feature-grid, .review-grid, .server-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .plan-card, .feature-toggle, .server-list article, .review-grid article, .result-panel, .job-card { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); padding: 14px; }
    .plan-card, .feature-toggle { text-align: left; display: grid; gap: 6px; color: var(--ac-text); cursor: pointer; }
    .plan-card.selected, .feature-toggle.enabled { border-color: var(--ac-primary); background: color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)); }
    .plan-card span, .feature-toggle span { color: var(--ac-primary); }
    .plan-card small, .feature-toggle small, .server-list small, .review-grid small, .job-card small { color: var(--ac-muted); }
    .feature-toolbar { margin-bottom: 12px; }
    .review-grid article { display: grid; gap: 6px; }
    .review-grid span { color: var(--ac-muted); font-size: 12px; text-transform: uppercase; font-weight: 700; }
    .provision-flow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .provision-flow article { border: 1px solid var(--ac-border); border-radius: 8px; padding: 14px; display: grid; gap: 4px; color: var(--ac-muted); }
    .provision-flow article.done { border-color: var(--ac-success); color: var(--ac-text); background: color-mix(in srgb, var(--ac-success) 10%, var(--ac-surface)); }
    .result-panel { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
    .result-panel span { color: var(--ac-success); }
    .result-panel p { margin: 4px 0 0; color: var(--ac-muted); }
    .provision-btn { min-width: 180px; }
    .wizard-actions { justify-content: flex-end; border-top: 1px solid var(--ac-border); padding-top: 14px; margin-top: 16px; }
    .jobs-panel { display: grid; gap: 12px; }
    .jobs-panel h2 { margin: 0; font-size: 18px; }
    .job-card { display: grid; gap: 8px; }
    .job-card header { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .job-card p { margin: 0; color: var(--ac-muted); }
    .bar { height: 8px; border-radius: 999px; background: var(--ac-border); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--ac-primary); }
    .pill { border-radius: 999px; padding: 4px 8px; font-size: 12px; background: var(--ac-border); color: var(--ac-text); }
    .pill.completed { background: color-mix(in srgb, var(--ac-success) 14%, var(--ac-surface)); color: var(--ac-success); }
    .pill.running { background: color-mix(in srgb, var(--ac-primary) 14%, var(--ac-surface)); color: var(--ac-primary); }
    .pill.failed { background: color-mix(in srgb, var(--ac-danger) 14%, var(--ac-surface)); color: var(--ac-danger); }
    .empty-state { min-height: 420px; display: grid; place-items: center; align-content: center; gap: 10px; text-align: center; padding: 32px; }
    .empty-state span { font-size: 44px; color: var(--ac-primary); }
    .empty-state h2, .empty-state p { margin: 0; }
    .empty-state p, .empty, .loading { color: var(--ac-muted); }
    .loading { padding: 24px; }
    @media (max-width: 1100px) {
      .workspace-grid, .stat-grid { grid-template-columns: 1fr; }
      .stepper, .plan-grid, .feature-grid, .review-grid, .server-list, .provision-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .page-head { flex-direction: column; }
      .form-grid, .stepper, .plan-grid, .feature-grid, .review-grid, .server-list, .provision-flow { grid-template-columns: 1fr; }
    }
  `]
})
export class TenantProvisioningPageComponent implements OnInit {
  private readonly provisioningService = inject(TenantProvisioningService);
  private readonly toast = inject(ToastService);

  protected readonly snapshot = signal<TenantProvisioningSnapshot | null>(null);
  protected readonly wizardOpen = signal(false);
  protected readonly provisioning = signal(false);
  protected readonly currentStepIndex = signal(0);
  protected readonly selectedFeatureCodes = signal<Set<string>>(new Set());
  protected readonly lastResult = signal<ProvisionTenantResponse | null>(null);
  private codeSyncedFromName = true;

  protected readonly steps: { id: WizardStep; label: string; icon: string }[] = [
    { id: 'basic', label: 'Basic Information', icon: 'badge' },
    { id: 'plan', label: 'Plan', icon: 'workspace_premium' },
    { id: 'database', label: 'Database', icon: 'dns' },
    { id: 'admin', label: 'Admin User', icon: 'admin_panel_settings' },
    { id: 'features', label: 'Features', icon: 'toggle_on' },
    { id: 'review', label: 'Review', icon: 'fact_check' },
    { id: 'provision', label: 'Provision', icon: 'rocket_launch' }
  ];

  protected readonly progressItems = [
    { percent: 10, label: 'Create PostgreSQL DB' },
    { percent: 30, label: 'Run Migration Scripts' },
    { percent: 65, label: 'Seed Roles, Permissions, Admin' },
    { percent: 100, label: 'Generate License, Update Master, Complete' }
  ];

  protected readonly activeStep = computed(() => this.steps[this.currentStepIndex()]?.id ?? 'basic');
  protected readonly currentProgress = computed(() => this.lastResult()?.job.progressPercent ?? (this.provisioning() ? 30 : 0));
  protected readonly runningJobs = computed(() => this.snapshot()?.recentJobs.filter(job => job.status === 'RUNNING').length ?? 0);

  protected form = this.createEmptyForm();

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    const response = await this.provisioningService.getSnapshot();
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load provisioning workspace');
      return;
    }

    this.snapshot.set(response.data);
    if (!this.form.planCode && response.data.plans.length > 0) {
      this.selectPlan(response.data.plans[0]);
    }
    if (!this.form.databaseServerKey && response.data.databaseServers.length > 0) {
      this.form.databaseServerKey = response.data.databaseServers[0].serverKey;
    }
  }

  protected startWizard(): void {
    this.form = this.createEmptyForm();
    const model = this.snapshot();
    if (model?.plans.length) {
      this.selectPlan(model.plans[0]);
    }
    if (model?.databaseServers.length) {
      this.form.databaseServerKey = model.databaseServers[0].serverKey;
    }
    this.currentStepIndex.set(0);
    this.lastResult.set(null);
    this.wizardOpen.set(true);
    this.codeSyncedFromName = true;
  }

  protected cancelWizard(): void {
    this.wizardOpen.set(false);
  }

  protected nextStep(): void {
    if (this.currentStepIndex() < this.steps.length - 1) {
      this.currentStepIndex.update(value => value + 1);
    }
  }

  protected previousStep(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update(value => value - 1);
    }
  }

  protected goTo(index: number): void {
    this.currentStepIndex.set(index);
  }

  protected syncTenantCode(): void {
    if (!this.codeSyncedFromName && this.form.tenantCode.trim()) {
      return;
    }

    this.form.tenantCode = this.slugify(this.form.hospitalName);
    this.codeSyncedFromName = true;
  }

  protected selectPlan(plan: ProvisioningPlanOption): void {
    this.form.planCode = plan.code;
    this.applyPlanFeatures(plan);
  }

  protected selectedPlan(): ProvisioningPlanOption | undefined {
    return this.snapshot()?.plans.find(plan => plan.code === this.form.planCode);
  }

  protected applyPlanFeatures(plan = this.selectedPlan()): void {
    this.selectedFeatureCodes.set(new Set(plan?.enabledFeatureCodes ?? []));
  }

  protected selectAllFeatures(): void {
    this.selectedFeatureCodes.set(new Set(this.snapshot()?.features.map(feature => feature.code) ?? []));
  }

  protected clearFeatures(): void {
    this.selectedFeatureCodes.set(new Set());
  }

  protected toggleFeature(feature: ProvisioningFeatureOption): void {
    const next = new Set(this.selectedFeatureCodes());
    if (next.has(feature.code)) {
      next.delete(feature.code);
    } else {
      next.add(feature.code);
    }
    this.selectedFeatureCodes.set(next);
  }

  protected featureEnabled(featureCode: string): boolean {
    return this.selectedFeatureCodes().has(featureCode);
  }

  protected enabledFeatureCount(): number {
    return this.selectedFeatureCodes().size;
  }

  protected derivedDatabaseName(): string {
    return `care360_tenant_${(this.form.tenantCode || 'hospital').replace(/-/g, '_')}`;
  }

  protected async provision(): Promise<void> {
    if (!this.isValid()) {
      return;
    }

    this.provisioning.set(true);
    const response = await this.provisioningService.provisionTenant({
      ...this.form,
      databaseName: this.form.databaseName?.trim() || null,
      enabledFeatureCodes: Array.from(this.selectedFeatureCodes())
    });
    this.provisioning.set(false);

    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Provisioning failed');
      await this.load();
      return;
    }

    this.lastResult.set(response.data);
    this.toast.success('Hospital provisioned.');
    await this.load();
  }

  protected formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(value || 0);
  }

  protected statusClass(status: string): string {
    return status.toLowerCase();
  }

  private isValid(): boolean {
    if (!this.form.hospitalName.trim() || !this.form.tenantCode.trim() || !this.form.planCode || !this.form.databaseServerKey) {
      this.toast.error('Hospital, tenant code, plan, and database server are required.');
      return false;
    }
    if (!this.form.adminFirstName.trim() || !this.form.adminLastName.trim() || !this.form.adminEmail.trim() || !this.form.adminPassword.trim()) {
      this.toast.error('Admin name, email, and password are required.');
      return false;
    }
    if (this.form.adminPassword.length < 8) {
      this.toast.error('Admin password must be at least 8 characters.');
      return false;
    }
    return true;
  }

  private slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);
  }

  private createEmptyForm() {
    return {
      hospitalName: '',
      tenantCode: '',
      mobileNo: '',
      timeZone: 'Asia/Kolkata',
      planCode: '',
      databaseServerKey: '',
      databaseName: '',
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
      adminPassword: '',
      adminMobileNo: ''
    };
  }
}
