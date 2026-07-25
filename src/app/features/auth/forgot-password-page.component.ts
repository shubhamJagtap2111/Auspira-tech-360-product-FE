import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <main class="auth-page">
      <section class="auth-brand">
        <div class="brand-content">
          <div class="brand-mark">
            <span class="material-symbols-rounded">favorite</span>
          </div>
          <p class="eyebrow">Secure account recovery</p>
          <h1>Get back to hospital operations safely.</h1>
          <p class="brand-copy">We will send reset instructions only when the email belongs to a Care360 hospital account.</p>

          <div class="assurance-list">
            @for (item of assuranceItems; track item.label) {
              <article>
                <span class="material-symbols-rounded">{{ item.icon }}</span>
                <div>
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.caption }}</small>
                </div>
              </article>
            }
          </div>
        </div>

        <div class="security-visual" aria-hidden="true">
          <div class="visual-title">
            <span class="status-dot"></span>
            <strong>Recovery workflow</strong>
          </div>
          <div class="lock-card">
            <span class="material-symbols-rounded">lock_reset</span>
            <div>
              <strong>Password reset</strong>
              <small>Email verified before instructions are sent</small>
            </div>
          </div>
          <div class="pulse-track">
            <i></i><i></i><i></i>
          </div>
        </div>
      </section>

      <section class="auth-panel">
        <form class="auth-card" (ngSubmit)="onSubmit()">
          <header>
            <span class="card-icon material-symbols-rounded">{{ sent() ? 'mark_email_read' : 'lock_reset' }}</span>
            <p class="card-eyebrow">{{ sent() ? 'Check your inbox' : 'Account recovery' }}</p>
            <h2>{{ t('Auth.ForgotPassword.Title') }}</h2>
            <p>{{ t(sent() ? 'Auth.Messages.ForgotPasswordAccepted' : 'Auth.ForgotPassword.Description') }}</p>
          </header>

          @if (!sent()) {
            @if (errorKey()) {
              <p class="error">{{ t(errorKey()!) }}</p>
            }

            <label class="field">
              <span>{{ t('Auth.Login.Email.Label') }}</span>
              <span class="input-shell">
                <span class="material-symbols-rounded">mail</span>
                <input type="email" name="email" [(ngModel)]="email" [placeholder]="t('Auth.Login.Email.Placeholder')" required />
              </span>
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
              {{ t(loading() ? 'Common.Actions.Sending' : 'Auth.ForgotPassword.Submit') }}
            </button>
          } @else {
            <div class="success-panel">
              <span class="material-symbols-rounded">verified</span>
              <div>
                <strong>Request received</strong>
                <small>Use the link in your email to create a new password.</small>
              </div>
            </div>
          }

          <footer class="auth-footer">
            <a routerLink="/auth/login">
              <span class="material-symbols-rounded">arrow_back</span>
              {{ t('Auth.Navigation.BackToLogin') }}
            </a>
            <small>Version 0.1.0</small>
            <small>© 2026 Auspira Technologies. All rights reserved.</small>
          </footer>
        </form>
      </section>
    </main>
  `,
  styles: `
    .auth-page { height: 100dvh; min-height: 0; display: grid; grid-template-columns: minmax(520px, 1.05fr) minmax(420px, .95fr); background: radial-gradient(circle at 84% 12%, rgba(37,99,235,.08), transparent 28%), var(--ac-bg); overflow: hidden; }
    .auth-brand { position: relative; display: flex; align-items: center; justify-content: center; gap: 32px; padding: clamp(30px, 4vw, 48px); color: #fff; background: linear-gradient(145deg, #102a63, #2563eb 48%, #0f766e); overflow: hidden; }
    .auth-brand::before, .auth-brand::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255,255,255,.1); }
    .auth-brand::before { width: 280px; height: 280px; top: -100px; right: -70px; }
    .auth-brand::after { width: 220px; height: 220px; bottom: -90px; left: -70px; }
    .brand-content { position: relative; z-index: 1; max-width: 520px; }
    .brand-mark { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 17px; background: rgba(255,255,255,.16); box-shadow: 0 20px 45px rgba(0,0,0,.24); margin-bottom: 18px; backdrop-filter: blur(12px); }
    .brand-mark .material-symbols-rounded { font-size: 30px; color: #fff; }
    .eyebrow, .card-eyebrow { margin: 0 0 10px; color: #9ef4d3; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .card-eyebrow { color: var(--ac-primary); }
    h1 { margin: 0 0 14px; font-size: clamp(34px, 4vw, 52px); line-height: 1; }
    .brand-copy { max-width: 500px; margin: 0; color: rgba(255,255,255,.86); font-size: 16px; line-height: 1.55; }
    .assurance-list { display: grid; gap: 10px; margin-top: 24px; }
    .assurance-list article { display: grid; grid-template-columns: 42px 1fr; align-items: center; gap: 12px; padding: 11px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 13px; background: rgba(255,255,255,.11); backdrop-filter: blur(14px); }
    .assurance-list .material-symbols-rounded { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; color: #bbf7d0; background: rgba(255,255,255,.12); }
    .assurance-list strong, .assurance-list small { display: block; }
    .assurance-list small { margin-top: 2px; color: rgba(255,255,255,.68); font-weight: 700; }
    .security-visual { position: relative; z-index: 1; width: 340px; padding: 18px; border: 1px solid rgba(255,255,255,.2); border-radius: 22px; background: rgba(10,30,68,.36); box-shadow: 0 30px 80px rgba(0,0,0,.24); backdrop-filter: blur(18px); }
    .visual-title { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,.9); font-size: 13px; }
    .status-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 7px rgba(34,197,94,.14); }
    .lock-card { display: grid; grid-template-columns: 56px 1fr; align-items: center; gap: 12px; margin-top: 18px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.12); }
    .lock-card .material-symbols-rounded { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: #fff; color: #2563eb; font-size: 32px; }
    .lock-card strong, .lock-card small { display: block; }
    .lock-card small { color: rgba(255,255,255,.68); margin-top: 3px; line-height: 1.4; }
    .pulse-track { display: grid; gap: 10px; margin-top: 18px; }
    .pulse-track i { height: 10px; border-radius: 999px; background: rgba(255,255,255,.16); overflow: hidden; }
    .pulse-track i::before { content: ''; display: block; width: 68%; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#a7f3d0,#60a5fa); animation: scan 1.8s ease-in-out infinite; }
    .pulse-track i:nth-child(2)::before { width: 84%; animation-delay: -.4s; }
    .pulse-track i:nth-child(3)::before { width: 52%; animation-delay: -.8s; }
    .auth-panel { min-height: 0; display: flex; align-items: center; justify-content: center; padding: clamp(24px, 3vw, 36px); overflow: hidden; }
    .auth-card { width: 100%; max-width: 454px; display: flex; flex-direction: column; gap: 16px; background: color-mix(in srgb, var(--ac-surface) 96%, white); border: 1px solid color-mix(in srgb, var(--ac-border) 72%, white); border-radius: 20px; padding: clamp(28px, 3vw, 34px); box-shadow: 0 30px 80px rgba(15,23,42,.12), 0 12px 30px rgba(37,99,235,.08); }
    header { text-align: center; }
    .card-icon { display: grid; place-items: center; width: 66px; height: 66px; margin: 0 auto 18px; border-radius: 18px; color: var(--ac-primary); background: var(--ac-primary-light); font-size: 34px; }
    h2 { margin: 0; color: var(--ac-text); font-size: 25px; font-weight: 900; }
    header p:not(.card-eyebrow) { margin: 8px 0 0; color: var(--ac-muted); font-size: 14px; line-height: 1.6; }
    .field { display: flex; flex-direction: column; gap: 7px; color: var(--ac-text-2); font-size: 13px; font-weight: 800; }
    .input-shell { position: relative; display: flex; align-items: center; min-height: 48px; border: 1px solid var(--ac-border); border-radius: 13px; background: var(--ac-surface); transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
    .input-shell:focus-within { border-color: var(--ac-primary); box-shadow: 0 0 0 4px rgba(37,99,235,.12); transform: translateY(-1px); }
    .input-shell > .material-symbols-rounded { width: 44px; color: var(--ac-muted); font-size: 20px; text-align: center; }
    input { width: 100%; min-width: 0; height: 46px; border: 0; border-radius: 13px; padding: 0 12px 0 0; background: transparent; color: var(--ac-text); font: inherit; font-weight: 700; outline: none; }
    .primary { height: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 0; border-radius: 13px; background: linear-gradient(135deg,#2563eb,#3b82f6); color: #fff; font-weight: 900; cursor: pointer; box-shadow: 0 16px 32px rgba(37,99,235,.28); transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
    .primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(37,99,235,.34); filter: saturate(1.05); }
    .primary:disabled { opacity: .82; cursor: not-allowed; }
    .button-pulse svg { width: 34px; height: 24px; display: block; }
    .button-pulse polyline { fill: none; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    .button-pulse .pulse-back { stroke: rgba(255,255,255,.28); }
    .button-pulse .pulse-front { stroke: #fff; stroke-dasharray: 48, 144; stroke-dashoffset: 192; animation: dashPulse 1.4s linear infinite; }
    .success-panel { display: grid; grid-template-columns: 46px 1fr; align-items: center; gap: 12px; padding: 14px; border-radius: 15px; background: rgba(22,163,74,.1); color: var(--ac-success); text-align: left; }
    .success-panel .material-symbols-rounded { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; background: rgba(22,163,74,.14); }
    .success-panel strong, .success-panel small { display: block; }
    .success-panel small { margin-top: 2px; color: var(--ac-muted); font-weight: 700; line-height: 1.4; }
    .auth-footer { display: grid; gap: 10px; padding-top: 16px; border-top: 1px solid var(--ac-border); text-align: center; color: var(--ac-muted); }
    .auth-footer a { display: inline-flex; align-items: center; justify-content: center; gap: 7px; color: var(--ac-primary); font-weight: 900; text-decoration: none; }
    .auth-footer a:hover { text-decoration: none; }
    .auth-footer .material-symbols-rounded { font-size: 18px; }
    .auth-footer small { font-size: 12px; font-weight: 700; }
    .error { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ac-error-light); color: var(--ac-error); font-size: 13px; }
    :host-context(.dark) .auth-card { background: rgba(17,24,39,.94); border-color: rgba(148,163,184,.22); box-shadow: 0 30px 80px rgba(0,0,0,.38), 0 12px 30px rgba(59,130,246,.08); }
    :host-context(.dark) .input-shell { background: rgba(15,23,42,.72); border-color: rgba(148,163,184,.22); }
    @keyframes scan { 0%, 100% { transform: translateX(-8%); opacity: .72; } 50% { transform: translateX(16%); opacity: 1; } }
    @keyframes dashPulse { 72.5% { opacity: 0; } to { stroke-dashoffset: 0; } }
    @media (max-width: 1280px) { .security-visual { display: none; } }
    @media (max-width: 900px) { .auth-page { min-height: 100dvh; height: auto; grid-template-columns: 1fr; overflow: auto; } .auth-brand { display: none; } .auth-panel { min-height: 100dvh; padding: 24px; overflow: visible; } .auth-card { padding: 28px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordPageComponent {
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);

  protected email = '';
  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly assuranceItems = [
    { icon: 'mark_email_read', label: 'Verified recovery', caption: 'Reset link goes to the registered email' },
    { icon: 'timer', label: 'Time-limited access', caption: 'Recovery links expire for safety' },
    { icon: 'shield_lock', label: 'Protected account', caption: 'No account details are exposed' }
  ];

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);

    try {
      const response = await this.authService.forgotPassword({ email: this.email });
      this.sent.set(response.success);
      this.errorKey.set(response.success ? null : response.message);
    } catch {
      this.errorKey.set('Auth.Validation.EmailRequired');
    } finally {
      this.loading.set(false);
    }
  }
}
