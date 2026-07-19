import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <main class="auth-center-page">
      <form class="auth-card" (ngSubmit)="onSubmit()">
        <span class="material-symbols-rounded icon">lock_reset</span>
        <h2>{{ t('Auth.ForgotPassword.Title') }}</h2>
        <p>{{ t(sent() ? 'Auth.Messages.ForgotPasswordAccepted' : 'Auth.ForgotPassword.Description') }}</p>

        @if (!sent()) {
          @if (errorKey()) {
            <p class="error">{{ t(errorKey()!) }}</p>
          }
          <label>
            <span>{{ t('Auth.Login.Email.Label') }}</span>
            <input type="email" name="email" [(ngModel)]="email" [placeholder]="t('Auth.Login.Email.Placeholder')" required />
          </label>
          <button class="primary" type="submit" [disabled]="loading()">
            {{ t(loading() ? 'Common.Actions.Sending' : 'Auth.ForgotPassword.Submit') }}
          </button>
        }

        <a routerLink="/auth/login">{{ t('Auth.Navigation.BackToLogin') }}</a>
      </form>
    </main>
  `,
  styles: `
    .auth-center-page { min-height: 100vh; display: grid; place-items: center; padding: 32px; background: var(--ac-bg); }
    .auth-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px; background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 16px; padding: 36px; box-shadow: var(--ac-sh-lg); text-align: center; }
    .icon { display: grid; place-items: center; width: 60px; height: 60px; margin: 0 auto; border-radius: 14px; background: var(--ac-primary-light); color: var(--ac-primary); font-size: 30px; }
    h2 { margin: 0; color: var(--ac-text); font-size: 22px; }
    p { margin: 0; color: var(--ac-muted); font-size: 13.5px; line-height: 1.6; }
    label { display: flex; flex-direction: column; gap: 6px; text-align: left; color: var(--ac-text-2); font-weight: 600; font-size: 13px; }
    input { height: 42px; border: 1px solid var(--ac-border); border-radius: 10px; padding: 0 12px; font: inherit; color: var(--ac-text); background: var(--ac-surface); }
    .primary { height: 44px; border: 0; border-radius: 10px; background: var(--ac-primary); color: #fff; font-weight: 700; cursor: pointer; }
    .primary:disabled { opacity: .7; cursor: not-allowed; }
    a { color: var(--ac-primary); font-weight: 600; }
    .error { padding: 10px 12px; border-radius: 10px; background: var(--ac-error-light); color: var(--ac-error); }
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
