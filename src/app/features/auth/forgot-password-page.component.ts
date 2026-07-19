import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-center-page">
      <div class="auth-card">
        <div class="card-icon">
          <span class="material-symbols-rounded msf" style="font-size:28px;color:var(--ac-primary)">lock_reset</span>
        </div>
        <h2 class="auth-title">Forgot your password?</h2>
        <p class="auth-sub">No worries! Enter your email and we'll send you a reset link.</p>

        @if (!sent()) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label class="form-label">Email address</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">mail</span>
                <input class="auth-input" type="email" [(ngModel)]="email" name="email"
                       placeholder="doctor@hospital.com" required />
              </div>
            </div>
            <button type="submit" class="login-btn" [class.loading]="loading()">
              @if (loading()) { <span class="spinner"></span> Sending... }
              @else { <span class="material-symbols-rounded" style="font-size:18px">send</span> Send Reset Link }
            </button>
          </form>
        } @else {
          <div class="success-state">
            <div class="success-icon">
              <span class="material-symbols-rounded msf" style="font-size:32px;color:var(--ac-success)">mark_email_read</span>
            </div>
            <p class="success-title">Check your inbox</p>
            <p class="success-desc">We sent a password reset link to <strong>{{ email }}</strong></p>
            <button class="login-btn" (click)="sent.set(false)">
              <span class="material-symbols-rounded" style="font-size:18px">refresh</span>
              Try a different email
            </button>
          </div>
        }

        <p class="back-link">
          <a routerLink="/auth/login" class="auth-link">
            <span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle">arrow_back</span>
            Back to Sign In
          </a>
        </p>
      </div>
    </div>
  `,
  styles: `
    .auth-center-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      background: var(--ac-bg);
    }
    .auth-card {
      width: 100%; max-width: 420px;
      background: var(--ac-surface); border: 1px solid var(--ac-border);
      border-radius: 20px; padding: 40px; box-shadow: var(--ac-sh-lg);
      text-align: center;
    }
    .card-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 64px; height: 64px; border-radius: 16px;
      background: var(--ac-primary-light); margin-bottom: 20px;
    }
    .auth-title { font-size: 22px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.02em; margin-bottom: 8px; }
    .auth-sub { font-size: 13.5px; color: var(--ac-muted); margin-bottom: 28px; }
    .auth-form { display: flex; flex-direction: column; gap: 16px; text-align: left; margin-bottom: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 600; color: var(--ac-text-2); }
    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-icon { position: absolute; left: 12px; color: var(--ac-muted); pointer-events: none; }
    .auth-input {
      width: 100%; height: 42px; padding: 0 40px;
      border: 1px solid var(--ac-border); border-radius: 10px;
      background: var(--ac-surface); color: var(--ac-text);
      font-size: 14px; font-family: inherit; outline: none; transition: all 150ms ease;
    }
    .auth-input:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .auth-input::placeholder { color: var(--ac-muted-2); }
    .login-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      height: 44px; width: 100%; border-radius: 10px;
      background: var(--ac-primary); color: #fff;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: all 150ms ease; border: none; font-family: inherit;
    }
    .login-btn:hover:not(.loading) { background: var(--ac-primary-hover); box-shadow: 0 6px 20px rgba(37,99,235,0.35); }
    .login-btn.loading { opacity: 0.75; cursor: not-allowed; }
    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-state { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 20px; }
    .success-icon { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 16px; background: var(--ac-success-light); }
    .success-title { font-size: 16px; font-weight: 700; color: var(--ac-text); }
    .success-desc { font-size: 13.5px; color: var(--ac-muted); text-align: center; }
    .back-link { margin-top: 16px; }
    .auth-link { font-size: 13px; color: var(--ac-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
    .auth-link:hover { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordPageComponent {
  protected email = '';
  protected readonly loading = signal(false);
  protected readonly sent    = signal(false);

  protected onSubmit(): void {
    this.loading.set(true);
    setTimeout(() => { this.loading.set(false); this.sent.set(true); }, 1500);
  }
}
