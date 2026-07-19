import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="auth-center-page">
      <form class="auth-card" (ngSubmit)="onSubmit()">
        <span class="material-symbols-rounded icon">password</span>
        <h1>{{ t('Auth.ChangePassword.Title') }}</h1>

        @if (messageKey()) {
          <p class="message" [class.error]="hasError()">{{ t(messageKey()!) }}</p>
        }

        <label>
          <span>{{ t('Auth.ChangePassword.CurrentPassword.Label') }}</span>
          <input type="password" name="currentPassword" [(ngModel)]="currentPassword" required />
        </label>

        <label>
          <span>{{ t('Auth.ChangePassword.NewPassword.Label') }}</span>
          <input type="password" name="newPassword" [(ngModel)]="newPassword" required />
        </label>

        <button class="primary" type="submit" [disabled]="loading()">
          {{ t(loading() ? 'Common.Actions.Updating' : 'Auth.ChangePassword.Submit') }}
        </button>

        <a routerLink="/profile">{{ t('Common.Actions.Cancel') }}</a>
      </form>
    </main>
  `,
  styles: `
    .auth-center-page { min-height: 100vh; display: grid; place-items: center; padding: 32px; background: var(--ac-bg); }
    .auth-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px; background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 16px; padding: 36px; box-shadow: var(--ac-sh-lg); text-align: center; }
    .icon { color: var(--ac-primary); font-size: 42px; }
    h1 { margin: 0; font-size: 22px; color: var(--ac-text); }
    label { display: flex; flex-direction: column; gap: 6px; text-align: left; color: var(--ac-text-2); font-size: 13px; font-weight: 600; }
    input { height: 42px; border: 1px solid var(--ac-border); border-radius: 10px; padding: 0 12px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
    input:focus { outline: none; border-color: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    .primary { height: 44px; border: 0; border-radius: 10px; background: var(--ac-primary); color: #fff; font-weight: 700; cursor: pointer; }
    .primary:disabled { opacity: .7; cursor: not-allowed; }
    .message { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--ac-success-light); color: var(--ac-success); font-size: 13px; }
    .message.error { background: var(--ac-error-light); color: var(--ac-error); }
    a { color: var(--ac-primary); font-weight: 600; text-decoration: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePasswordPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected currentPassword = '';
  protected newPassword = '';
  protected readonly loading = signal(false);
  protected readonly hasError = signal(false);
  protected readonly messageKey = signal<string | null>(null);

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  protected async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.messageKey.set(null);
    this.hasError.set(false);

    try {
      const response = await this.authService.changePassword({
        currentPassword: this.currentPassword,
        newPassword: this.newPassword
      });

      if (!response.success) {
        this.hasError.set(true);
        this.messageKey.set(response.message);
        return;
      }

      this.authStore.clearSession();
      this.messageKey.set(response.message);
      await this.router.navigateByUrl('/auth/login');
    } catch {
      this.hasError.set(true);
      this.messageKey.set('Auth.Errors.CurrentPasswordInvalid');
    } finally {
      this.loading.set(false);
    }
  }
}
