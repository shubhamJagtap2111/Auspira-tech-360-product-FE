import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { GlobalSettingItem, GlobalSettingsSnapshot } from './global-settings.models';
import { GlobalSettingsService } from './global-settings.service';

const categories = [
  { code: 'SMTP', label: 'SMTP', icon: 'outgoing_mail' },
  { code: 'SMS', label: 'SMS', icon: 'sms' },
  { code: 'STORAGE', label: 'Storage', icon: 'storage' },
  { code: 'S3', label: 'S3', icon: 'cloud' },
  { code: 'AZURE_BLOB', label: 'Azure Blob', icon: 'deployed_code' },
  { code: 'AI_KEYS', label: 'AI Keys', icon: 'psychology' },
  { code: 'PAYMENT_GATEWAY', label: 'Payment Gateway', icon: 'payments' },
  { code: 'THEME', label: 'Theme', icon: 'palette' },
  { code: 'LOCALIZATION', label: 'Localization', icon: 'language' }
];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="settings-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Global Settings</p>
          <h1 class="ac-page-title">SMTP, SMS, Storage, AI, Payments, Theme, Localization</h1>
          <p>Configure platform-wide services and regional defaults used by every hospital tenant.</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" routerLink="/super-admin/notifications" title="Open announcements">
            <span class="material-symbols-rounded">campaign</span>
          </a>
          <button class="icon-btn" type="button" (click)="load()" title="Refresh settings">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </header>

      @if (snapshot(); as model) {
        <section class="stat-grid">
          <article class="stat"><span class="material-symbols-rounded">tune</span><p>Settings</p><strong>{{ model.summary.totalSettings }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">key</span><p>Secrets</p><strong>{{ model.summary.encryptedSettings }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">public</span><p>Countries</p><strong>{{ model.summary.countries }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">currency_exchange</span><p>Currencies</p><strong>{{ model.summary.currencies }}</strong></article>
          <article class="stat"><span class="material-symbols-rounded">translate</span><p>Languages</p><strong>{{ model.summary.languages }}</strong></article>
        </section>

        <section class="workspace">
          <aside class="category-rail">
            @for (category of categories; track category.code) {
              <button type="button" [class.active]="activeCategory() === category.code" (click)="activeCategory.set(category.code)">
                <span class="material-symbols-rounded">{{ category.icon }}</span>
                <strong>{{ category.label }}</strong>
                <small>{{ countByCategory(model, category.code) }}</small>
              </button>
            }
          </aside>

          <main class="settings-panel">
            <div class="panel-title">
              <div>
                <h2>{{ activeCategoryLabel() }}</h2>
                <p>{{ filteredSettings().length }} editable settings</p>
              </div>
              <button class="ac-btn ac-btn-primary" type="button" (click)="saveSettings()">
                <span class="material-symbols-rounded">save</span>
                Save Settings
              </button>
            </div>

            <div class="settings-grid">
              @for (setting of filteredSettings(); track setting.settingKey) {
                <label class="setting-card">
                  <span class="setting-label">
                    <strong>{{ setting.displayName }}</strong>
                    @if (setting.isEncrypted) {
                      <small><span class="material-symbols-rounded">lock</span> secret</small>
                    }
                  </span>
                  @if (setting.dataType === 'Boolean') {
                    <span class="toggle-row">
                      <input type="checkbox" [name]="setting.settingKey" [ngModel]="setting.settingValue === 'true'" (ngModelChange)="setting.settingValue = $event ? 'true' : 'false'" />
                      <em>{{ setting.settingValue === 'true' ? 'Enabled' : 'Disabled' }}</em>
                    </span>
                  } @else if (setting.dataType === 'Number') {
                    <input type="number" [name]="setting.settingKey" [(ngModel)]="setting.settingValue" />
                  } @else {
                    <input [type]="setting.isEncrypted ? 'password' : 'text'" [name]="setting.settingKey" [(ngModel)]="setting.settingValue" />
                  }
                  <small class="description">{{ setting.description }}</small>
                  <span class="active-row">
                    <input type="checkbox" [name]="setting.settingKey + '-active'" [(ngModel)]="setting.isActive" />
                    Active
                  </span>
                </label>
              }
            </div>
          </main>

          <aside class="reference-panel">
            <section>
              <h2>Countries</h2>
              @for (country of model.countries; track country.iso2Code) {
                <article>
                  <strong>{{ country.countryName }}</strong>
                  <small>{{ country.iso2Code }} / {{ country.phoneCode }} / {{ country.currencyCode }}</small>
                </article>
              }
            </section>
            <section>
              <h2>Currencies</h2>
              @for (currency of model.currencies; track currency.currencyCode) {
                <article>
                  <strong>{{ currency.currencyCode }}</strong>
                  <small>{{ currency.currencyName }} / {{ currency.symbol }}</small>
                </article>
              }
            </section>
            <section>
              <h2>Languages</h2>
              @for (language of model.languages; track language.cultureCode) {
                <article>
                  <strong>{{ language.cultureCode }}</strong>
                  <small>{{ language.languageName }}{{ language.isDefault ? ' / default' : '' }}</small>
                </article>
              }
            </section>
          </aside>
        </section>
      } @else {
        <section class="loading">Loading global settings...</section>
      }
    </section>
  `,
  styles: [`
    .settings-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head, .stat, .category-rail, .settings-panel, .reference-panel { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 8px; box-shadow: var(--ac-shadow-sm); }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px; }
    .page-head p { margin: 4px 0 0; color: var(--ac-muted); max-width: 860px; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .head-actions { display: flex; gap: 8px; }
    .icon-btn { width: 38px; height: 38px; display: inline-grid; place-items: center; border: 1px solid var(--ac-border); border-radius: 8px; color: var(--ac-text); background: var(--ac-surface); text-decoration: none; cursor: pointer; }
    .stat-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .stat { padding: 16px; display: grid; gap: 6px; min-width: 0; }
    .stat span { color: var(--ac-primary); }
    .stat p { margin: 0; color: var(--ac-muted); font-size: 13px; }
    .stat strong { font-size: 28px; line-height: 1; }
    .workspace { display: grid; grid-template-columns: 220px minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
    .category-rail, .settings-panel, .reference-panel { padding: 14px; }
    .category-rail { display: grid; gap: 8px; }
    .category-rail button { min-height: 48px; border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); color: var(--ac-text); display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 10px; text-align: left; cursor: pointer; }
    .category-rail button.active { border-color: var(--ac-primary); background: color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)); }
    .category-rail span { color: var(--ac-primary); }
    .category-rail small { color: var(--ac-muted); }
    .panel-title { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
    .panel-title h2, .reference-panel h2 { margin: 0; font-size: 18px; }
    .panel-title p { margin: 3px 0 0; color: var(--ac-muted); }
    .settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .setting-card { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); padding: 12px; display: grid; gap: 8px; min-width: 0; }
    .setting-label { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
    .setting-label small { display: inline-flex; align-items: center; gap: 3px; color: var(--ac-muted); font-size: 12px; }
    .setting-label small span { font-size: 15px; }
    input { min-height: 38px; border: 1px solid var(--ac-border); border-radius: 8px; padding: 0 10px; background: var(--ac-surface); color: var(--ac-text); min-width: 0; }
    input[type="checkbox"] { min-height: auto; width: 16px; height: 16px; padding: 0; }
    .toggle-row, .active-row { display: flex; align-items: center; gap: 8px; color: var(--ac-muted); font-size: 13px; }
    .description { color: var(--ac-muted); line-height: 1.4; min-height: 34px; }
    .reference-panel { display: grid; gap: 14px; }
    .reference-panel section { display: grid; gap: 8px; }
    .reference-panel article { border: 1px solid var(--ac-border); border-radius: 8px; background: var(--ac-subtle); padding: 10px; }
    .reference-panel small { display: block; color: var(--ac-muted); margin-top: 3px; }
    .loading { color: var(--ac-muted); }
    @media (max-width: 1240px) { .workspace { grid-template-columns: 1fr; } .category-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .page-head, .panel-title { flex-direction: column; } .stat-grid, .settings-grid, .category-rail { grid-template-columns: 1fr; } }
  `]
})
export class GlobalSettingsPageComponent implements OnInit {
  private readonly settingsService = inject(GlobalSettingsService);
  private readonly toast = inject(ToastService);

  protected readonly categories = categories;
  protected readonly snapshot = signal<GlobalSettingsSnapshot | null>(null);
  protected readonly activeCategory = signal('SMTP');
  protected readonly filteredSettings = computed(() => this.snapshot()?.settings.filter(setting => setting.categoryCode === this.activeCategory()) ?? []);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    const response = await this.settingsService.getSnapshot();
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not load global settings');
      return;
    }

    this.snapshot.set(response.data);
  }

  protected async saveSettings(): Promise<void> {
    const settings = this.filteredSettings().map(setting => ({
      settingKey: setting.settingKey,
      settingValue: setting.settingValue,
      isActive: setting.isActive
    }));
    const response = await this.settingsService.saveSettings({ settings });
    if (!response.success || !response.data) {
      this.toast.error(response.message || 'Could not save global settings');
      return;
    }

    this.snapshot.set(response.data);
    this.toast.success('Global settings saved.');
  }

  protected activeCategoryLabel(): string {
    return categories.find(category => category.code === this.activeCategory())?.label ?? this.activeCategory();
  }

  protected countByCategory(model: GlobalSettingsSnapshot, categoryCode: string): number {
    return model.settings.filter(setting => setting.categoryCode === categoryCode).length;
  }
}
