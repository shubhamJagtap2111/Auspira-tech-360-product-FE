import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-page">
      <section class="auth-brand">
        <div class="brand-content">
          <div class="brand-mark">
            <span class="material-symbols-rounded" style="font-size:28px;color:#fff">favorite</span>
          </div>
          <h1>{{ t('App.Brand.Name') }}</h1>
          <p>{{ t('Auth.Brand.Tagline') }}</p>
        </div>
      </section>

      <section class="auth-panel">
        <form class="auth-card" (ngSubmit)="onLogin()">
          <header>
            <h2>{{ t('Auth.Login.Title') }}</h2>
            <p>{{ t('Auth.Login.Subtitle') }}</p>
          </header>

          @if (errorKey()) {
            <p class="error">{{ t(errorKey()!) }}</p>
          }

          <label>
            <span>{{ t('Auth.Login.Email.Label') }}</span>
            <input type="email" name="email" [(ngModel)]="email" [placeholder]="t('Auth.Login.Email.Placeholder')" required />
          </label>

          <label>
            <span>{{ t('Auth.Login.Password.Label') }}</span>
            <input [type]="showPassword() ? 'text' : 'password'" name="password" [(ngModel)]="password" [placeholder]="t('Auth.Login.Password.Placeholder')" required />
          </label>

          <div class="form-row">
            <label class="check">
              <input type="checkbox" name="rememberMe" [(ngModel)]="rememberMe" />
              <span>{{ t('Auth.Login.RememberMe.Label') }}</span>
            </label>
            <button type="button" class="link-button" (click)="togglePasswordVisibility()">
              {{ t(showPassword() ? 'Auth.Login.HidePassword' : 'Auth.Login.ShowPassword') }}
            </button>
          </div>

          <button class="primary" type="submit" [disabled]="loading()">
            {{ t(loading() ? 'Auth.Login.SigningIn' : 'Auth.Login.Submit') }}
          </button>

          <a routerLink="/auth/forgot-password">{{ t('Auth.ForgotPassword.Link') }}</a>
        </form>
      </section>
    </div>
  `,
  styles: `
    .auth-page { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; background: var(--ac-bg); }
    .auth-brand { display: flex; align-items: center; justify-content: center; padding: 48px; background: linear-gradient(145deg, #1e3a8a, #2563eb 55%, #0f766e); color: #fff; }
    .brand-content { max-width: 420px; }
    .brand-mark { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 14px; background: rgba(255,255,255,.16); margin-bottom: 24px; }
    h1 { font-size: 30px; margin: 0 0 12px; }
    .auth-brand p { color: rgba(255,255,255,.82); font-size: 17px; line-height: 1.6; }
    .auth-panel { display: flex; align-items: center; justify-content: center; padding: 32px; }
    .auth-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px; background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 16px; padding: 34px; box-shadow: var(--ac-sh-lg); }
    header h2 { margin: 0; font-size: 22px; color: var(--ac-text); }
    header p { margin: 6px 0 0; color: var(--ac-muted); font-size: 13.5px; }
    label { display: flex; flex-direction: column; gap: 6px; color: var(--ac-text-2); font-size: 13px; font-weight: 600; }
    input { height: 42px; border: 1px solid var(--ac-border); border-radius: 10px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    input:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .form-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .check { flex-direction: row; align-items: center; font-weight: 500; color: var(--ac-text-3); }
    .check input { width: 16px; height: 16px; }
    .primary { height: 44px; border: 0; border-radius: 10px; background: var(--ac-primary); color: #fff; font-weight: 700; cursor: pointer; }
    .primary:disabled { opacity: .7; cursor: not-allowed; }
    .link-button, a { background: transparent; border: 0; color: var(--ac-primary); font-weight: 600; cursor: pointer; text-align: left; padding: 0; }
    .error { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ac-error-light); color: var(--ac-error); font-size: 13px; }
    @media (max-width: 900px) { .auth-page { grid-template-columns: 1fr; } .auth-brand { display: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

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

    try {
      const response = await this.authService.login({ email: this.email, password: this.password, rememberMe: this.rememberMe });
      if (!response.success || !response.data) {
        this.errorKey.set(response.message);
        return;
      }

      this.authStore.setSession(response.data);
      await this.router.navigateByUrl('/');
    } catch {
      this.errorKey.set('Auth.Errors.InvalidCredentials');
    } finally {
      this.loading.set(false);
    }
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }
}
