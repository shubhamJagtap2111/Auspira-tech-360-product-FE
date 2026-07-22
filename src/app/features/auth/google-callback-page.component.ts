import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthResponse } from '../../core/auth/auth.models';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="callback-page">
      <section class="callback-card">
        <div class="brand-mark">
          <span class="material-symbols-rounded" style="font-size:28px;color:#fff">favorite</span>
        </div>

        @if (errorMessage()) {
          <h1>Google sign-in failed</h1>
          <p>{{ errorMessage() }}</p>
          <a routerLink="/auth/login">Back to sign in</a>
        } @else {
          <h1>Signing you in</h1>
          <p>Completing Google authentication.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .callback-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--ac-bg); }
    .callback-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 16px; padding: 34px; box-shadow: var(--ac-sh-lg); }
    .brand-mark { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 14px; background: var(--ac-primary); }
    h1 { margin: 0; font-size: 22px; color: var(--ac-text); }
    p { margin: 0; color: var(--ac-muted); line-height: 1.5; }
    a { color: var(--ac-primary); font-weight: 700; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GoogleCallbackPageComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const success = params.get('success') === 'true';
    const message = params.get('message') ?? 'Auth.Google.AuthenticationFailed';
    const tenantCode = params.get('tenantCode');
    const payload = params.get('payload');

    if (!success || !payload) {
      this.errorMessage.set(message);
      return;
    }

    try {
      const session = JSON.parse(atob(payload)) as AuthResponse;
      if (tenantCode) {
        this.tenantContext.setTenantCode(tenantCode);
      }

      this.authStore.setSession(session);
      await this.router.navigateByUrl('/');
    } catch {
      this.errorMessage.set('Could not read Google authentication response.');
    }
  }
}
