import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-page">
      <section class="auth-brand">
        <div class="brand-content">
          <div class="brand-mark">
            <span class="material-symbols-rounded">admin_panel_settings</span>
          </div>
          <p class="eyebrow">Auspira control plane</p>
          <h1>Manage every Care360 hospital from one secure console.</h1>
          <p class="brand-copy">Provision tenants, monitor subscriptions, manage databases, and keep hospital environments healthy.</p>

          <div class="control-grid">
            @for (item of controlItems; track item.label) {
              <article>
                <span class="material-symbols-rounded">{{ item.icon }}</span>
                <strong>{{ item.label }}</strong>
              </article>
            }
          </div>
        </div>

        <div class="control-visual" aria-hidden="true">
          <div class="visual-title">
            <span class="status-dot"></span>
            <strong>Platform status</strong>
          </div>
          <div class="shield-card">
            <span class="material-symbols-rounded">shield_lock</span>
            <div>
              <strong>Master access</strong>
              <small>Protected operations console</small>
            </div>
          </div>
          <div class="signal-list">
            <span><i></i>Tenant health</span>
            <span><i></i>Database operations</span>
            <span><i></i>Billing controls</span>
          </div>
        </div>
      </section>

      <section class="auth-panel">
        <form class="auth-card" (ngSubmit)="onLogin()">
          <header>
            <p class="card-eyebrow">Restricted access</p>
            <h2>Super admin login</h2>
            <p>Sign in with your Auspira master account.</p>
          </header>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <label class="field">
            <span>Email address</span>
            <span class="input-shell">
              <span class="material-symbols-rounded">mail</span>
              <input type="email" name="email" [(ngModel)]="email" placeholder="admin@auspira.com" required />
            </span>
          </label>

          <label class="field">
            <span>Password</span>
            <span class="input-shell">
              <span class="material-symbols-rounded">lock</span>
              <input [type]="showPassword() ? 'text' : 'password'" name="password" [(ngModel)]="password" placeholder="Enter password" required />
              <button type="button" class="field-icon-button" (click)="togglePasswordVisibility()" aria-label="Toggle password visibility">
                <span class="material-symbols-rounded">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </span>
          </label>

          <label class="check">
            <input type="checkbox" name="rememberMe" [(ngModel)]="rememberMe" />
            <span>Remember this secure device</span>
          </label>

          <button class="primary" type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="button-pulse" aria-hidden="true">
                <svg viewBox="0 0 64 48">
                  <polyline class="pulse-back" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                  <polyline class="pulse-front" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                </svg>
              </span>
            }
            {{ loading() ? 'Signing in...' : 'Open control plane' }}
          </button>

          <footer class="auth-footer">
            <a class="hospital-link" routerLink="/auth/login">Hospital user login</a>
            <div class="footer-links">
              <a href="https://auspiratech.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              <a href="https://auspiratech.com/terms-of-service" target="_blank" rel="noopener noreferrer">Terms</a>
              <span>Version 0.1.0</span>
            </div>
          </footer>
        </form>
      </section>
    </div>
  `,
  styles: `
    .auth-page { height: 100dvh; min-height: 0; display: grid; grid-template-columns: minmax(520px, 1.05fr) minmax(420px, .95fr); background: radial-gradient(circle at 84% 12%, rgba(37,99,235,.08), transparent 28%), var(--ac-bg); overflow: hidden; }
    .auth-brand { position: relative; display: flex; align-items: center; justify-content: center; gap: 30px; padding: clamp(30px, 4vw, 48px); color: #fff; background: linear-gradient(145deg, #111827, #1d4ed8 56%, #0f766e); overflow: hidden; }
    .auth-brand::before, .auth-brand::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255,255,255,.09); }
    .auth-brand::before { width: 280px; height: 280px; top: -100px; right: -80px; }
    .auth-brand::after { width: 230px; height: 230px; bottom: -95px; left: -80px; }
    .brand-content { position: relative; z-index: 1; max-width: 550px; }
    .brand-mark { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 17px; background: rgba(255,255,255,.16); box-shadow: 0 20px 45px rgba(0,0,0,.24); margin-bottom: 18px; backdrop-filter: blur(12px); }
    .brand-mark .material-symbols-rounded { font-size: 30px; color: #fff; }
    .eyebrow, .card-eyebrow { margin: 0 0 10px; color: #9ef4d3; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .card-eyebrow { color: var(--ac-primary); }
    h1 { margin: 0 0 14px; font-size: clamp(34px, 4vw, 52px); line-height: 1; }
    .brand-copy { max-width: 500px; margin: 0; color: rgba(255,255,255,.86); font-size: 16px; line-height: 1.55; }
    .control-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 24px; }
    .control-grid article { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 10px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: rgba(255,255,255,.11); backdrop-filter: blur(14px); }
    .control-grid .material-symbols-rounded { color: #bbf7d0; font-size: 20px; }
    .control-grid strong { color: rgba(255,255,255,.94); font-size: 13.5px; }
    .control-visual { position: relative; z-index: 1; width: 330px; padding: 18px; border: 1px solid rgba(255,255,255,.2); border-radius: 22px; background: rgba(10,30,68,.36); box-shadow: 0 30px 80px rgba(0,0,0,.24); backdrop-filter: blur(18px); }
    .visual-title { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,.9); font-size: 13px; }
    .status-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 7px rgba(34,197,94,.14); }
    .shield-card { display: grid; grid-template-columns: 54px 1fr; align-items: center; gap: 12px; margin-top: 18px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.12); }
    .shield-card .material-symbols-rounded { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 15px; background: #fff; color: #2563eb; font-size: 30px; }
    .shield-card strong, .shield-card small { display: block; }
    .shield-card small { color: rgba(255,255,255,.68); margin-top: 3px; }
    .signal-list { display: grid; gap: 10px; margin-top: 18px; }
    .signal-list span { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 13px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.84); font-size: 13px; font-weight: 800; }
    .signal-list i { width: 9px; height: 9px; border-radius: 50%; background: #a7f3d0; }
    .auth-panel { min-height: 0; display: flex; align-items: center; justify-content: center; padding: clamp(24px, 3vw, 36px); overflow: hidden; }
    .auth-card { width: 100%; max-width: 454px; display: flex; flex-direction: column; gap: 16px; background: color-mix(in srgb, var(--ac-surface) 96%, white); border: 1px solid color-mix(in srgb, var(--ac-border) 72%, white); border-radius: 20px; padding: clamp(28px, 3vw, 34px); box-shadow: 0 30px 80px rgba(15,23,42,.12), 0 12px 30px rgba(37,99,235,.08); }
    header h2 { margin: 0; color: var(--ac-text); font-size: 25px; font-weight: 900; }
    header p:not(.card-eyebrow) { margin: 7px 0 0; color: var(--ac-muted); font-size: 14px; line-height: 1.5; }
    .field { display: flex; flex-direction: column; gap: 7px; color: var(--ac-text-2); font-size: 13px; font-weight: 800; }
    .input-shell { position: relative; display: flex; align-items: center; min-height: 48px; border: 1px solid var(--ac-border); border-radius: 13px; background: var(--ac-surface); transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
    .input-shell:focus-within { border-color: var(--ac-primary); box-shadow: 0 0 0 4px rgba(37,99,235,.12); transform: translateY(-1px); }
    .input-shell > .material-symbols-rounded { width: 44px; color: var(--ac-muted); font-size: 20px; text-align: center; }
    input { width: 100%; min-width: 0; height: 46px; border: 0; border-radius: 13px; padding: 0 12px 0 0; background: transparent; color: var(--ac-text); font: inherit; font-weight: 700; outline: none; }
    .field-icon-button { display: grid; place-items: center; width: 42px; height: 42px; margin-right: 3px; border: 0; border-radius: 10px; background: transparent; color: var(--ac-muted); cursor: pointer; }
    .field-icon-button:hover { background: var(--ac-surface-2); color: var(--ac-primary); }
    .field-icon-button .material-symbols-rounded { font-size: 20px; }
    .check { display: flex; flex-direction: row; align-items: center; gap: 8px; color: var(--ac-text-3); font-size: 13px; font-weight: 700; }
    .check input { width: 16px; height: 16px; accent-color: var(--ac-primary); }
    .primary { height: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 0; border-radius: 13px; background: linear-gradient(135deg,#2563eb,#3b82f6); color: #fff; font-weight: 900; cursor: pointer; box-shadow: 0 16px 32px rgba(37,99,235,.28); transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
    .primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(37,99,235,.34); filter: saturate(1.05); }
    .primary:disabled { opacity: .82; cursor: not-allowed; }
    .button-pulse svg { width: 34px; height: 24px; display: block; }
    .button-pulse polyline { fill: none; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    .button-pulse .pulse-back { stroke: rgba(255,255,255,.28); }
    .button-pulse .pulse-front { stroke: #fff; stroke-dasharray: 48, 144; stroke-dashoffset: 192; animation: dashPulse 1.4s linear infinite; }
    .auth-footer { display: grid; gap: 12px; padding-top: 16px; border-top: 1px solid var(--ac-border); text-align: center; }
    .hospital-link { color: var(--ac-primary); font-weight: 900; text-decoration: none; }
    .hospital-link:hover { text-decoration: underline; }
    .footer-links { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; color: var(--ac-muted); font-size: 12px; font-weight: 700; }
    .footer-links a { color: var(--ac-muted); text-decoration: none; }
    .footer-links a:hover { text-decoration: underline; }
    .footer-links > * + * { position: relative; }
    .footer-links > * + *::before { content: ''; position: absolute; left: -8px; top: 50%; width: 3px; height: 3px; border-radius: 50%; background: var(--ac-border-strong); }
    .error { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ac-error-light); color: var(--ac-error); font-size: 13px; }
    :host-context(.dark) .auth-card { background: rgba(17,24,39,.94); border-color: rgba(148,163,184,.22); box-shadow: 0 30px 80px rgba(0,0,0,.38), 0 12px 30px rgba(59,130,246,.08); }
    :host-context(.dark) .input-shell { background: rgba(15,23,42,.72); border-color: rgba(148,163,184,.22); }
    @keyframes dashPulse { 72.5% { opacity: 0; } to { stroke-dashoffset: 0; } }
    @media (max-width: 1280px) { .control-visual { display: none; } }
    @media (max-width: 900px) {
      .auth-page { min-height: 100dvh; height: auto; grid-template-columns: 1fr; overflow: auto; }
      .auth-brand { display: none; }
      .auth-panel { min-height: 100dvh; padding: 24px; overflow: visible; }
      .auth-card { padding: 28px; }
    }
    @media (max-width: 520px) {
      .auth-page { background: var(--ac-bg); }
      .auth-panel { align-items: flex-start; padding: 16px; }
      .auth-card { max-width: none; gap: 14px; border-radius: 16px; padding: 22px 18px; box-shadow: 0 16px 40px rgba(15,23,42,.1); }
      header h2 { font-size: 22px; line-height: 1.2; }
      header p:not(.card-eyebrow) { font-size: 13px; }
      .input-shell { min-height: 46px; border-radius: 11px; }
      input { height: 44px; font-size: 16px; }
      .primary { width: 100%; height: 46px; border-radius: 11px; }
      .check { align-items: flex-start; line-height: 1.35; }
      .footer-links { gap: 10px 14px; }
      .footer-links > * + *::before { display: none; }
    }
    @media (max-width: 360px) {
      .auth-panel { padding: 12px; }
      .auth-card { padding: 20px 14px; }
      .input-shell > .material-symbols-rounded { width: 38px; }
      .field-icon-button { width: 38px; min-width: 38px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuspiraSuperAdminLoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected rememberMe = false;
  protected readonly loading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly controlItems = [
    { icon: 'domain', label: 'Tenant management' },
    { icon: 'database', label: 'Database operations' },
    { icon: 'workspace_premium', label: 'Plans & licenses' },
    { icon: 'monitoring', label: 'Platform health' }
  ];

  protected async onLogin(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.authService.auspiraSuperAdminLogin({ email: this.email, password: this.password, rememberMe: this.rememberMe });
      if (!response.success || !response.data) {
        this.error.set(response.message || 'Invalid email or password.');
        return;
      }

      this.authStore.setSession(response.data);
      await this.router.navigateByUrl('/super-admin');
    } catch {
      this.error.set('Invalid email or password.');
    } finally {
      this.loading.set(false);
    }
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }
}
