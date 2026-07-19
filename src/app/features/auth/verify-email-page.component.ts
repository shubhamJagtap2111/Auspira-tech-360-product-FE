import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="auth-center-page">
      <div class="auth-card">
        @if (!verified()) {
          <div class="card-icon pending">
            <span class="material-symbols-rounded msf" style="font-size:32px;color:var(--ac-primary)">mark_email_unread</span>
          </div>
          <h2 class="auth-title">Verify your email</h2>
          <p class="auth-sub">
            We sent a verification link to<br>
            <strong class="email-highlight">john.smith&#64;hospital.com</strong>
          </p>

          <div class="otp-row">
            @for (i of [0,1,2,3,4,5]; track i) {
              <input class="otp-input" type="text" maxlength="1" (input)="onOtpInput($event, i)" />
            }
          </div>

          <button class="login-btn" (click)="onVerify()">
            @if (loading()) { <span class="spinner"></span> Verifying... }
            @else { <span class="material-symbols-rounded" style="font-size:18px">verified</span> Verify Email }
          </button>

          <p class="resend-text">
            Didn't receive the email?
            <button class="resend-btn" (click)="resend()">
              {{ resendCountdown() > 0 ? 'Resend in ' + resendCountdown() + 's' : 'Resend email' }}
            </button>
          </p>
        } @else {
          <div class="success-state">
            <div class="success-icon">
              <span class="material-symbols-rounded msf" style="font-size:40px;color:var(--ac-success)">verified_user</span>
            </div>
            <h2 class="auth-title">Email verified!</h2>
            <p class="auth-sub">Your account has been verified successfully. You can now sign in.</p>
            <a class="login-btn" routerLink="/auth/login" style="text-decoration:none;margin-top:8px">
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
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 40px 24px; background: var(--ac-bg);
    }
    .auth-card {
      width: 100%; max-width: 420px; background: var(--ac-surface);
      border: 1px solid var(--ac-border); border-radius: 20px; padding: 40px;
      box-shadow: var(--ac-sh-lg); text-align: center;
    }
    .card-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 72px; height: 72px; border-radius: 18px; margin-bottom: 20px;
    }
    .card-icon.pending { background: var(--ac-primary-light); }
    .auth-title { font-size: 22px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.02em; margin-bottom: 8px; }
    .auth-sub   { font-size: 13.5px; color: var(--ac-muted); margin-bottom: 28px; line-height: 1.6; }
    .email-highlight { color: var(--ac-text); }

    /* OTP */
    .otp-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 24px; }
    .otp-input {
      width: 46px; height: 52px; text-align: center;
      font-size: 20px; font-weight: 700; font-family: inherit;
      border: 2px solid var(--ac-border); border-radius: 10px;
      background: var(--ac-surface); color: var(--ac-text);
      outline: none; transition: all 150ms ease;
    }
    .otp-input:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

    .login-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      height: 44px; width: 100%; border-radius: 10px;
      background: var(--ac-primary); color: #fff;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: all 150ms ease; border: none; font-family: inherit; margin-bottom: 16px;
    }
    .login-btn:hover { background: var(--ac-primary-hover); box-shadow: 0 6px 20px rgba(37,99,235,0.35); }
    .login-btn.loading { opacity: 0.75; }
    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .resend-text { font-size: 13px; color: var(--ac-muted); margin-bottom: 16px; }
    .resend-btn { background: none; border: none; color: var(--ac-primary); font-weight: 600; font-size: 13px; font-family: inherit; cursor: pointer; }
    .resend-btn:hover { text-decoration: underline; }

    .success-state { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .success-icon { display: flex; align-items: center; justify-content: center; width: 80px; height: 80px; border-radius: 20px; background: var(--ac-success-light); margin-bottom: 4px; }
    .back-link { margin-top: 16px; }
    .auth-link { font-size: 13px; color: var(--ac-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
    .auth-link:hover { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyEmailPageComponent {
  protected readonly verified         = signal(false);
  protected readonly loading          = signal(false);
  protected readonly resendCountdown  = signal(0);

  protected onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.value && index < 5) {
      const next = input.closest('.otp-row')?.querySelectorAll('.otp-input')[index + 1] as HTMLInputElement;
      next?.focus();
    }
  }

  protected onVerify(): void {
    this.loading.set(true);
    setTimeout(() => { this.loading.set(false); this.verified.set(true); }, 1500);
  }

  protected resend(): void {
    if (this.resendCountdown() > 0) return;
    this.resendCountdown.set(60);
    const interval = setInterval(() => {
      this.resendCountdown.update(v => {
        if (v <= 1) { clearInterval(interval); return 0; }
        return v - 1;
      });
    }, 1000);
  }
}
