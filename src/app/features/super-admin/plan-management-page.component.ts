import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  Feature,
  LimitDefinition,
  Plan,
  PlanCatalog,
  UpsertFeatureRequest,
  UpsertLimitDefinitionRequest,
  UpsertPlanRequest
} from './plan-management.models';
import { PlanManagementService } from './plan-management.service';

type PlanTab = 'plans' | 'features' | 'pricing' | 'limits';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="plan-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Plan Management</p>
          <h1 class="ac-page-title">Plans, Features, Pricing, Limits</h1>
          <p>Configure SaaS packages, usage ceilings, feature availability, tenant counts, and commercial settings.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin" title="Open Super Admin dashboard">
            <span class="material-symbols-rounded">dashboard</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh plans">
            <span class="material-symbols-rounded">refresh</span>
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="startNewPlan()">
            <span class="material-symbols-rounded">add</span>
            New Plan
          </button>
        </div>
      </header>

      <nav class="tabs" aria-label="Plan management sections">
        <button type="button" [class.active]="activeTab() === 'plans'" (click)="activeTab.set('plans')">
          <span class="material-symbols-rounded">workspace_premium</span>
          Plans
        </button>
        <button type="button" [class.active]="activeTab() === 'features'" (click)="activeTab.set('features')">
          <span class="material-symbols-rounded">toggle_on</span>
          Features
        </button>
        <button type="button" [class.active]="activeTab() === 'pricing'" (click)="activeTab.set('pricing')">
          <span class="material-symbols-rounded">payments</span>
          Pricing
        </button>
        <button type="button" [class.active]="activeTab() === 'limits'" (click)="activeTab.set('limits')">
          <span class="material-symbols-rounded">speed</span>
          Limits
        </button>
      </nav>

      @if (catalog(); as model) {
        <section class="stat-grid">
          <article class="stat">
            <span class="material-symbols-rounded">workspace_premium</span>
            <p>Plans</p>
            <strong>{{ model.plans.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">toggle_on</span>
            <p>Features</p>
            <strong>{{ model.features.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">speed</span>
            <p>Limit Keys</p>
            <strong>{{ model.limitDefinitions.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">local_hospital</span>
            <p>Assigned Tenants</p>
            <strong>{{ assignedTenantCount() }}</strong>
          </article>
        </section>

        <section class="workspace-grid">
          <aside class="catalog-panel">
            <div class="section-head compact">
              <h2>Plan Catalog</h2>
              <span>{{ model.plans.length }} records</span>
            </div>
            <div class="plan-list">
              @for (plan of model.plans; track plan.code) {
                <button type="button" [class.active]="selectedPlanCode() === plan.code" (click)="selectPlan(plan)">
                  <span class="status-dot" [class.off]="!plan.isActive"></span>
                  <div>
                    <strong>{{ plan.name }}</strong>
                    <small>{{ plan.code }} | {{ plan.tenantCount }} tenants</small>
                  </div>
                  <span>{{ formatMoney(plan.monthlyPrice, plan.currencyCode) }}</span>
                </button>
              } @empty {
                <p class="empty">No plans configured.</p>
              }
            </div>
          </aside>

          <main class="editor-panel">
            <form (ngSubmit)="savePlan()">
              <div class="section-head">
                <div>
                  <h2>{{ planForm.name || 'Plan Configuration' }}</h2>
                  <p>{{ planForm.code || 'New plan' }}</p>
                </div>
                <div class="toggle-line">
                  <label class="switch">
                    <input type="checkbox" name="planActive" [(ngModel)]="planForm.isActive" />
                    <span>Active</span>
                  </label>
                  <label class="switch">
                    <input type="checkbox" name="planCustom" [(ngModel)]="planForm.isCustom" />
                    <span>Custom</span>
                  </label>
                </div>
              </div>

              @if (activeTab() === 'plans') {
                <section class="form-section">
                  <div class="form-grid">
                    <label>
                      <span>Plan Code</span>
                      <input name="code" [(ngModel)]="planForm.code" required />
                    </label>
                    <label>
                      <span>Name</span>
                      <input name="name" [(ngModel)]="planForm.name" required />
                    </label>
                    <label>
                      <span>Currency</span>
                      <input name="currencyCode" [(ngModel)]="planForm.currencyCode" required />
                    </label>
                    <label>
                      <span>Sort Order</span>
                      <input type="number" name="sortOrder" [(ngModel)]="planForm.sortOrder" />
                    </label>
                  </div>
                  <label>
                    <span>Description</span>
                    <textarea name="description" [(ngModel)]="planForm.description"></textarea>
                  </label>
                </section>
              }

              @if (activeTab() === 'pricing') {
                <section class="form-section">
                  <div class="pricing-grid">
                    <label>
                      <span>Monthly Price</span>
                      <input type="number" min="0" step="0.01" name="monthlyPrice" [(ngModel)]="planForm.monthlyPrice" />
                    </label>
                    <label>
                      <span>Annual Price</span>
                      <input type="number" min="0" step="0.01" name="annualPrice" [(ngModel)]="planForm.annualPrice" />
                    </label>
                    <div class="price-readout">
                      <span>Monthly</span>
                      <strong>{{ formatMoney(planForm.monthlyPrice, planForm.currencyCode) }}</strong>
                    </div>
                    <div class="price-readout">
                      <span>Annual</span>
                      <strong>{{ formatMoney(planForm.annualPrice, planForm.currencyCode) }}</strong>
                    </div>
                  </div>
                </section>
              }

              @if (activeTab() === 'limits') {
                <section class="form-section">
                  <div class="limit-grid">
                    @for (limit of model.limitDefinitions; track limit.limitKey) {
                      <label>
                        <span>{{ limit.label }} <small>{{ limit.unit }}</small></span>
                        <input
                          type="number"
                          min="0"
                          [name]="'limit_' + limit.limitKey"
                          [ngModel]="limitInput(limit.limitKey)"
                          (ngModelChange)="setLimitInput(limit.limitKey, $event)"
                          placeholder="Unlimited" />
                      </label>
                    }
                  </div>
                </section>
              }

              @if (activeTab() === 'features') {
                <section class="form-section">
                  <div class="feature-grid">
                    @for (feature of model.features; track feature.code) {
                      <label class="feature-toggle" [class.off]="!feature.isActive">
                        <input
                          type="checkbox"
                          [name]="'feature_' + feature.code"
                          [ngModel]="featureEnabled(feature.code)"
                          (ngModelChange)="setFeatureEnabled(feature.code, $event)" />
                        <span class="material-symbols-rounded">{{ featureEnabled(feature.code) ? 'toggle_on' : 'toggle_off' }}</span>
                        <strong>{{ feature.name }}</strong>
                        <small>{{ feature.category }}</small>
                      </label>
                    }
                  </div>
                </section>
              }

              <div class="form-actions">
                @if (selectedPlanCode()) {
                  @if (planForm.isActive) {
                    <button class="ac-btn ac-btn-secondary" type="button" (click)="deactivatePlan()">
                      <span class="material-symbols-rounded">block</span>
                      Deactivate
                    </button>
                  } @else {
                    <button class="ac-btn ac-btn-secondary" type="button" (click)="activatePlan()">
                      <span class="material-symbols-rounded">check_circle</span>
                      Activate
                    </button>
                  }
                }
                <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">
                  <span class="material-symbols-rounded">save</span>
                  Save Plan
                </button>
              </div>
            </form>

            <section class="definition-panels">
              <form class="definition-panel" (ngSubmit)="saveFeature()">
                <div class="section-head compact">
                  <h2>Feature</h2>
                  <button class="icon-btn" type="submit" title="Save feature">
                    <span class="material-symbols-rounded">save</span>
                  </button>
                </div>
                <div class="definition-grid">
                  <label>
                    <span>Code</span>
                    <input name="featureCode" [(ngModel)]="featureForm.code" />
                  </label>
                  <label>
                    <span>Name</span>
                    <input name="featureName" [(ngModel)]="featureForm.name" />
                  </label>
                  <label>
                    <span>Category</span>
                    <input name="featureCategory" [(ngModel)]="featureForm.category" />
                  </label>
                  <label>
                    <span>Sort</span>
                    <input type="number" name="featureSort" [(ngModel)]="featureForm.sortOrder" />
                  </label>
                </div>
                <label>
                  <span>Description</span>
                  <input name="featureDescription" [(ngModel)]="featureForm.description" />
                </label>
                <label class="switch small">
                  <input type="checkbox" name="featureActive" [(ngModel)]="featureForm.isActive" />
                  <span>Active</span>
                </label>
              </form>

              <form class="definition-panel" (ngSubmit)="saveLimitDefinition()">
                <div class="section-head compact">
                  <h2>Limit</h2>
                  <button class="icon-btn" type="submit" title="Save limit">
                    <span class="material-symbols-rounded">save</span>
                  </button>
                </div>
                <div class="definition-grid">
                  <label>
                    <span>Key</span>
                    <input name="limitKey" [(ngModel)]="limitForm.limitKey" />
                  </label>
                  <label>
                    <span>Label</span>
                    <input name="limitLabel" [(ngModel)]="limitForm.label" />
                  </label>
                  <label>
                    <span>Unit</span>
                    <input name="limitUnit" [(ngModel)]="limitForm.unit" />
                  </label>
                  <label>
                    <span>Sort</span>
                    <input type="number" name="limitSort" [(ngModel)]="limitForm.sortOrder" />
                  </label>
                </div>
                <label class="switch small">
                  <input type="checkbox" name="limitActive" [(ngModel)]="limitForm.isActive" />
                  <span>Active</span>
                </label>
              </form>
            </section>
          </main>
        </section>
      } @else {
        <section class="loading">Loading plans...</section>
      }
    </section>
  `,
  styles: `
    .plan-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .section-head, .head-actions, .tabs, .form-actions { display: flex; gap: 12px; }
    .page-head, .section-head { align-items: flex-start; justify-content: space-between; }
    .page-head p:not(.eyebrow), .section-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; max-width: 860px; }
    .eyebrow { margin: 0 0 4px; color: var(--ac-primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .head-actions { align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .icon-btn { width: 38px; height: 38px; min-width: 38px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); display: inline-grid; place-items: center; cursor: pointer; text-decoration: none; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .tabs { overflow-x: auto; padding-bottom: 2px; }
    .tabs button { height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text-2); font-weight: 800; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; }
    .tabs button.active { border-color: var(--ac-primary); color: var(--ac-primary); background: var(--ac-primary-light); }
    .tabs .material-symbols-rounded, .ac-btn .material-symbols-rounded { font-size: 18px; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat, .catalog-panel, .editor-panel, .definition-panel, .price-readout, .feature-toggle, .loading { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); }
    .stat { min-height: 100px; padding: 12px; display: flex; flex-direction: column; gap: 4px; border-top: 3px solid var(--ac-primary); }
    .stat .material-symbols-rounded { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .stat strong { font-size: 22px; line-height: 1.1; }
    .workspace-grid { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: 16px; align-items: start; }
    .catalog-panel, .editor-panel, .definition-panel { padding: 16px; }
    .section-head.compact h2 { margin: 0; font-size: 16px; }
    .section-head.compact span { color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .plan-list { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
    .plan-list button { min-height: 68px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 10px; background: var(--ac-bg); color: var(--ac-text); cursor: pointer; display: grid; grid-template-columns: 10px 1fr auto; align-items: center; gap: 10px; text-align: left; }
    .plan-list button.active { border-color: var(--ac-primary); background: var(--ac-primary-light); }
    .plan-list small { display: block; color: var(--ac-muted); font-size: 12px; margin-top: 3px; }
    .plan-list button > span:last-child { font-weight: 900; white-space: nowrap; }
    .status-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--ac-success); }
    .status-dot.off { background: var(--ac-muted); }
    .toggle-line { display: flex; gap: 12px; flex-wrap: wrap; }
    .switch { flex-direction: row; align-items: center; gap: 7px; min-height: 38px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    .switch input { width: 17px; height: 17px; }
    .switch.small { margin-top: 10px; min-height: 24px; }
    .form-section { margin-top: 16px; }
    .form-grid, .pricing-grid, .limit-grid, .definition-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .limit-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    label small { color: var(--ac-muted); font-weight: 700; }
    input, textarea { border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; min-width: 0; }
    input { height: 38px; }
    textarea { min-height: 86px; padding-top: 10px; resize: vertical; }
    input:focus, textarea:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .price-readout { min-height: 84px; padding: 12px; display: flex; flex-direction: column; justify-content: center; gap: 5px; }
    .price-readout span { color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .price-readout strong { font-size: 22px; }
    .feature-toggle { min-height: 76px; padding: 10px; display: grid; grid-template-columns: 28px 1fr; grid-template-rows: auto auto; align-items: center; column-gap: 8px; cursor: pointer; }
    .feature-toggle input { display: none; }
    .feature-toggle .material-symbols-rounded { grid-row: 1 / span 2; color: var(--ac-primary); }
    .feature-toggle small { color: var(--ac-muted); }
    .feature-toggle.off { opacity: .58; }
    .form-actions { justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--ac-border); flex-wrap: wrap; }
    .definition-panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .definition-panel { background: var(--ac-bg); }
    .definition-panel > label { margin-top: 10px; }
    .empty, .loading { margin: 0; padding: 24px; color: var(--ac-muted); text-align: center; font-size: 13px; }
    @media (max-width: 1280px) { .workspace-grid { grid-template-columns: 1fr; } .stat-grid, .form-grid, .pricing-grid, .limit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 820px) { .page-head, .head-actions { flex-direction: column; align-items: stretch; } .stat-grid, .form-grid, .pricing-grid, .limit-grid, .feature-grid, .definition-panels, .definition-grid { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanManagementPageComponent implements OnInit {
  protected readonly activeTab = signal<PlanTab>('plans');
  protected readonly catalog = signal<PlanCatalog | null>(null);
  protected readonly selectedPlanCode = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected planForm: UpsertPlanRequest = emptyPlanForm();
  protected featureForm: UpsertFeatureRequest = emptyFeatureForm();
  protected limitForm: UpsertLimitDefinitionRequest = emptyLimitDefinitionForm();
  private readonly limitValues = new Map<string, string>();
  private readonly featureValues = new Map<string, boolean>();

  protected readonly assignedTenantCount = computed(() =>
    this.catalog()?.plans.reduce((total, plan) => total + plan.tenantCount, 0).toLocaleString() ?? '0'
  );

  private readonly service = inject(PlanManagementService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    const response = await this.service.getCatalog();
    this.applyCatalog(response, true);
  }

  protected selectPlan(plan: Plan): void {
    this.selectedPlanCode.set(plan.code);
    this.planForm = {
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice,
      currencyCode: plan.currencyCode,
      isCustom: plan.isCustom,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      limits: [],
      features: []
    };
    this.limitValues.clear();
    for (const limit of plan.limits) {
      this.limitValues.set(limit.limitKey, limit.value === null ? '' : String(limit.value));
    }

    this.featureValues.clear();
    for (const feature of plan.features) {
      this.featureValues.set(feature.featureCode, feature.isEnabled);
    }
  }

  protected startNewPlan(): void {
    this.selectedPlanCode.set(null);
    this.planForm = emptyPlanForm();
    this.limitValues.clear();
    this.featureValues.clear();
    for (const feature of this.catalog()?.features ?? []) {
      this.featureValues.set(feature.code, false);
    }
    this.activeTab.set('plans');
  }

  protected async savePlan(): Promise<void> {
    const catalog = this.catalog();
    if (!catalog) {
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.service.savePlan({
        ...this.planForm,
        limits: catalog.limitDefinitions.map(definition => ({
          limitKey: definition.limitKey,
          value: parseLimit(this.limitValues.get(definition.limitKey))
        })),
        features: catalog.features.map(feature => ({
          featureCode: feature.code,
          isEnabled: this.featureValues.get(feature.code) ?? false
        }))
      });
      this.applyCatalog(response, false);
      if (response.success) {
        this.toast.success('Plan configuration saved.');
        this.reselectPlan(this.planForm.code);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async activatePlan(): Promise<void> {
    const code = this.selectedPlanCode();
    if (!code) {
      return;
    }

    const response = await this.service.activatePlan(code);
    this.applyCatalog(response, false);
    if (response.success) {
      this.toast.success('Plan activated.');
      this.reselectPlan(code);
    }
  }

  protected async deactivatePlan(): Promise<void> {
    const code = this.selectedPlanCode();
    if (!code || !window.confirm(`Deactivate ${code}?`)) {
      return;
    }

    const response = await this.service.deactivatePlan(code);
    this.applyCatalog(response, false);
    if (response.success) {
      this.toast.success('Plan deactivated.');
      this.reselectPlan(code);
    }
  }

  protected async saveFeature(): Promise<void> {
    const response = await this.service.saveFeature(this.featureForm);
    this.applyCatalog(response, false);
    if (response.success) {
      this.toast.success('Feature saved.');
      this.featureForm = emptyFeatureForm();
    }
  }

  protected async saveLimitDefinition(): Promise<void> {
    const response = await this.service.saveLimitDefinition(this.limitForm);
    this.applyCatalog(response, false);
    if (response.success) {
      this.toast.success('Limit definition saved.');
      this.limitForm = emptyLimitDefinitionForm();
    }
  }

  protected limitInput(limitKey: string): string {
    return this.limitValues.get(limitKey) ?? '';
  }

  protected setLimitInput(limitKey: string, value: string): void {
    this.limitValues.set(limitKey, value);
  }

  protected featureEnabled(featureCode: string): boolean {
    return this.featureValues.get(featureCode) ?? false;
  }

  protected setFeatureEnabled(featureCode: string, value: boolean): void {
    this.featureValues.set(featureCode, value);
  }

  protected formatMoney(value: number, currencyCode: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD', maximumFractionDigits: 0 }).format(value || 0);
  }

  private applyCatalog(response: { success: boolean; message: string; data: PlanCatalog | null }, selectFirst: boolean): void {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load plan catalog');
      return;
    }

    this.catalog.set(response.data);
    if (selectFirst && response.data.plans.length > 0) {
      this.selectPlan(response.data.plans[0]);
    }
  }

  private reselectPlan(planCode: string): void {
    const plan = this.catalog()?.plans.find(item => item.code === planCode.trim().toUpperCase().replace(/\s+/g, '_'));
    if (plan) {
      this.selectPlan(plan);
    }
  }
}

function emptyPlanForm(): UpsertPlanRequest {
  return {
    code: '',
    name: '',
    description: '',
    monthlyPrice: 0,
    annualPrice: 0,
    currencyCode: 'USD',
    isCustom: false,
    isActive: true,
    sortOrder: 0,
    limits: [],
    features: []
  };
}

function emptyFeatureForm(): UpsertFeatureRequest {
  return {
    code: '',
    name: '',
    description: '',
    category: 'General',
    isActive: true,
    sortOrder: 0
  };
}

function emptyLimitDefinitionForm(): UpsertLimitDefinitionRequest {
  return {
    limitKey: '',
    label: '',
    unit: 'count',
    valueType: 'Number',
    sortOrder: 0,
    isActive: true
  };
}

function parseLimit(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
