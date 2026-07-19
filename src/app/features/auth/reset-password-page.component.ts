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
          <span class="material-symbols-rounded msf" style="font-size:28px;color:var(--ac-primary)">key</span>
        </div>
        <h2 class="auth-title">Set new password</h2>
        <p class="auth-sub">Your new password must be at least 8 characters long.</p>

        @if (!success()) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label class="form-label">New Password</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">lock</span>
                <input class="auth-input" [type]="showPwd() ? 'text' : 'password'"
                       [(ngModel)]="password" name="password" placeholder="Min 8 characters" required />
                <button type="button" class="pwd-toggle" (click)="togglePasswordVisibility()">
                  <span class="material-symbols-rounded" style="font-size:18px">{{ showPwd() ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">lock_check</span>
                <input class="auth-input" [type]="showPwd() ? 'text' : 'password'"
                       [(ngModel)]="confirmPassword" name="confirm" placeholder="Repeat password" required />
              </div>
              @if (confirmPassword && password !== confirmPassword) {
                <p class="error-msg">
                  <span class="material-symbols-rounded" style="font-size:14px">error</span>
                  Passwords do not match
                </p>
              }
            </div>
            <button type="submit" class="login-btn" [class.loading]="loading()" [disabled]="password !== confirmPassword">
              @if (loading()) { <span class="spinner"></span> Updating... }
              @else { <span class="material-symbols-rounded" style="font-size:18px">check_circle</span> Update Password }
            </button>
          </form>
        } @else {
          <div class="success-state">
            <div class="success-icon">
              <span class="material-symbols-rounded msf" style="font-size:32px;color:var(--ac-success)">task_alt</span>
            </div>
            <p class="success-title">Password updated!</p>
            <p class="success-desc">Your password has been changed successfully.</p>
            <a class="login-btn" routerLink="/auth/login" style="text-decoration:none">
              <span class="material-symbols-rounded" style="font-size:18px">login</span>
              Continue to Sign In
            </a>
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
      display: flex; align-items: center; justify-content: center;
      padding: 40px 24px; background: var(--ac-bg);
    }
    .auth-card {
      width: 100%; max-width: 420px;
      background: var(--ac-surface); border: 1px solid var(--ac-border);
      border-radius: 20px; padding: 40px; box-shadow: var(--ac-sh-lg); text-align: center;
    }
    .card-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 64px; height: 64px; border-radius: 16px;
      background: var(--ac-primary-light); margin-bottom: 20px;
    }
    .auth-title { font-size: 22px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.02em; margin-bottom: 8px; }
    .auth-sub   { font-size: 13.5px; color: var(--ac-muted); margin-bottom: 28px; }
    .auth-form  { display: flex; flex-direction: column; gap: 16px; text-align: left; margin-bottom: 20px; }
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
    .pwd-toggle { position: absolute; right: 10px; color: var(--ac-muted); cursor: pointer; display: flex; align-items: center; }
    .error-msg { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--ac-error); margin-top: 4px; }
    .login-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      height: 44px; width: 100%; border-radius: 10px;
      background: var(--ac-primary); color: #fff;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: all 150ms ease; border: none; font-family: inherit;
    }
    .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .login-btn:hover:not(.loading):not(:disabled) { background: var(--ac-primary-hover); box-shadow: 0 6px 20px rgba(37,99,235,0.35); }
    .login-btn.loading { opacity: 0.75; cursor: not-allowed; }
    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-state { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 20px; }
    .success-icon { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 16px; background: var(--ac-success-light); }
    .success-title { font-size: 16px; font-weight: 700; color: var(--ac-text); }
    .success-desc  { font-size: 13.5px; color: var(--ac-muted); text-align: center; }
    .back-link { margin-top: 16px; }
    .auth-link { font-size: 13px; color: var(--ac-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
    .auth-link:hover { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordPageComponent {
  protected password = '';
  protected confirmPassword = '';
  protected readonly showPwd  = signal(false);
  protected readonly loading  = signal(false);
  protected readonly success  = signal(false);

  protected onSubmit(): void {
    if (this.password !== this.confirmPassword) return;
    this.loading.set(true);
    setTimeout(() => { this.loading.set(false); this.success.set(true); }, 1500);
  }

  protected togglePasswordVisibility(): void {
    this.showPwd.update((visible) => !visible);
  }
}
