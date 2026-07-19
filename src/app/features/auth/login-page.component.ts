import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-page">

      <!-- LEFT: Brand Panel -->
      <div class="auth-left">
        <div class="auth-left-inner">
          <div class="brand-mark">
            <span class="material-symbols-rounded msf" style="font-size:28px;color:#fff">favorite</span>
          </div>
          <h1 class="brand-title">Auspira Care360</h1>
          <p class="brand-tagline">A smarter way to<br>manage healthcare.</p>

          <ul class="benefits">
            @for (b of benefits; track b) {
              <li class="benefit-item">
                <span class="benefit-check material-symbols-rounded msf" style="font-size:16px">check_circle</span>
                {{ b }}
              </li>
            }
          </ul>

          <div class="auth-illustration">
            <div class="illus-card">
              <div class="illus-row">
                <div class="illus-avatar a1">PK</div>
                <div class="illus-avatar a2">RG</div>
                <div class="illus-avatar a3">NS</div>
              </div>
              <p class="illus-label">2,400+ healthcare professionals trust Care360</p>
              <div class="illus-metrics">
                <div class="illus-metric">
                  <strong>98.9%</strong>
                  <span>Uptime SLA</span>
                </div>
                <div class="illus-metric">
                  <strong>4.9★</strong>
                  <span>User rating</span>
                </div>
                <div class="illus-metric">
                  <strong>HIPAA</strong>
                  <span>Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Login Form -->
      <div class="auth-right">
        <div class="auth-card">
          <div class="auth-card-head">
            <h2 class="auth-title">Welcome back</h2>
            <p class="auth-sub">Sign in to your Care360 account</p>
          </div>

          <!-- Social Login -->
          <div class="social-btns">
            <button class="social-btn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>
            <button class="social-btn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9.318 0C4.174 0 0 4.174 0 9.318 0 13.437 2.55 16.944 6.092 18c.444.08.605-.193.605-.429v-1.508c-2.475.537-2.995-1.194-2.995-1.194-.404-1.028-1.087-1.301-1.087-1.301-.888-.607.067-.595.067-.595.982.07 1.5 1.008 1.5 1.008.874 1.497 2.293 1.065 2.852.814.09-.633.342-1.065.622-1.31-2.176-.247-4.465-1.088-4.465-4.845 0-1.07.382-1.945 1.008-2.63-.1-.247-.437-1.245.096-2.595 0 0 .822-.264 2.693 1.003A9.36 9.36 0 0 1 9.32 5.098c.831.004 1.669.112 2.45.33 1.87-1.267 2.69-1.003 2.69-1.003.534 1.35.197 2.348.097 2.595.628.685 1.007 1.56 1.007 2.63 0 3.766-2.294 4.594-4.477 4.836.353.304.666.903.666 1.82v2.697c0 .239.159.514.61.428C15.453 16.94 18 13.434 18 9.318 18 4.174 13.826 0 9.318 0Z" fill="#24292F"/>
              </svg>
              <span>Continue with Microsoft</span>
            </button>
          </div>

          <div class="divider-row">
            <span class="divider-line"></span>
            <span class="divider-text">or sign in with email</span>
            <span class="divider-line"></span>
          </div>

          <!-- Form -->
          <form (ngSubmit)="onLogin()" class="auth-form">
            <div class="form-group">
              <label class="form-label">Email address</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">mail</span>
                <input class="auth-input" type="email" [(ngModel)]="email" name="email"
                       placeholder="doctor@hospital.com" required />
              </div>
            </div>

            <div class="form-group">
              <div class="form-label-row">
                <label class="form-label">Password</label>
                <a class="forgot-link" routerLink="/auth/forgot-password">Forgot password?</a>
              </div>
              <div class="input-wrap">
                <span class="input-icon material-symbols-rounded" style="font-size:18px">lock</span>
                <input class="auth-input" [type]="showPwd() ? 'text' : 'password'"
                       [(ngModel)]="password" name="password" placeholder="••••••••" required />
                <button type="button" class="pwd-toggle" (click)="togglePasswordVisibility()">
                  <span class="material-symbols-rounded" style="font-size:18px">
                    {{ showPwd() ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>

            <div class="form-check">
              <input type="checkbox" id="remember" [(ngModel)]="rememberMe" name="remember" />
              <label for="remember" class="check-label">Remember me for 30 days</label>
            </div>

            <button type="submit" class="login-btn" [class.loading]="loading()">
              @if (loading()) {
                <span class="spinner"></span>
                Signing in...
              } @else {
                <span class="material-symbols-rounded" style="font-size:18px">login</span>
                Sign in to Care360
              }
            </button>
          </form>

          <p class="auth-footer-text">
            Don't have an account?
            <a class="auth-link" routerLink="/auth/register">Create account</a>
          </p>
          <p class="auth-footer-text">
            Need help?
            <a class="auth-link" href="#">Contact Support</a>
          </p>

          <p class="auth-version">v0.1.0 · © 2025 Auspira Technologies</p>
        </div>
      </div>
    </div>
  `,
  styles: `
    .auth-page {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 100vh;
    }
    @media (max-width: 900px) {
      .auth-page { grid-template-columns: 1fr; }
      .auth-left  { display: none; }
    }

    /* ── Left Brand Panel ── */
    .auth-left {
      background: linear-gradient(145deg, #1e3a8a 0%, #2563eb 40%, #7c3aed 100%);
      padding: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .auth-left::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    .auth-left-inner {
      position: relative;
      max-width: 420px;
      width: 100%;
    }
    .brand-mark {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 28px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }
    .brand-tagline {
      font-size: 18px;
      color: rgba(255,255,255,0.8);
      line-height: 1.5;
      margin-bottom: 32px;
    }
    .benefits { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px; }
    .benefit-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: rgba(255,255,255,0.9);
    }
    .benefit-check { color: #4ade80; }

    /* Illustration card */
    .auth-illustration {}
    .illus-card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 20px;
    }
    .illus-row { display: flex; gap: -8px; margin-bottom: 12px; }
    .illus-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 800;
      border: 2px solid rgba(255,255,255,0.3);
      margin-right: -8px;
    }
    .a1 { background: rgba(37,99,235,0.5); color: #fff; }
    .a2 { background: rgba(124,58,237,0.5); color: #fff; }
    .a3 { background: rgba(16,185,129,0.5); color: #fff; }
    .illus-label { font-size: 12.5px; color: rgba(255,255,255,0.75); margin-bottom: 16px; }
    .illus-metrics { display: flex; gap: 20px; }
    .illus-metric { display: flex; flex-direction: column; }
    .illus-metric strong { font-size: 16px; font-weight: 800; color: #fff; }
    .illus-metric span   { font-size: 11px; color: rgba(255,255,255,0.6); }

    /* ── Right Auth Form ── */
    .auth-right {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      background: var(--ac-bg);
    }
    .auth-card {
      width: 100%;
      max-width: 420px;
      background: var(--ac-surface);
      border: 1px solid var(--ac-border);
      border-radius: 20px;
      padding: 36px;
      box-shadow: var(--ac-sh-lg);
    }
    .auth-card-head { margin-bottom: 24px; }
    .auth-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--ac-text);
      letter-spacing: -0.02em;
    }
    .auth-sub { font-size: 13.5px; color: var(--ac-muted); margin-top: 4px; }

    /* Social buttons */
    .social-btns { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 42px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      color: var(--ac-text-3);
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 150ms ease;
    }
    .social-btn:hover { background: var(--ac-surface-2); border-color: var(--ac-border-2); }

    /* Divider */
    .divider-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .divider-line { flex: 1; height: 1px; background: var(--ac-border); }
    .divider-text { font-size: 11.5px; color: var(--ac-muted); white-space: nowrap; }

    /* Form */
    .auth-form { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 600; color: var(--ac-text-2); }
    .form-label-row { display: flex; align-items: center; justify-content: space-between; }
    .forgot-link { font-size: 12.5px; color: var(--ac-primary); font-weight: 500; }
    .forgot-link:hover { text-decoration: underline; }

    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-icon {
      position: absolute;
      left: 12px;
      color: var(--ac-muted);
      pointer-events: none;
    }
    .auth-input {
      width: 100%;
      height: 42px;
      padding: 0 40px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      color: var(--ac-text);
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: all 150ms ease;
    }
    .auth-input:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .auth-input::placeholder { color: var(--ac-muted-2); }
    .pwd-toggle {
      position: absolute;
      right: 10px;
      color: var(--ac-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .pwd-toggle:hover { color: var(--ac-text); }

    .form-check {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .check-label { font-size: 13px; color: var(--ac-text-3); cursor: pointer; }

    .login-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 44px;
      border-radius: 10px;
      background: var(--ac-primary);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 150ms ease;
      border: none;
      font-family: inherit;
    }
    .login-btn:hover:not(.loading) {
      background: var(--ac-primary-hover);
      box-shadow: 0 6px 20px rgba(37,99,235,0.35);
      transform: translateY(-1px);
    }
    .login-btn.loading { opacity: 0.75; cursor: not-allowed; }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Footer */
    .auth-footer-text { font-size: 13px; color: var(--ac-muted); text-align: center; margin-bottom: 8px; }
    .auth-link { color: var(--ac-primary); font-weight: 600; }
    .auth-link:hover { text-decoration: underline; }
    .auth-version { font-size: 11px; color: var(--ac-muted-2); text-align: center; margin-top: 16px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  protected email = '';
  protected password = '';
  protected rememberMe = false;
  protected readonly showPwd = signal(false);
  protected readonly loading = signal(false);

  protected readonly benefits = [
    'Multi-tenant Healthcare ERP',
    'Secure & HIPAA Compliant',
    'Cloud Based — 99.9% Uptime',
    'Real-Time Analytics & Insights'
  ];

  protected onLogin(): void {
    this.loading.set(true);
    setTimeout(() => this.loading.set(false), 2000);
  }

  protected togglePasswordVisibility(): void {
    this.showPwd.update((visible) => !visible);
  }
}
