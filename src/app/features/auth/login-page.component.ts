import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { AppLoaderService } from '../../shared/ui/app-loader/app-loader.service';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <main class="login-shell">
      <section class="welcome-panel" aria-labelledby="welcome-title">
        <div class="brand-lockup">
          <img src="assets/brand/auspira-logo.webp" alt="Auspira Technologies" width="168" height="48" />
          <span class="product-name">Care360 <span>Hospital management</span></span>
        </div>
        <div class="welcome-content">
          <p class="eyebrow"><span></span> Connected care. Simplified.</p>
          <h1 id="welcome-title">More time for care.<br /><span>Less time on paperwork.</span></h1>
          <p class="welcome-copy">A calmer way to manage your hospital. Bring patients, clinical teams, and everyday operations into one workspace.</p>
          <div class="care-preview" aria-label="Connected hospital workflow">
            <div class="preview-heading"><span class="preview-icon material-symbols-rounded" aria-hidden="true">local_hospital</span><div><strong>Your hospital, connected</strong><span>From the first visit to follow-up care</span></div><span class="material-symbols-rounded preview-spark" aria-hidden="true">hub</span></div>
            <div class="care-journey">
              <div><span class="journey-icon material-symbols-rounded" aria-hidden="true">how_to_reg</span><strong>Check in</strong><small>Patient & appointment</small></div>
              <span class="journey-arrow material-symbols-rounded" aria-hidden="true">arrow_forward</span>
              <div><span class="journey-icon purple material-symbols-rounded" aria-hidden="true">stethoscope</span><strong>Consult</strong><small>Assessment & treatment</small></div>
              <span class="journey-arrow material-symbols-rounded" aria-hidden="true">arrow_forward</span>
              <div><span class="journey-icon teal material-symbols-rounded" aria-hidden="true">assignment_turned_in</span><strong>Coordinate</strong><small>Reports & follow-up</small></div>
            </div>
            <div class="preview-footer"><span class="material-symbols-rounded" aria-hidden="true">account_tree</span> One organisation. Every branch. Connected.</div>
          </div>
          <div class="capability-list" aria-label="Platform capabilities"><span><span class="material-symbols-rounded" aria-hidden="true">groups</span>Patients & OPD</span><span><span class="material-symbols-rounded" aria-hidden="true">medication</span>Pharmacy & labs</span><span><span class="material-symbols-rounded" aria-hidden="true">payments</span>Billing & operations</span></div>
        </div>
        <p class="welcome-note"><span class="material-symbols-rounded" aria-hidden="true">favorite</span> Designed around the people who deliver care.</p>
      </section>

      <section class="signin-panel" aria-labelledby="signin-title">
        <form class="signin-card" (ngSubmit)="onLogin()" [attr.aria-busy]="loading()">
          <header class="signin-heading">
            <span class="signin-symbol material-symbols-rounded" aria-hidden="true">login</span>
            <p class="form-eyebrow">YOUR HOSPITAL WORKSPACE</p>
            <h2 id="signin-title">Welcome back</h2>
            <p>Sign in to Auspira Care360 to start your day.</p>
          </header>
          @if (errorKey()) {
            <p class="login-error" id="login-error" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span>{{ t(errorKey()!) }}</p>
          }
          <div class="login-fields">
            <label class="login-field" for="login-email">{{ t('Auth.Login.Email.Label') }}</label>
            <div class="input-wrap">
              <span class="material-symbols-rounded" aria-hidden="true">mail</span>
              <input id="login-email" type="email" name="email" [(ngModel)]="email" [placeholder]="t('Auth.Login.Email.Placeholder')" autocomplete="username" inputmode="email" autocapitalize="none" [spellcheck]="false" [attr.aria-describedby]="errorKey() ? 'login-error' : null" [disabled]="loading()" required />
            </div>
            <label class="login-field password-label" for="login-password">{{ t('Auth.Login.Password.Label') }}</label>
            <div class="input-wrap">
              <span class="material-symbols-rounded" aria-hidden="true">lock</span>
              <input id="login-password" [type]="showPassword() ? 'text' : 'password'" name="password" [(ngModel)]="password" [placeholder]="t('Auth.Login.Password.Placeholder')" autocomplete="current-password" [attr.aria-describedby]="errorKey() ? 'login-error' : null" [disabled]="loading()" required />
              <button type="button" class="password-toggle" (click)="togglePasswordVisibility()" [attr.aria-label]="t(showPassword() ? 'Auth.Login.HidePassword' : 'Auth.Login.ShowPassword')" [attr.aria-pressed]="showPassword()">
                <span class="material-symbols-rounded" aria-hidden="true">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>
          <div class="signin-options">
            <label class="remember"><input type="checkbox" name="rememberMe" [(ngModel)]="rememberMe" [disabled]="loading()" /><span>{{ t('Auth.Login.RememberMe.Label') }}</span></label>
            <a routerLink="/auth/forgot-password">{{ t('Auth.ForgotPassword.Link') }}</a>
          </div>
          <button class="signin-button" type="submit" [disabled]="loading()">
            @if (loading()) { <span class="login-spinner" aria-hidden="true"></span> }
            {{ t(loading() ? 'Auth.Login.SigningIn' : 'Auth.Login.Submit') }}
            @if (!loading()) { <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span> }
          </button>
          <div class="signin-divider"><span>or</span></div>
          <button class="google-signin" type="button" (click)="onGoogleLogin()" [disabled]="loading()"><span class="google-letter" aria-hidden="true">G</span>Continue with Google</button>
          <p class="access-help"><span class="material-symbols-rounded" aria-hidden="true">help_outline</span>Need access? Contact your hospital administrator.</p>
          <footer class="signin-footer">
            <div><a href="https://auspiratech.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a><span aria-hidden="true">·</span><a href="https://auspiratech.com/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</a></div>
            <small>© {{ currentYear }} Auspira Technologies</small>
          </footer>
        </form>
      </section>
    </main>
  `,
  styles: `
    :host { display: block; }
    *, *::before, *::after { box-sizing: border-box; }
    .login-shell { min-height: 100dvh; display: grid; grid-template-columns: minmax(0,1.12fr) minmax(0,1fr); padding: 24px; gap: 24px; background: var(--ac-bg); color: var(--ac-text); }
    .welcome-panel { position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 40px; padding: clamp(32px,4vw,64px); border-radius: 28px; overflow: hidden; background: radial-gradient(ellipse at 100% 100%,#7048d8 0%,transparent 58%),radial-gradient(ellipse at 0% 0%,#234fb5 0%,transparent 66%),#172d65; color: #fff; }
    .welcome-panel::after { content: ''; pointer-events: none; position: absolute; width: 520px; height: 520px; right: -320px; top: -280px; border: 1px solid #ffffff18; border-radius: 50%; box-shadow: 0 0 0 70px #ffffff05,0 0 0 140px #ffffff04; }
    .brand-lockup { position: relative; z-index: 1; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
    .brand-lockup img { width: 168px; height: auto; background: white; border-radius: 10px; padding: 9px 10px; }
    .product-name { font-size: 20px; font-weight: 650; letter-spacing: -.4px; }
    .product-name span { display: block; font-size: 11px; color: #d0dbf4; font-weight: 400; letter-spacing: .15px; margin-top: 3px; }
    .welcome-content { position: relative; z-index: 1; width: 100%; max-width: 600px; margin-block: auto; }
    .eyebrow { display: flex; align-items: center; gap: 8px; margin: 0 0 18px; font-size: 12px; font-weight: 500; letter-spacing: .3px; color: #d9e3ff; }
    .eyebrow > span { width: 7px; height: 7px; border-radius: 50%; background: #a6bfff; box-shadow: 0 0 0 4px #b9cfff14; }
    h1 { font-size: clamp(32px,3.5vw,52px); letter-spacing: -1.7px; font-weight: 650; line-height: 1.12; margin: 0 0 20px; text-wrap: balance; }
    h1 > span { color: #cfdbff; }
    .welcome-copy { margin: 0; max-width: 46ch; color: #d4dff6; font-size: 15px; line-height: 1.75; }
    .care-preview { margin-top: 32px; padding: 22px; border: 1px solid #ffffff30; background: #ffffff0f; border-radius: 20px; box-shadow: 0 16px 44px #0f164e18; }
    .preview-heading { display: flex; align-items: center; gap: 12px; }
    .preview-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; color: #fff; background: #ffffff16; font-size: 23px; }
    .preview-heading strong { display: block; font-weight: 600; font-size: 14px; }
    .preview-heading div > span { display: block; color: #cbd8f5; font-size: 11px; margin-top: 4px; line-height: 1.5; }
    .preview-spark { margin-left: auto; color: #b4c9ff; font-size: 26px; }
    .care-journey { display: grid; grid-template-columns: minmax(0,1fr) 16px minmax(0,1fr) 16px minmax(0,1fr); gap: 5px; align-items: center; margin-top: 24px; }
    .care-journey > div { display: flex; align-items: center; flex-direction: column; text-align: center; gap: 7px; min-width: 0; }
    .journey-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 13px; background: #e9efff; color: #2554bd; font-size: 23px; }
    .journey-icon.purple { background: #efe8ff; color: #7241c6; }
    .journey-icon.teal { background: #dcf5ef; color: #147868; }
    .care-journey strong { font-size: 12px; font-weight: 600; }
    .care-journey small { font-size: 10px; color: #d0daf2; line-height: 1.5; }
    .journey-arrow { font-size: 16px; color: #b4c6f0; margin-top: -30px; }
    .preview-footer { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 22px; padding-top: 16px; border-top: 1px solid #ffffff1c; font-size: 11px; color: #dbe4ff; line-height: 1.5; text-align: center; }
    .preview-footer .material-symbols-rounded { font-size: 16px; }
    .capability-list { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 22px; }
    .capability-list > span { display: flex; align-items: center; gap: 6px; color: #dee6ff; font-size: 11px; }
    .capability-list .material-symbols-rounded { font-size: 16px; color: #b6caff; }
    .welcome-note { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; margin: 0; color: #d1ddf7; font-size: 11px; line-height: 1.5; }
    .welcome-note .material-symbols-rounded { font-size: 15px; }
    .signin-panel { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 24px; }
    .signin-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; padding: 0; }
    .signin-heading { margin-bottom: 30px; }
    .signin-symbol { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: var(--ac-secondary-light); color: var(--ac-secondary); border: 1px solid var(--ac-border); font-size: 25px; margin-bottom: 22px; }
    .form-eyebrow { font-size: 10px; color: var(--ac-secondary); letter-spacing: 1.2px; font-weight: 650; margin: 0 0 10px; }
    h2 { margin: 0; font-size: 32px; line-height: 1.25; font-weight: 650; letter-spacing: -.8px; }
    .signin-heading > p:last-child { margin: 10px 0 0; color: var(--ac-muted); font-size: 14px; line-height: 1.6; }
    .login-fields { display: flex; flex-direction: column; }
    .login-field { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .password-label { margin-top: 20px; }
    .input-wrap { display: flex; align-items: center; min-height: 52px; border: 1px solid var(--ac-border-2); border-radius: 10px; background: var(--ac-surface); transition: border-color .15s,box-shadow .15s; }
    .input-wrap:focus-within { border-color: #6366df; box-shadow: 0 0 0 2px #6366df15; }
    .input-wrap > .material-symbols-rounded { flex: 0 0 44px; text-align: center; color: var(--ac-muted); font-size: 19px; }
    .input-wrap input { width: 100%; min-width: 0; height: 50px; border: 0; outline: 0; box-shadow: none; background: transparent; color: var(--ac-text); font-family: inherit; font-size: 16px; font-weight: 400; padding: 0 12px 0 0; }
    .input-wrap input::placeholder { color: var(--ac-muted-2); font-size: 14px; }
    :host-context(.dark) .input-wrap input { border: 0 !important; background: transparent !important; }
    .password-toggle { display: grid; place-items: center; flex: 0 0 44px; height: 44px; margin-right: 3px; border-radius: 8px; border: 0; background: transparent; color: var(--ac-muted); cursor: pointer; }
    .password-toggle:hover { background: var(--ac-surface-2); }
    .password-toggle .material-symbols-rounded { font-size: 20px; }
    .signin-options { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-block: 12px 18px; font-size: 12px; }
    .remember { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; color: var(--ac-text-3); }
    .remember input { width: 17px; height: 17px; margin: 0; accent-color: #6142d5; }
    a { color: var(--ac-primary); text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .signin-options a { display: flex; align-items: center; min-height: 44px; }
    .signin-button,.google-signin { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 52px; border-radius: 10px; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: box-shadow .15s,background .15s; }
    .signin-button { border: 0; color: #fff; background: linear-gradient(105deg,#345dd9,#7040d5); box-shadow: 0 6px 18px #5e45ce24; }
    .signin-button:hover:not(:disabled) { box-shadow: 0 8px 22px #5e45ce38; background: linear-gradient(105deg,#2b50c1,#6135bd); }
    .signin-button .material-symbols-rounded { font-size: 19px; }
    button:disabled { opacity: .65; cursor: wait; }
    button:focus-visible,a:focus-visible,.remember input:focus-visible { outline: 2px solid var(--ac-secondary); outline-offset: 3px; }
    .signin-divider { display: flex; align-items: center; gap: 14px; margin: 22px 0; color: var(--ac-muted-2); font-size: 12px; }
    .signin-divider::before,.signin-divider::after { content: ''; flex: 1; height: 1px; background: var(--ac-border); }
    .google-signin { border: 1px solid var(--ac-border-2); background: var(--ac-surface); color: var(--ac-text-2); }
    .google-signin:hover:not(:disabled) { background: var(--ac-surface-2); }
    .google-letter { font: 700 21px Arial,sans-serif; background: conic-gradient(#4285f4 0deg 90deg,#34a853 90deg 180deg,#fbbc05 180deg 225deg,#ea4335 225deg 280deg,#4285f4 280deg); background-clip: text; color: transparent; }
    .access-help { display: flex; justify-content: center; align-items: center; gap: 7px; text-align: center; color: var(--ac-muted); font-size: 11px; line-height: 1.6; margin: 22px 0 0; }
    .access-help .material-symbols-rounded { font-size: 16px; flex: 0 0 16px; }
    .signin-footer { margin-top: 30px; padding-top: 22px; border-top: 1px solid var(--ac-border); display: grid; gap: 10px; text-align: center; }
    .signin-footer > div { display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 11px; }
    .signin-footer a { color: var(--ac-muted); padding: 6px 0; }
    .signin-footer span { color: var(--ac-muted-2); }
    .signin-footer small { color: var(--ac-muted-2); font-size: 10px; }
    .login-error { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 20px; padding: 12px; border: 1px solid var(--ac-error); border-radius: 10px; background: var(--ac-error-light); color: var(--ac-error-text); font-size: 13px; line-height: 1.6; }
    .login-error .material-symbols-rounded { font-size: 19px; flex: 0 0 19px; margin-top: 1px; }
    .login-spinner { width: 18px; height: 18px; border: 2px solid #ffffff55; border-top-color: white; border-radius: 50%; animation: loginSpin .8s linear infinite; }
    @keyframes loginSpin { to { transform: rotate(360deg); } }
    @media (min-width: 1600px) { .login-shell { padding: 40px; gap: 40px; } .welcome-content { max-width: 640px; } h1 { font-size: 58px; } .signin-card { max-width: 440px; } }
    @media (min-width: 961px) and (max-height: 800px) { .welcome-panel { gap: 24px; padding: 32px; } h1 { font-size: 38px; } .care-preview { margin-top: 24px; padding: 18px; } .signin-heading { margin-bottom: 24px; } .signin-symbol { margin-bottom: 16px; } .signin-footer { margin-top: 22px; padding-top: 16px; } }
    @media (max-width: 1100px) and (min-width: 961px) { .login-shell { padding: 16px; gap: 8px; } .welcome-panel { padding: 28px; } .signin-panel { padding: 24px; } h1 { font-size: 36px; } .capability-list { gap: 12px; } }
    @media (max-width: 960px) { .login-shell { grid-template-columns: minmax(0,1fr); padding: 20px; gap: 0; } .welcome-panel { padding: 28px 32px; gap: 24px; border-radius: 24px; } .brand-lockup img { width: 140px; } .product-name { font-size: 18px; } .welcome-content { max-width: none; } .eyebrow { margin-bottom: 12px; } h1 { font-size: 34px; letter-spacing: -1px; margin-bottom: 0; } .welcome-copy,.care-preview,.welcome-note { display: none; } .capability-list { margin-top: 18px; } .signin-panel { padding: 36px 24px 24px; } .signin-symbol { display: none; } .signin-card { max-width: 440px; } .signin-heading { margin-bottom: 26px; } }
    @media (max-width: 520px) { .login-shell { padding: 0; background: var(--ac-surface); } .welcome-panel { padding: 24px; border-radius: 0 0 24px 24px; gap: 24px; } .brand-lockup { gap: 14px; } .brand-lockup img { width: 132px; } .product-name { font-size: 17px; } .product-name span { font-size: 10px; } h1 { font-size: 28px; letter-spacing: -.8px; line-height: 1.18; } .eyebrow { font-size: 11px; } .capability-list { gap: 10px 16px; margin-top: 16px; } .capability-list > span { font-size: 10px; } .capability-list > span:last-child { display: none; } .signin-panel { padding: 30px 24px 24px; } h2 { font-size: 28px; } .signin-heading > p:last-child { font-size: 13px; } .signin-footer { margin-top: 24px; } }
    @media (max-width: 360px) { .welcome-panel { padding: 22px 18px; } .signin-panel { padding: 28px 18px 22px; } h1 { font-size: 26px; } .brand-lockup { gap: 12px; } .product-name span { max-width: 110px; } .signin-options { font-size: 11px; gap: 8px; } }
    @media (prefers-reduced-motion: reduce) { *,*::before,*::after { transition: none !important; animation: none !important; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly appLoader = inject(AppLoaderService);

  protected readonly currentYear = new Date().getFullYear();

  protected email = '';
  protected password = '';
  protected rememberMe = false;
  protected readonly loading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected t(key: string): string {
    return this.i18n.translate(key);
  }

  ngOnInit(): void {
    void this.authService.warmUpApi();
  }

  protected async onLogin(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorKey.set(null);
    this.appLoader.showImmediate();

    try {
      const response = await this.authService.login({
        email: this.email,
        password: this.password,
        rememberMe: this.rememberMe
      });
      if (!response.success || !response.data) {
        this.errorKey.set(response.message);
        return;
      }

      this.authStore.setSession(response.data);
      await this.i18n.loadCatalog();

      const returnUrl = this.router.parseUrl(location.pathname + location.search).queryParams['returnUrl'];
      await this.router.navigateByUrl(typeof returnUrl === 'string' && returnUrl.startsWith('/prescription-access#') ? returnUrl : '/');
    } catch {
      this.errorKey.set('Auth.Errors.InvalidCredentials');
    } finally {
      this.loading.set(false);
      this.appLoader.hide();
    }
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  protected onGoogleLogin(): void {
    this.authService.startGoogleLogin(this.rememberMe);
  }
}
