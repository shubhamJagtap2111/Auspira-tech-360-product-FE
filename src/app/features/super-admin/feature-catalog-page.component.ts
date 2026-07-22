import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { Feature, Plan, PlanCatalog, UpsertFeatureRequest } from './plan-management.models';
import { FeatureCatalogService } from './feature-catalog.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="feature-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Feature Catalog</p>
          <h1 class="ac-page-title">Feature Flags by Plan</h1>
          <p>Configure feature availability across plans from catalog records and plan assignments.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/plans" title="Open plans">
            <span class="material-symbols-rounded">workspace_premium</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh catalog">
            <span class="material-symbols-rounded">refresh</span>
          </button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="startNewFeature()">
            <span class="material-symbols-rounded">add</span>
            New Feature
          </button>
        </div>
      </header>

      @if (catalog(); as model) {
        <section class="stat-grid">
          <article class="stat">
            <span class="material-symbols-rounded">toggle_on</span>
            <p>Features</p>
            <strong>{{ model.features.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">workspace_premium</span>
            <p>Plans</p>
            <strong>{{ model.plans.length }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">task_alt</span>
            <p>Enabled Cells</p>
            <strong>{{ enabledCount() }}</strong>
          </article>
          <article class="stat">
            <span class="material-symbols-rounded">category</span>
            <p>Categories</p>
            <strong>{{ categoryCount() }}</strong>
          </article>
        </section>

        <section class="workspace-grid">
          <main class="matrix-panel">
            <div class="toolbar">
              <label>
                <span>Search</span>
                <input name="searchText" [(ngModel)]="searchText" placeholder="Feature or category" />
              </label>
              <label>
                <span>Category</span>
                <select name="categoryFilter" [(ngModel)]="categoryFilter">
                  <option value="">All</option>
                  @for (category of categories(); track category) {
                    <option [value]="category">{{ category }}</option>
                  }
                </select>
              </label>
            </div>

            <div class="matrix-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    @for (plan of model.plans; track plan.code) {
                      <th>
                        <span>{{ plan.name }}</span>
                        <small>{{ plan.code }}</small>
                      </th>
                    }
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (feature of filteredFeatures(); track feature.code) {
                    <tr [class.selected]="selectedFeatureCode() === feature.code">
                      <td>
                        <button class="feature-link" type="button" (click)="selectFeature(feature)">
                          <strong>{{ feature.name }}</strong>
                          <span>{{ feature.category }} | {{ feature.code }}</span>
                        </button>
                      </td>
                      @for (plan of model.plans; track plan.code) {
                        <td class="toggle-cell">
                          <button
                            type="button"
                            class="matrix-toggle"
                            [class.enabled]="isEnabled(plan, feature)"
                            (click)="toggleFeature(plan, feature)"
                            [attr.title]="plan.name + ' / ' + feature.name">
                            <span class="material-symbols-rounded">{{ isEnabled(plan, feature) ? 'check_circle' : 'cancel' }}</span>
                          </button>
                        </td>
                      }
                      <td>
                        <span class="pill" [class.off]="!feature.isActive">{{ feature.isActive ? 'Active' : 'Inactive' }}</span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td [attr.colspan]="model.plans.length + 2" class="empty">No features found.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </main>

          <aside class="editor-panel">
            <div class="section-head">
              <div>
                <h2>{{ featureForm.name || 'Feature' }}</h2>
                <p>{{ featureForm.code || 'Catalog record' }}</p>
              </div>
              <label class="switch">
                <input type="checkbox" name="featureActive" [(ngModel)]="featureForm.isActive" />
                <span>Active</span>
              </label>
            </div>

            <form (ngSubmit)="saveFeature()">
              <label>
                <span>Feature Code</span>
                <input name="code" [(ngModel)]="featureForm.code" required />
              </label>
              <label>
                <span>Name</span>
                <input name="name" [(ngModel)]="featureForm.name" required />
              </label>
              <label>
                <span>Category</span>
                <input name="category" [(ngModel)]="featureForm.category" />
              </label>
              <label>
                <span>Description</span>
                <textarea name="description" [(ngModel)]="featureForm.description"></textarea>
              </label>
              <label>
                <span>Sort Order</span>
                <input type="number" name="sortOrder" [(ngModel)]="featureForm.sortOrder" />
              </label>
              <div class="form-actions">
                <button class="ac-btn ac-btn-secondary" type="button" (click)="startNewFeature()">Reset</button>
                <button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">
                  <span class="material-symbols-rounded">save</span>
                  Save Feature
                </button>
              </div>
            </form>
          </aside>
        </section>
      } @else {
        <section class="loading">Loading feature catalog...</section>
      }
    </section>
  `,
  styles: `
    .feature-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .head-actions, .section-head, .toolbar, .form-actions { display: flex; gap: 12px; }
    .page-head, .section-head { align-items: flex-start; justify-content: space-between; }
    .page-head p:not(.eyebrow), .section-head p { margin: 4px 0 0; color: var(--ac-muted); font-size: 13px; max-width: 860px; }
    .eyebrow { margin: 0 0 4px; color: var(--ac-primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .head-actions { align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .icon-btn { width: 38px; height: 38px; min-width: 38px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-2); display: inline-grid; place-items: center; cursor: pointer; text-decoration: none; }
    .icon-btn:hover { border-color: var(--ac-primary); color: var(--ac-primary); }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat, .matrix-panel, .editor-panel, .loading { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-surface); }
    .stat { min-height: 100px; padding: 12px; display: flex; flex-direction: column; gap: 4px; border-top: 3px solid var(--ac-primary); }
    .stat .material-symbols-rounded { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .stat strong { font-size: 22px; line-height: 1.1; }
    .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 400px); gap: 16px; align-items: start; }
    .matrix-panel, .editor-panel { padding: 16px; }
    .toolbar { align-items: end; margin-bottom: 14px; }
    .toolbar label { min-width: 180px; flex: 1; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 12px; font-weight: 800; }
    input, select, textarea { border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); font: inherit; min-width: 0; }
    input, select { height: 38px; }
    textarea { min-height: 86px; padding-top: 10px; resize: vertical; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .matrix-wrap { overflow: auto; border: 1px solid var(--ac-border); border-radius: 8px; }
    table { width: 100%; min-width: 920px; border-collapse: collapse; }
    th, td { padding: 11px 12px; border-bottom: 1px solid var(--ac-border); text-align: left; vertical-align: middle; font-size: 13px; }
    th { color: var(--ac-muted); background: var(--ac-bg); font-size: 11px; text-transform: uppercase; }
    th small { display: block; margin-top: 2px; color: var(--ac-muted); font-size: 10px; }
    tr.selected td { background: rgba(37,99,235,.06); }
    .feature-link { border: 0; background: transparent; color: var(--ac-text); text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 3px; padding: 0; }
    .feature-link span { color: var(--ac-muted); font-size: 12px; }
    .toggle-cell { text-align: center; }
    .matrix-toggle { width: 34px; height: 34px; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-muted); background: var(--ac-surface); cursor: pointer; display: inline-grid; place-items: center; }
    .matrix-toggle.enabled { color: var(--ac-success-text); border-color: color-mix(in srgb, var(--ac-success) 36%, var(--ac-border)); background: var(--ac-success-light); }
    .matrix-toggle .material-symbols-rounded { font-size: 19px; }
    .pill { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 999px; background: rgba(22,163,74,.12); color: #15803d; font-size: 11px; font-weight: 900; }
    .pill.off { background: rgba(100,116,139,.12); color: #475569; }
    .switch { flex-direction: row; align-items: center; min-height: 32px; }
    .switch input { width: 17px; height: 17px; }
    .editor-panel form { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
    .form-actions { justify-content: flex-end; padding-top: 4px; flex-wrap: wrap; }
    .empty, .loading { margin: 0; padding: 24px; color: var(--ac-muted); text-align: center; font-size: 13px; }
    @media (max-width: 1280px) { .workspace-grid { grid-template-columns: 1fr; } .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .page-head, .head-actions, .toolbar { flex-direction: column; align-items: stretch; } .stat-grid { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureCatalogPageComponent implements OnInit {
  protected readonly catalog = signal<PlanCatalog | null>(null);
  protected readonly selectedFeatureCode = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected searchText = '';
  protected categoryFilter = '';
  protected featureForm: UpsertFeatureRequest = emptyFeatureForm();

  protected readonly categories = computed(() =>
    [...new Set((this.catalog()?.features ?? []).map(feature => feature.category))].sort((a, b) => a.localeCompare(b))
  );

  protected readonly filteredFeatures = computed(() => {
    const text = this.searchText.trim().toLowerCase();
    return (this.catalog()?.features ?? []).filter(feature => {
      const matchesText = !text
        || feature.name.toLowerCase().includes(text)
        || feature.code.toLowerCase().includes(text)
        || feature.category.toLowerCase().includes(text);
      const matchesCategory = !this.categoryFilter || feature.category === this.categoryFilter;
      return matchesText && matchesCategory;
    });
  });

  protected readonly enabledCount = computed(() =>
    String((this.catalog()?.plans ?? []).reduce((total, plan) => total + plan.features.filter(feature => feature.isEnabled).length, 0))
  );

  protected readonly categoryCount = computed(() => String(this.categories().length));

  private readonly service = inject(FeatureCatalogService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    const response = await this.service.getCatalog();
    this.applyCatalog(response);
  }

  protected selectFeature(feature: Feature): void {
    this.selectedFeatureCode.set(feature.code);
    this.featureForm = {
      code: feature.code,
      name: feature.name,
      description: feature.description,
      category: feature.category,
      isActive: feature.isActive,
      sortOrder: feature.sortOrder
    };
  }

  protected startNewFeature(): void {
    this.selectedFeatureCode.set(null);
    this.featureForm = emptyFeatureForm();
  }

  protected async saveFeature(): Promise<void> {
    this.saving.set(true);
    try {
      const response = await this.service.saveFeature(this.featureForm);
      this.applyCatalog(response);
      if (response.success) {
        this.toast.success('Feature saved.');
        this.reselectFeature(this.featureForm.code);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleFeature(plan: Plan, feature: Feature): Promise<void> {
    const response = await this.service.setPlanFeature({
      planCode: plan.code,
      featureCode: feature.code,
      isEnabled: !this.isEnabled(plan, feature)
    });
    this.applyCatalog(response);
    if (response.success) {
      this.toast.success('Feature assignment saved.');
    }
  }

  protected isEnabled(plan: Plan, feature: Feature): boolean {
    return plan.features.some(item => item.featureCode === feature.code && item.isEnabled);
  }

  private applyCatalog(response: { success: boolean; message: string; data: PlanCatalog | null }): void {
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load feature catalog');
      return;
    }

    this.catalog.set(response.data);
    const selected = this.selectedFeatureCode();
    if (selected) {
      this.reselectFeature(selected);
    } else if (response.data.features.length > 0) {
      this.selectFeature(response.data.features[0]);
    }
  }

  private reselectFeature(featureCode: string): void {
    const normalized = featureCode.trim().toUpperCase().replace(/\s+/g, '_');
    const feature = this.catalog()?.features.find(item => item.code === normalized);
    if (feature) {
      this.selectFeature(feature);
    }
  }
}

function emptyFeatureForm(): UpsertFeatureRequest {
  return {
    code: '',
    name: '',
    description: '',
    category: 'Clinical',
    isActive: true,
    sortOrder: 0
  };
}
