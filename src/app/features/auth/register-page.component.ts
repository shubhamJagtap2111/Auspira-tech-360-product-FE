import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

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
          <p class="eyebrow">Hospital onboarding</p>
          <h1>Launch your digital hospital workspace.</h1>
          <p class="brand-copy">Create a secure tenant, invite hospital staff, and start managing care operations from one cloud platform.</p>

          <div class="setup-list">
            @for (item of setupItems; track item.label) {
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

        <div class="tenant-visual" aria-hidden="true">
          <div class="visual-title">
            <span class="status-dot"></span>
            <strong>Tenant setup</strong>
          </div>
          <div class="progress-card">
            <span class="material-symbols-rounded">database</span>
            <div>
              <strong>Secure database</strong>
              <small>Provisioned per hospital</small>
            </div>
          </div>
          <div class="progress-lines">
            <i></i><i></i><i></i>
          </div>
          <div class="mini-stats">
            @for (s of stats; track s.label) {
              <span><strong>{{ s.value }}</strong>{{ s.label }}</span>
            }
          </div>
        </div>
      </section>

      <section class="auth-panel">
        <div class="auth-card">
          <div class="auth-card-head">
            <p class="card-eyebrow">Start free trial</p>
            <h2 class="auth-title">Create hospital account</h2>
            <p class="auth-sub">Set up your tenant workspace. No credit card required.</p>
          </div>

          <form (ngSubmit)="onRegister()" class="auth-form">
            @if (errorMessage()) {
              <p class="form-message error">{{ errorMessage() }}</p>
            }
            @if (successMessage()) {
              <p class="form-message success">{{ successMessage() }}</p>
            }

            <div class="form-row">
              <label class="form-group">
                <span>First name</span>
                <span class="input-wrap">
                  <span class="input-icon material-symbols-rounded">person</span>
                  <input class="auth-input" type="text" [(ngModel)]="firstName" name="firstName" placeholder="John" required />
                </span>
              </label>
              <label class="form-group">
                <span>Last name</span>
                <span class="input-wrap">
                  <span class="input-icon material-symbols-rounded">badge</span>
                  <input class="auth-input" type="text" [(ngModel)]="lastName" name="lastName" placeholder="Smith" required />
                </span>
              </label>
            </div>

            <div class="form-row">
              <label class="form-group full">
                <span>Hospital name</span>
                <span class="input-wrap">
                  <span class="input-icon material-symbols-rounded">local_hospital</span>
                  <input class="auth-input" type="text" [(ngModel)]="hospital" name="hospital" placeholder="City General Hospital" required />
                </span>
              </label>
            </div>

            <div class="form-row">
              <label class="form-group">
                <span>Work email</span>
                <span class="input-wrap">
                  <span class="input-icon material-symbols-rounded">mail</span>
                  <input class="auth-input" type="email" [(ngModel)]="email" name="email" placeholder="john@hospital.com" required />
                </span>
              </label>
              <label class="form-group">
                <span>Password</span>
                <span class="input-wrap">
                  <span class="input-icon material-symbols-rounded">lock</span>
                  <input class="auth-input" [type]="showPwd() ? 'text' : 'password'" [(ngModel)]="password" name="password" placeholder="Min 8 characters" required />
                  <button type="button" class="pwd-toggle" (click)="togglePasswordVisibility()" aria-label="Toggle password visibility">
                    <span class="material-symbols-rounded">{{ showPwd() ? 'visibility_off' : 'visibility' }}</span>
                  </button>
                </span>
              </label>
            </div>

            @if (password) {
              <div class="pwd-strength">
                <div class="pwd-track"><i [class]="pwdStrength()"></i></div>
                <span>{{ pwdStrengthLabel() }}</span>
              </div>
            }

            <label class="form-check">
              <input type="checkbox" [(ngModel)]="termsAccepted" name="terms" required />
              <span>
                I agree to the
                <a class="auth-link" href="https://auspiratech.com/terms-of-service" target="_blank" rel="noopener noreferrer">Terms</a>
                and
                <a class="auth-link" href="https://auspiratech.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              </span>
            </label>

            <button type="submit" class="primary" [disabled]="loading()">
              @if (loading()) {
                <span class="button-pulse" aria-hidden="true">
                  <svg viewBox="0 0 64 48">
                    <polyline class="pulse-back" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                    <polyline class="pulse-front" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                  </svg>
                </span>
                Creating workspace...
              } @else {
                <span class="material-symbols-rounded">rocket_launch</span>
                Create Account
              }
            </button>

            <button type="button" class="google-button" (click)="onGoogleRegister()">
              <span class="google-mark">G</span>
              Sign up with Google
            </button>
          </form>

          <footer class="auth-footer">
            <span>Already have an account? <a routerLink="/auth/login">Sign in</a></span>
            <small>Version 0.1.0</small>
            <small>© 2026 Auspira Technologies. All rights reserved.</small>
          </footer>
        </div>
      </section>
    </div>
  `,
  styles: `
    .auth-page { height: 100dvh; min-height: 0; display: grid; grid-template-columns: minmax(500px, .95fr) minmax(620px, 1.05fr); background: radial-gradient(circle at 78% 12%, rgba(37,99,235,.09), transparent 30%), var(--ac-bg); overflow: hidden; }
    .auth-brand { position: relative; display: flex; align-items: center; justify-content: center; gap: 32px; padding: clamp(30px, 4vw, 48px); color: #fff; background: linear-gradient(145deg, #102a63, #2563eb 48%, #0f766e); overflow: hidden; }
    .auth-brand::before, .auth-brand::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255,255,255,.1); }
    .auth-brand::before { width: 280px; height: 280px; top: -100px; right: -70px; }
    .auth-brand::after { width: 220px; height: 220px; bottom: -90px; left: -70px; }
    .brand-content { position: relative; z-index: 1; max-width: 500px; }
    .brand-mark { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 17px; background: rgba(255,255,255,.16); box-shadow: 0 20px 45px rgba(0,0,0,.24); margin-bottom: 18px; backdrop-filter: blur(12px); }
    .brand-mark .material-symbols-rounded { font-size: 30px; color: #fff; }
    .eyebrow, .card-eyebrow { margin: 0 0 10px; color: #9ef4d3; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .card-eyebrow { color: var(--ac-primary); }
    h1 { margin: 0 0 14px; font-size: clamp(34px, 4vw, 52px); line-height: 1; }
    .brand-copy { max-width: 480px; margin: 0; color: rgba(255,255,255,.86); font-size: 16px; line-height: 1.55; }
    .setup-list { display: grid; gap: 10px; margin-top: 24px; }
    .setup-list article { display: grid; grid-template-columns: 42px 1fr; align-items: center; gap: 12px; padding: 11px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 13px; background: rgba(255,255,255,.11); backdrop-filter: blur(14px); }
    .setup-list .material-symbols-rounded { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; color: #bbf7d0; background: rgba(255,255,255,.12); }
    .setup-list strong, .setup-list small { display: block; }
    .setup-list small { margin-top: 2px; color: rgba(255,255,255,.68); font-weight: 700; }
    .tenant-visual { position: relative; z-index: 1; width: 310px; padding: 18px; border: 1px solid rgba(255,255,255,.2); border-radius: 22px; background: rgba(10,30,68,.36); box-shadow: 0 30px 80px rgba(0,0,0,.24); backdrop-filter: blur(18px); }
    .visual-title { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,.9); font-size: 13px; }
    .status-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 7px rgba(34,197,94,.14); }
    .progress-card { display: grid; grid-template-columns: 50px 1fr; align-items: center; gap: 12px; margin-top: 18px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.12); }
    .progress-card .material-symbols-rounded { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 14px; background: #fff; color: #2563eb; }
    .progress-card strong, .progress-card small { display: block; }
    .progress-card small { color: rgba(255,255,255,.68); margin-top: 3px; }
    .progress-lines { display: grid; gap: 10px; margin: 18px 0; }
    .progress-lines i { height: 10px; border-radius: 999px; background: rgba(255,255,255,.16); overflow: hidden; }
    .progress-lines i::before { content: ''; display: block; width: 68%; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#a7f3d0,#60a5fa); }
    .progress-lines i:nth-child(2)::before { width: 84%; }
    .progress-lines i:nth-child(3)::before { width: 52%; }
    .mini-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .mini-stats span { display: grid; gap: 2px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.72); font-size: 11px; font-weight: 800; }
    .mini-stats strong { color: #fff; font-size: 16px; }
    .auth-panel { min-height: 0; display: flex; align-items: center; justify-content: center; padding: clamp(24px, 3vw, 36px); overflow: hidden; }
    .auth-card { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 16px; padding: clamp(26px, 3vw, 34px); border: 1px solid color-mix(in srgb, var(--ac-border) 72%, white); border-radius: 20px; background: color-mix(in srgb, var(--ac-surface) 96%, white); box-shadow: 0 30px 80px rgba(15,23,42,.12), 0 12px 30px rgba(37,99,235,.08); }
    .auth-card-head { margin-bottom: 2px; }
    .auth-title { margin: 0; color: var(--ac-text); font-size: 25px; font-weight: 900; }
    .auth-sub { margin: 6px 0 0; color: var(--ac-muted); font-size: 14px; }
    .auth-form { display: flex; flex-direction: column; gap: 13px; }
    .form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 7px; color: var(--ac-text-2); font-size: 13px; font-weight: 800; }
    .form-group.full { grid-column: 1 / -1; }
    .input-wrap { position: relative; display: flex; align-items: center; min-height: 46px; border: 1px solid var(--ac-border); border-radius: 13px; background: var(--ac-surface); transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
    .input-wrap:focus-within { border-color: var(--ac-primary); box-shadow: 0 0 0 4px rgba(37,99,235,.12); transform: translateY(-1px); }
    .input-icon { width: 42px; color: var(--ac-muted); font-size: 20px; text-align: center; }
    .auth-input { width: 100%; min-width: 0; height: 44px; border: 0; padding: 0 10px 0 0; border-radius: 13px; background: transparent; color: var(--ac-text); font: inherit; font-weight: 700; outline: none; }
    .pwd-toggle { display: grid; place-items: center; width: 40px; height: 40px; margin-right: 3px; border: 0; border-radius: 10px; background: transparent; color: var(--ac-muted); cursor: pointer; }
    .pwd-toggle:hover { background: var(--ac-surface-2); color: var(--ac-primary); }
    .pwd-toggle .material-symbols-rounded { font-size: 20px; }
    .pwd-strength { display: flex; align-items: center; gap: 10px; color: var(--ac-muted); font-size: 12px; font-weight: 800; }
    .pwd-track { flex: 1; height: 5px; border-radius: 999px; background: var(--ac-surface-2); overflow: hidden; }
    .pwd-track i { display: block; height: 100%; border-radius: inherit; }
    .pwd-track .weak { width: 33%; background: var(--ac-error); }
    .pwd-track .medium { width: 66%; background: var(--ac-warning); }
    .pwd-track .strong { width: 100%; background: var(--ac-success); }
    .form-check { display: flex; align-items: flex-start; gap: 9px; color: var(--ac-text-3); font-size: 13px; font-weight: 700; line-height: 1.45; }
    .form-check input { width: 16px; height: 16px; margin-top: 1px; accent-color: var(--ac-primary); }
    .primary, .google-button { height: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 13px; font-weight: 900; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
    .primary { border: 0; background: linear-gradient(135deg,#2563eb,#3b82f6); color: #fff; box-shadow: 0 16px 32px rgba(37,99,235,.28); }
    .primary:hover:not(:disabled), .google-button:hover { transform: translateY(-2px); }
    .primary:disabled { opacity: .82; cursor: not-allowed; }
    .primary .material-symbols-rounded { font-size: 19px; }
    .google-button { border: 1px solid var(--ac-border); background: #fff; color: #111827; box-shadow: 0 10px 24px rgba(15,23,42,.06); }
    .google-button:hover { border-color: rgba(37,99,235,.35); box-shadow: 0 16px 32px rgba(15,23,42,.1); }
    .google-mark { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid #e5e7eb; color: #ea4335; background: #fff; font-weight: 900; font-family: Arial, sans-serif; font-size: 16px; }
    .button-pulse svg { width: 34px; height: 24px; display: block; }
    .button-pulse polyline { fill: none; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    .button-pulse .pulse-back { stroke: rgba(255,255,255,.28); }
    .button-pulse .pulse-front { stroke: #fff; stroke-dasharray: 48, 144; stroke-dashoffset: 192; animation: dashPulse 1.4s linear infinite; }
    .auth-link, a { color: var(--ac-primary); font-weight: 800; text-decoration: none; }
    .auth-link:hover, a:hover { text-decoration: underline; }
    .auth-footer { display: grid; gap: 8px; padding-top: 14px; border-top: 1px solid var(--ac-border); text-align: center; color: var(--ac-muted); font-size: 13px; font-weight: 700; }
    .auth-footer small { font-size: 12px; color: var(--ac-muted); }
    .form-message { margin: 0; padding: 9px 11px; border-radius: 10px; font-size: 13px; line-height: 1.35; }
    .form-message.error { background: var(--ac-error-light); color: var(--ac-error); }
    .form-message.success { background: rgba(22, 163, 74, .1); color: var(--ac-success); }
    :host-context(.dark) .auth-card { background: rgba(17,24,39,.94); border-color: rgba(148,163,184,.22); box-shadow: 0 30px 80px rgba(0,0,0,.38), 0 12px 30px rgba(59,130,246,.08); }
    :host-context(.dark) .input-wrap { background: rgba(15,23,42,.72); border-color: rgba(148,163,184,.22); }
    :host-context(.dark) .google-button { background: rgba(255,255,255,.94); color: #111827; }
    @keyframes dashPulse { 72.5% { opacity: 0; } to { stroke-dashoffset: 0; } }
    @media (max-width: 1220px) { .tenant-visual { display: none; } }
    @media (max-height: 820px) { .auth-card { gap: 12px; padding: 24px 28px; } .auth-form { gap: 10px; } .setup-list { gap: 8px; margin-top: 18px; } }
    @media (max-width: 900px) { .auth-page { min-height: 100dvh; height: auto; grid-template-columns: 1fr; overflow: auto; } .auth-brand { display: none; } .auth-panel { min-height: 100dvh; padding: 24px; overflow: visible; } .auth-card { max-width: 560px; } .form-row { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tenantContext = inject(TenantContextService);

  protected firstName = '';
  protected lastName = '';
  protected hospital = '';
  protected email = '';
  protected password = '';
  protected termsAccepted = false;
  protected readonly showPwd = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly setupItems = [
    { icon: 'domain_add', label: 'Tenant workspace', caption: 'Dedicated hospital environment' },
    { icon: 'database', label: 'Secure records', caption: 'Prepared for clinical operations' },
    { icon: 'admin_panel_settings', label: 'Admin access', caption: 'Manage users and permissions' }
  ];

  protected readonly stats = [
    { value: '14d', label: 'trial' },
    { value: '24/7', label: 'cloud' },
    { value: 'SaaS', label: 'ready' }
  ];

  protected pwdStrength(): 'weak' | 'medium' | 'strong' {
    if (this.password.length < 6) return 'weak';
    if (this.password.length < 10) return 'medium';
    return 'strong';
  }

  protected pwdStrengthLabel(): string {
    return { weak: 'Weak password', medium: 'Fair password', strong: 'Strong password' }[this.pwdStrength()];
  }

  protected async onRegister(): Promise<void> {
    if (!this.termsAccepted) {
      this.errorMessage.set('Please accept the Terms of Service and Privacy Policy.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const response = await this.authService.register({
        hospitalName: this.hospital,
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        password: this.password,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      });

      if (!response.success || !response.data) {
        this.errorMessage.set(response.message || 'Could not create hospital tenant.');
        return;
      }

      this.tenantContext.setTenantCode(response.data.tenantCode);
      this.successMessage.set(`Hospital registered. Tenant database ${response.data.databaseName} is ready.`);
      await this.router.navigate(['/auth/login'], { queryParams: { tenantCode: response.data.tenantCode } });
    } catch {
      this.errorMessage.set('Could not create hospital tenant. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected togglePasswordVisibility(): void {
    this.showPwd.update((visible) => !visible);
  }

  protected onGoogleRegister(): void {
    if (!this.hospital.trim()) {
      this.errorMessage.set('Enter hospital name before signing up with Google.');
      return;
    }

    this.authService.startGoogleRegistration({
      hospitalName: this.hospital,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
    });
  }
}
