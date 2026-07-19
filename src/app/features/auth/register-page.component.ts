import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-left">
        <div class="al-inner">
          <div class="brand-mark">
            <span class="material-symbols-rounded msf" style="font-size:28px;color:#fff">favorite</span>
          </div>
          <h1 class="brand-title">Join Care360</h1>
          <p class="brand-tagline">Set up your hospital's<br>digital command centre.</p>
          <div class="stats-row">
            @for (s of stats; track s.label) {
              <div class="stat">
                <strong>{{ s.value }}</strong>
                <span>{{ s.label }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="auth-right">
        <div class="auth-card">
          <div class="auth-card-head">
            <h2 class="auth-title">Create your account</h2>
            <p class="auth-sub">Start your 14-day free trial. No credit card required.</p>
          </div>

          <form (ngSubmit)="onRegister()" class="auth-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">First Name</label>
                <div class="input-wrap">
                  <span class="input-icon material-symbols-rounded" style="font-size:18px">person</span>
                  <input class="auth-input" type="text" [(ngModel)]="firstName" name="firstName" placeholder="John" required />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Last Name</label>
                <div class="input-wrap">
                  <span class="input-icon material-symbols-rounded" style="font-size:18px">person</span>
                  <input class="auth-input" type="text" [(ngModel)]="lastName" name="lastName" placeholder="Smith" required />
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Hospital / Organization Name</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">local_hospital</span>
                <input class="auth-input" type="text" [(ngModel)]="hospital" name="hospital" placeholder="City General Hospital" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Work Email</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">mail</span>
                <input class="auth-input" type="email" [(ngModel)]="email" name="email" placeholder="john@hospital.com" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">lock</span>
                <input class="auth-input" [type]="showPwd() ? 'text' : 'password'" [(ngModel)]="password" name="password" placeholder="Min 8 characters" required />
                <button type="button" class="pwd-toggle" (click)="togglePasswordVisibility()">
                  <span class="material-symbols-rounded" style="font-size:18px">{{ showPwd() ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
              @if (password) {
                <div class="pwd-strength">
                  <div class="pwd-bar" [class]="pwdStrength()"></div>
                  <span class="pwd-label">{{ pwdStrengthLabel() }}</span>
                </div>
              }
            </div>

            <div class="form-check">
              <input type="checkbox" id="terms" [(ngModel)]="termsAccepted" name="terms" required />
              <label for="terms" class="check-label">
                I agree to the <a class="auth-link" href="#">Terms of Service</a> and <a class="auth-link" href="#">Privacy Policy</a>
              </label>
            </div>

            <button type="submit" class="login-btn" [class.loading]="loading()">
              @if (loading()) {
                <span class="spinner"></span>
                Creating account...
              } @else {
                <span class="material-symbols-rounded" style="font-size:18px">rocket_launch</span>
                Create Account
              }
            </button>
          </form>

          <p class="auth-footer-text">
            Already have an account?
            <a class="auth-link" routerLink="/auth/login">Sign in</a>
          </p>
          <p class="auth-version">v0.1.0 · © 2025 Auspira Technologies</p>
        </div>
      </div>
    </div>
  `,
  styles: `
    .auth-page { display: grid; grid-template-columns: 1fr 1fr; min-height: 100vh; }
    @media (max-width: 900px) { .auth-page { grid-template-columns: 1fr; } .auth-left { display: none; } }

    .auth-left {
      background: linear-gradient(145deg, #1e3a8a 0%, #2563eb 40%, #7c3aed 100%);
      padding: 48px;
      display: flex; align-items: center; justify-content: center;
    }
    .al-inner { max-width: 380px; }
    .brand-mark {
      display: flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; border-radius: 16px;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);
      margin-bottom: 24px;
    }
    .brand-title { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.02em; margin-bottom: 12px; }
    .brand-tagline { font-size: 17px; color: rgba(255,255,255,0.8); line-height: 1.5; margin-bottom: 36px; }
    .stats-row { display: flex; gap: 24px; }
    .stat { display: flex; flex-direction: column; }
    .stat strong { font-size: 22px; font-weight: 800; color: #fff; }
    .stat span   { font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 2px; }

    .auth-right {
      display: flex; align-items: center; justify-content: center;
      padding: 40px 24px; background: var(--ac-bg); overflow-y: auto;
    }
    .auth-card {
      width: 100%; max-width: 460px;
      background: var(--ac-surface); border: 1px solid var(--ac-border);
      border-radius: 20px; padding: 36px; box-shadow: var(--ac-sh-lg);
    }
    .auth-card-head { margin-bottom: 24px; }
    .auth-title { font-size: 22px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.02em; }
    .auth-sub { font-size: 13.5px; color: var(--ac-muted); margin-top: 4px; }

    .auth-form { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 600; color: var(--ac-text-2); }
    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-icon { position: absolute; left: 12px; color: var(--ac-muted); pointer-events: none; }
    .auth-input {
      width: 100%; height: 42px; padding: 0 40px;
      border: 1px solid var(--ac-border); border-radius: 10px;
      background: var(--ac-surface); color: var(--ac-text);
      font-size: 14px; font-family: inherit; outline: none;
      transition: all 150ms ease;
    }
    .auth-input:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .auth-input::placeholder { color: var(--ac-muted-2); }
    .pwd-toggle { position: absolute; right: 10px; color: var(--ac-muted); cursor: pointer; display: flex; align-items: center; }

    /* Password strength */
    .pwd-strength { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .pwd-bar { height: 3px; border-radius: 2px; flex: 1; transition: all 0.3s; }
    .pwd-bar.weak   { background: var(--ac-error); width: 33%; }
    .pwd-bar.medium { background: var(--ac-warning); width: 66%; }
    .pwd-bar.strong { background: var(--ac-success); width: 100%; }
    .pwd-label { font-size: 11px; color: var(--ac-muted); }

    .form-check { display: flex; align-items: flex-start; gap: 8px; }
    .check-label { font-size: 13px; color: var(--ac-text-3); cursor: pointer; line-height: 1.4; }
    .auth-link { color: var(--ac-primary); font-weight: 600; }
    .auth-link:hover { text-decoration: underline; }

    .login-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      height: 44px; border-radius: 10px; background: var(--ac-primary); color: #fff;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: all 150ms ease; border: none; font-family: inherit;
    }
    .login-btn:hover:not(.loading) {
      background: var(--ac-primary-hover);
      box-shadow: 0 6px 20px rgba(37,99,235,0.35);
      transform: translateY(-1px);
    }
    .login-btn.loading { opacity: 0.75; cursor: not-allowed; }
    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-footer-text { font-size: 13px; color: var(--ac-muted); text-align: center; margin-bottom: 8px; }
    .auth-version { font-size: 11px; color: var(--ac-muted-2); text-align: center; margin-top: 16px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPageComponent {
  protected firstName = '';
  protected lastName = '';
  protected hospital = '';
  protected email = '';
  protected password = '';
  protected termsAccepted = false;
  protected readonly showPwd  = signal(false);
  protected readonly loading  = signal(false);

  protected readonly stats = [
    { value: '120+', label: 'Hospitals Onboarded' },
    { value: '2400+', label: 'Active Users' },
    { value: '99.9%', label: 'Uptime SLA' }
  ];

  protected pwdStrength(): 'weak' | 'medium' | 'strong' {
    if (this.password.length < 6) return 'weak';
    if (this.password.length < 10) return 'medium';
    return 'strong';
  }

  protected pwdStrengthLabel(): string {
    return { weak: 'Weak password', medium: 'Fair password', strong: 'Strong password' }[this.pwdStrength()];
  }

  protected onRegister(): void {
    this.loading.set(true);
    setTimeout(() => this.loading.set(false), 2000);
  }

  protected togglePasswordVisibility(): void {
    this.showPwd.update((visible) => !visible);
  }
}
