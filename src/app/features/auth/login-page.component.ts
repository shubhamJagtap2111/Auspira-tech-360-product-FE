import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { AppLoaderService } from '../../shared/ui/app-loader/app-loader.service';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-page">
      <section class="auth-brand">
        <div class="brand-content">
          <div class="brand-mark">
            <span class="material-symbols-rounded">favorite</span>
          </div>
          <p class="eyebrow">Modern Hospital Management Platform</p>
          <h1>One Platform. Every Hospital. Every Department.</h1>
          <p class="brand-copy">Manage patients, billing, pharmacy, laboratory, appointments, and staff from one secure cloud platform.</p>

          <div class="feature-grid" aria-label="Care360 platform capabilities">
            @for (feature of featureHighlights; track feature.label) {
              <article>
                <span class="material-symbols-rounded">{{ feature.icon }}</span>
                <strong>{{ feature.label }}</strong>
              </article>
            }
          </div>
        </div>

        <div class="hospital-visual" aria-hidden="true">
          <div class="visual-header">
            <span class="status-dot"></span>
            <span>Live care operations</span>
          </div>
          <div class="hospital-building">
            <div class="building-top">
              <span class="material-symbols-rounded">local_hospital</span>
            </div>
            <div class="building-grid">
              <article>
                <span class="material-symbols-rounded">event_available</span>
                <strong>42</strong>
                <small>Appts</small>
              </article>
              <article>
                <span class="material-symbols-rounded">groups</span>
                <strong>18</strong>
                <small>OPD</small>
              </article>
              <article>
                <span class="material-symbols-rounded">biotech</span>
                <strong>16</strong>
                <small>Labs</small>
              </article>
              <article>
                <span class="material-symbols-rounded">medication</span>
                <strong>94%</strong>
                <small>Stock</small>
              </article>
              <article>
                <span class="material-symbols-rounded">receipt_long</span>
                <strong>8</strong>
                <small>Bills</small>
              </article>
              <article>
                <span class="material-symbols-rounded">badge</span>
                <strong>31</strong>
                <small>Staff</small>
              </article>
            </div>
          </div>
          <svg class="ecg-line" viewBox="0 0 240 70" role="img">
            <polyline points="4 40 44 40 58 24 76 58 105 12 128 40 166 40 180 30 194 46 236 46"></polyline>
          </svg>
          <div class="visual-stats">
            <span><strong>98%</strong> uptime</span>
            <span><strong>24/7</strong> access</span>
          </div>
        </div>
      </section>

      <section class="auth-panel">
        <form class="auth-card" (ngSubmit)="onLogin()">
          <header>
            <h2>Hospital login</h2>
            <p>Sign in with your registered email and password.</p>
          </header>

          @if (errorKey()) {
            <p class="error">{{ t(errorKey()!) }}</p>
          }

          <label class="field">
            <span class="field-label">{{ t('Auth.Login.Email.Label') }}</span>
            <span class="input-shell">
              <span class="material-symbols-rounded">mail</span>
              <input type="email" name="email" [(ngModel)]="email" [placeholder]="t('Auth.Login.Email.Placeholder')" required />
            </span>
          </label>

          <label class="field">
            <span class="field-label">{{ t('Auth.Login.Password.Label') }}</span>
            <span class="input-shell">
              <span class="material-symbols-rounded">lock</span>
              <input [type]="showPassword() ? 'text' : 'password'" name="password" [(ngModel)]="password" [placeholder]="t('Auth.Login.Password.Placeholder')" required />
              <button type="button" class="field-icon-button" (click)="togglePasswordVisibility()" [attr.aria-label]="t(showPassword() ? 'Auth.Login.HidePassword' : 'Auth.Login.ShowPassword')">
                <span class="material-symbols-rounded">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </span>
          </label>

          <div class="form-row">
            <label class="check">
              <input type="checkbox" name="rememberMe" [(ngModel)]="rememberMe" />
              <span>{{ t('Auth.Login.RememberMe.Label') }}</span>
            </label>
            <a routerLink="/auth/forgot-password">{{ t('Auth.ForgotPassword.Link') }}</a>
          </div>

          <button class="primary" type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="button-pulse" aria-hidden="true">
                <svg viewBox="0 0 64 48">
                  <polyline class="pulse-back" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                  <polyline class="pulse-front" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                </svg>
              </span>
            }
            {{ t(loading() ? 'Auth.Login.SigningIn' : 'Auth.Login.Submit') }}
          </button>

          <button class="google-button" type="button" (click)="onGoogleLogin()">
            <span class="google-mark">G</span>
            Continue with Google
          </button>

          <footer class="auth-footer">
            <div class="footer-links">
              <a href="https://auspiratech.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              <a href="https://auspiratech.com/terms-of-service" target="_blank" rel="noopener noreferrer">Terms</a>
              <span>Version 0.1.0</span>
            </div>
            <small>© 2026 Auspira Technologies. All rights reserved.</small>
          </footer>
        </form>
      </section>
    </div>
  `,
  styles: `
    .auth-page { height: 100dvh; min-height: 0; display: grid; grid-template-columns: minmax(520px, 1.05fr) minmax(420px, .95fr); background: radial-gradient(circle at 84% 12%, rgba(37,99,235,.08), transparent 28%), var(--ac-bg); overflow: hidden; }
    .auth-brand { position: relative; min-height: 0; display: flex; align-items: center; justify-content: center; padding: clamp(30px, 4vw, 48px); background: linear-gradient(145deg, #102a63, #2563eb 48%, #0f766e); color: #fff; overflow: hidden; }
    .auth-brand::before, .auth-brand::after { content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%; background: rgba(255,255,255,.1); filter: blur(2px); animation: floatGlow 9s ease-in-out infinite; }
    .auth-brand::before { top: -90px; right: -70px; }
    .auth-brand::after { bottom: -110px; left: -80px; animation-delay: -3s; }
    .brand-content { position: relative; z-index: 1; max-width: 560px; }
    .brand-mark { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 17px; background: rgba(255,255,255,.16); box-shadow: 0 20px 45px rgba(0,0,0,.24); margin-bottom: 18px; backdrop-filter: blur(12px); }
    .brand-mark .material-symbols-rounded { font-size: 30px; color: #fff; }
    .eyebrow { margin: 0 0 12px; color: #9ef4d3; font-size: 12px; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }
    h1 { font-size: clamp(32px, 3.7vw, 52px); line-height: .99; margin: 0 0 14px; max-width: 560px; }
    .brand-copy { max-width: 500px; margin: 0; color: rgba(255,255,255,.86); font-size: 16px; line-height: 1.5; }
    .feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 22px; }
    .feature-grid article { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: rgba(255,255,255,.11); backdrop-filter: blur(14px); box-shadow: 0 18px 40px rgba(0,0,0,.12); }
    .feature-grid .material-symbols-rounded { font-size: 20px; color: #bbf7d0; }
    .feature-grid strong { font-size: 13.5px; color: rgba(255,255,255,.94); }
    .hospital-visual { position: relative; z-index: 1; width: min(370px, 40vw); padding: 18px; margin-left: 24px; border: 1px solid rgba(255,255,255,.2); border-radius: 22px; background: rgba(10,30,68,.36); box-shadow: 0 30px 80px rgba(0,0,0,.24); backdrop-filter: blur(18px); }
    .visual-header, .visual-stats { display: flex; justify-content: space-between; gap: 12px; color: rgba(255,255,255,.78); font-size: 12px; font-weight: 800; }
    .status-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 7px rgba(34,197,94,.14); }
    .visual-header { align-items: center; justify-content: flex-start; }
    .hospital-building { display: grid; grid-template-columns: 78px 1fr; align-items: center; gap: 16px; margin: 18px 0 6px; }
    .building-top { display: grid; place-items: center; width: 78px; height: 78px; border-radius: 20px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(219,234,254,.9)); color: #2563eb; box-shadow: 0 18px 45px rgba(0,0,0,.16); }
    .building-top .material-symbols-rounded { font-size: 42px; }
    .building-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .building-grid article { min-height: 48px; display: grid; grid-template-columns: 18px 1fr; grid-template-rows: auto auto; align-items: center; gap: 1px 5px; padding: 7px 8px; border-radius: 10px; background: rgba(255,255,255,.16); box-shadow: inset 0 0 0 1px rgba(255,255,255,.13); }
    .building-grid .material-symbols-rounded { grid-row: 1 / span 2; color: #bbf7d0; font-size: 17px; }
    .building-grid strong { color: #fff; font-size: 13px; line-height: 1; }
    .building-grid small { color: rgba(255,255,255,.7); font-size: 9px; font-weight: 900; line-height: 1; text-transform: uppercase; }
    .ecg-line { width: 100%; height: 74px; margin: 4px 0 10px; }
    .ecg-line polyline { fill: none; stroke: #a7f3d0; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 8px rgba(167,243,208,.45)); stroke-dasharray: 260; animation: ecgMove 2.4s ease-in-out infinite; }
    .visual-stats span { display: grid; gap: 2px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.1); }
    .visual-stats strong { color: #fff; font-size: 18px; }
    .auth-panel { min-height: 0; display: flex; align-items: center; justify-content: center; padding: clamp(24px, 3vw, 36px); overflow: hidden; }
    .auth-card { position: relative; width: 100%; max-width: 454px; display: flex; flex-direction: column; gap: 16px; background: color-mix(in srgb, var(--ac-surface) 96%, white); border: 1px solid color-mix(in srgb, var(--ac-border) 72%, white); border-radius: 20px; padding: clamp(28px, 3vw, 34px); box-shadow: 0 30px 80px rgba(15,23,42,.12), 0 12px 30px rgba(37,99,235,.08); }
    .admin-login-shortcut { position: absolute; top: 18px; right: 18px; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid color-mix(in srgb, var(--ac-border) 72%, white); border-radius: 12px; background: var(--ac-surface); color: var(--ac-muted); box-shadow: 0 10px 24px rgba(15,23,42,.08); transition: transform .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .admin-login-shortcut:hover, .admin-login-shortcut:focus-visible { color: var(--ac-primary); border-color: rgba(37,99,235,.35); box-shadow: 0 16px 30px rgba(37,99,235,.14); transform: translateY(-1px); outline: none; }
    .admin-login-shortcut .material-symbols-rounded { font-size: 23px; }
    header { padding-right: 54px; }
    header h2 { margin: 0; font-size: 25px; color: var(--ac-text); }
    header p { margin: 7px 0 0; color: var(--ac-muted); font-size: 14px; line-height: 1.5; }
    .field { display: flex; flex-direction: column; gap: 7px; color: var(--ac-text-2); font-size: 13px; font-weight: 700; }
    .field-label { color: var(--ac-text-2); }
    .input-shell { position: relative; display: flex; align-items: center; min-height: 48px; border: 1px solid var(--ac-border); border-radius: 13px; background: var(--ac-surface); transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
    .input-shell:focus-within { border-color: var(--ac-primary); box-shadow: 0 0 0 4px rgba(37,99,235,.12); transform: translateY(-1px); }
    .input-shell > .material-symbols-rounded { width: 44px; color: var(--ac-muted); font-size: 20px; text-align: center; }
    input { width: 100%; height: 46px; min-width: 0; border: 0; border-radius: 13px; padding: 0 12px 0 0; background: transparent; color: var(--ac-text); font: inherit; font-weight: 600; }
    input:focus { outline: none; }
    .dropdown-shell { padding-right: 4px; }
    .dropdown-shell ac-dropdown { flex: 1; min-width: 0; }
    .dropdown-shell ::ng-deep .ac-dropdown-trigger { min-height: 46px; border: 0; background: transparent; padding-left: 0; border-radius: 13px; box-shadow: none; }
    .dropdown-shell ::ng-deep .open .ac-dropdown-trigger { box-shadow: none; }
    .field-icon-button { display: grid; place-items: center; width: 42px; height: 42px; margin-right: 3px; border: 0; border-radius: 10px; background: transparent; color: var(--ac-muted); cursor: pointer; }
    .field-icon-button:hover { background: var(--ac-surface-2); color: var(--ac-primary); }
    .field-icon-button .material-symbols-rounded { font-size: 20px; }
    .form-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .check { display: flex; flex-direction: row; align-items: center; gap: 8px; font-weight: 600; color: var(--ac-text-3); font-size: 13px; }
    .check input { width: 16px; height: 16px; accent-color: var(--ac-primary); }
    .primary { height: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 0; border-radius: 13px; background: linear-gradient(135deg,#2563eb,#3b82f6); color: #fff; font-weight: 800; cursor: pointer; box-shadow: 0 16px 32px rgba(37,99,235,.28); transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
    .primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(37,99,235,.34); filter: saturate(1.05); }
    .primary:disabled { opacity: .82; cursor: not-allowed; box-shadow: 0 10px 24px rgba(37,99,235,.18); }
    .button-pulse svg { width: 34px; height: 24px; display: block; }
    .button-pulse polyline { fill: none; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    .button-pulse .pulse-back { stroke: rgba(255,255,255,.28); }
    .button-pulse .pulse-front { stroke: #fff; stroke-dasharray: 48, 144; stroke-dashoffset: 192; animation: dashPulse 1.4s linear infinite; }
    .google-button { height: 48px; display: flex; align-items: center; justify-content: center; gap: 12px; border: 1px solid var(--ac-border); border-radius: 13px; background: #fff; color: #111827; font-weight: 800; cursor: pointer; box-shadow: 0 10px 24px rgba(15,23,42,.06); transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
    .google-button:hover { transform: translateY(-1px); border-color: rgba(37,99,235,.35); box-shadow: 0 16px 32px rgba(15,23,42,.1); }
    .google-mark { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid #e5e7eb; color: #ea4335; background: #fff; font-weight: 900; font-family: Arial, sans-serif; font-size: 16px; }
    .auth-actions { display: flex; justify-content: center; align-items: center; gap: 16px; flex-wrap: wrap; }
    .register-button { text-align: center; }
    a { background: transparent; border: 0; color: var(--ac-primary); font-weight: 700; cursor: pointer; text-align: left; padding: 0; text-decoration: none; }
    a:hover { text-decoration: none; }
    .auth-footer { display: grid; gap: 12px; padding-top: 16px; border-top: 1px solid var(--ac-border); text-align: center; }
    .footer-links { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; color: var(--ac-muted); font-size: 12px; font-weight: 700; }
    .footer-links a { color: var(--ac-muted); }
    .footer-links > * + * { position: relative; }
    .footer-links > * + *::before { content: ''; position: absolute; left: -8px; top: 50%; width: 3px; height: 3px; border-radius: 50%; background: var(--ac-border-strong); }
    .auth-footer small { color: var(--ac-muted); font-size: 12px; font-weight: 700; }
    .error { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ac-error-light); color: var(--ac-error); font-size: 13px; }
    :host-context(.dark) .auth-card { background: rgba(17,24,39,.94); border-color: rgba(148,163,184,.22); box-shadow: 0 30px 80px rgba(0,0,0,.38), 0 12px 30px rgba(59,130,246,.08); }
    :host-context(.dark) .input-shell { background: rgba(15,23,42,.72); border-color: rgba(148,163,184,.22); }
    :host-context(.dark) .google-button { background: rgba(255,255,255,.94); color: #111827; }
    @keyframes floatGlow { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(-16px, 12px, 0) scale(1.08); } }
    @keyframes ecgMove { 0% { stroke-dashoffset: 260; opacity: .55; } 45%, 72% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: .62; } }
    @keyframes dashPulse { 72.5% { opacity: 0; } to { stroke-dashoffset: 0; } }
    @media (max-width: 1280px) { .hospital-visual { display: none; } }
    @media (max-height: 820px) { .hospital-visual { transform: scale(.9); transform-origin: left center; } .auth-card { gap: 13px; } .auth-footer { padding-top: 12px; } }
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
      .admin-login-shortcut { top: 14px; right: 14px; width: 38px; height: 38px; border-radius: 10px; }
      header { padding-right: 46px; }
      header h2 { font-size: 22px; line-height: 1.2; }
      header p { font-size: 13px; }
      .input-shell { min-height: 46px; border-radius: 11px; }
      input { height: 44px; font-size: 16px; }
      .primary, .google-button { width: 100%; height: 46px; border-radius: 11px; }
      .form-row { align-items: flex-start; flex-direction: column; gap: 10px; }
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
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly appLoader = inject(AppLoaderService);

  protected readonly featureHighlights = [
    { icon: 'groups', label: 'Patient Management' },
    { icon: 'payments', label: 'Billing & Insurance' },
    { icon: 'medication', label: 'Pharmacy' },
    { icon: 'biotech', label: 'Laboratory' },
    { icon: 'event_available', label: 'Appointment Scheduling' },
    { icon: 'domain', label: 'Isolated Hospital Workspace' }
  ];

  protected email = '';
  protected password = '';
  protected rememberMe = false;
  protected readonly loading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected async onLogin(): Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);
    this.appLoader.showImmediate();

    try {
      const response = await this.authService.login({
        email: this.email,
        password: this.password,
        rememberMe: this.rememberMe
      });
      if (!response.success || !response.data) {
        this.errorKey.set(response.message);
        return;
      }

      this.authStore.setSession(response.data);
      await this.i18n.loadCatalog();

      await this.router.navigateByUrl('/');
    } catch {
      this.errorKey.set('Auth.Errors.InvalidCredentials');
    } finally {
      this.loading.set(false);
      this.appLoader.hide();
    }
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  protected onGoogleLogin(): void {
    this.authService.startGoogleLogin(this.rememberMe);
  }
}
