import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { getUserRoleLabel } from '../../core/auth/user-access';
import { I18nService } from '../../core/i18n/i18n.service';
import { Language } from '../../core/i18n/i18n.models';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

type ProfileActionMode = 'account' | 'security' | 'activity' | 'password';

interface ActivityEntry {
  id: string;
  action: string;
  area: string;
  timestamp: string;
  status: 'Success' | 'Info' | 'Warning';
}

const accountStorageKey = 'care360.profile.accountSettings';
const securityStorageKey = 'care360.profile.securitySettings';
const activityStorageKey = 'care360.profile.activityLogs';

const fallbackLanguages: Language[] = [
  { cultureCode: 'en-US', englishName: 'English', nativeName: 'English', isDefault: true, direction: 'LeftToRight' },
  { cultureCode: 'hi-IN', englishName: 'Hindi', nativeName: 'Hindi', isDefault: false, direction: 'LeftToRight' },
  { cultureCode: 'mr-IN', englishName: 'Marathi', nativeName: 'Marathi', isDefault: false, direction: 'LeftToRight' }
];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="profile-action">
      <div class="page-head">
        <div>
          <p class="ac-eyebrow">Account</p>
          <h1 class="ac-page-title">{{ title() }}</h1>
          <p class="page-sub">{{ subtitle() }}</p>
        </div>
        <a class="ac-btn ac-btn-secondary" routerLink="/profile">
          <span class="material-symbols-rounded">arrow_back</span>
          My Profile
        </a>
      </div>

      @if (mode() === 'account') {
        <section class="ac-card action-card">
          <div class="section-head">
            <span class="material-symbols-rounded">settings</span>
            <div>
              <h2>Account Settings</h2>
              <p>These preferences are saved for this browser session.</p>
            </div>
          </div>
          <form class="grid-form" (ngSubmit)="saveAccountSettings()">
            <label>
              <span>Display name</span>
              <input class="ac-input" name="displayName" [(ngModel)]="account.displayName" />
            </label>
            <label>
              <span>Email address</span>
              <input class="ac-input" name="email" type="email" [(ngModel)]="account.email" />
            </label>
            <label>
              <span>Language</span>
              <select class="ac-input" name="language" [(ngModel)]="account.language" (change)="changeLanguage(account.language)">
                @for (language of languages(); track language.cultureCode) {
                  <option [value]="language.cultureCode">{{ language.englishName }} - {{ language.nativeName }}</option>
                }
              </select>
            </label>
            <label>
              <span>Time zone</span>
              <select class="ac-input" name="timeZone" [(ngModel)]="account.timeZone">
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
              </select>
            </label>
            <label class="check-row">
              <input type="checkbox" name="emailDigest" [(ngModel)]="account.emailDigest" />
              <span>Email daily digest</span>
            </label>
            <label class="check-row">
              <input type="checkbox" name="compactMode" [(ngModel)]="account.compactMode" />
              <span>Compact workspace density</span>
            </label>
            <div class="form-actions">
              <button type="button" class="ac-btn ac-btn-secondary" (click)="resetAccountSettings()">Reset</button>
              <button type="submit" class="ac-btn ac-btn-primary">
                <span class="material-symbols-rounded">save</span>
                Save Settings
              </button>
            </div>
          </form>
        </section>
      }

      @if (mode() === 'security') {
        <section class="ac-card action-card">
          <div class="section-head">
            <span class="material-symbols-rounded">security</span>
            <div>
              <h2>Security Settings</h2>
              <p>Manage login alerts and additional protection.</p>
            </div>
          </div>
          <div class="settings-list">
            <label class="setting-row">
              <span>
                <strong>Login alerts</strong>
                <small>Send an email when a new device signs in.</small>
              </span>
              <input type="checkbox" [(ngModel)]="security.loginAlerts" />
            </label>
            <label class="setting-row">
              <span>
                <strong>Require verified email</strong>
                <small>Block sensitive changes until email verification is complete.</small>
              </span>
              <input type="checkbox" [(ngModel)]="security.requireVerifiedEmail" />
            </label>
            <label class="setting-row">
              <span>
                <strong>Two-step verification</strong>
                <small>Prepare the account for OTP verification when backend support is enabled.</small>
              </span>
              <input type="checkbox" [(ngModel)]="security.twoStep" />
            </label>
          </div>
          <div class="form-actions">
            <button class="ac-btn ac-btn-primary" (click)="saveSecuritySettings()">
              <span class="material-symbols-rounded">save</span>
              Save Security
            </button>
          </div>
        </section>
      }

      @if (mode() === 'activity') {
        <section class="ac-card action-card">
          <div class="section-head row-head">
            <div class="head-title">
              <span class="material-symbols-rounded">history</span>
              <div>
                <h2>Activity Logs</h2>
                <p>Review account activity captured in this browser.</p>
              </div>
            </div>
            <div class="head-actions">
              <button class="ac-btn ac-btn-secondary" (click)="addActivity()">
                <span class="material-symbols-rounded">add</span>
                Add Entry
              </button>
              <button class="ac-btn ac-btn-secondary danger" (click)="clearActivity()">
                <span class="material-symbols-rounded">delete</span>
                Clear
              </button>
            </div>
          </div>
          <div class="filter-row">
            <input class="ac-input" placeholder="Search activity..." [(ngModel)]="activityQuery" />
          </div>
          <div class="activity-list">
            @for (entry of filteredActivity(); track entry.id) {
              <article class="activity-item">
                <span class="status-dot" [class.warn]="entry.status === 'Warning'" [class.info]="entry.status === 'Info'"></span>
                <div>
                  <strong>{{ entry.action }}</strong>
                  <p>{{ entry.area }} - {{ entry.timestamp }}</p>
                </div>
                <span class="status-pill">{{ entry.status }}</span>
              </article>
            } @empty {
              <p class="empty-state">No activity found.</p>
            }
          </div>
        </section>
      }

      @if (mode() === 'password') {
        <section class="ac-card action-card narrow">
          <div class="section-head">
            <span class="material-symbols-rounded">lock_reset</span>
            <div>
              <h2>Change Password</h2>
              <p>Update the password for {{ email() }}.</p>
            </div>
          </div>
          <form class="stack-form" (ngSubmit)="changePassword()">
            <label>
              <span>Current password</span>
              <input class="ac-input" name="currentPassword" type="password" [(ngModel)]="password.currentPassword" required />
            </label>
            <label>
              <span>New password</span>
              <input class="ac-input" name="newPassword" type="password" [(ngModel)]="password.newPassword" required minlength="8" />
            </label>
            <label>
              <span>Confirm new password</span>
              <input class="ac-input" name="confirmPassword" type="password" [(ngModel)]="password.confirmPassword" required />
            </label>
            <button class="ac-btn ac-btn-primary" type="submit" [disabled]="savingPassword()">
              <span class="material-symbols-rounded">save</span>
              {{ savingPassword() ? 'Updating...' : 'Update Password' }}
            </button>
          </form>
        </section>
      }
    </div>
  `,
  styles: `
    .profile-action { display: flex; flex-direction: column; gap: 20px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .page-sub { font-size: 13.5px; color: var(--ac-muted); margin-top: 4px; }
    .action-card { padding: 22px; max-width: 980px; }
    .action-card.narrow { max-width: 560px; }
    .section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .section-head > .material-symbols-rounded,
    .head-title > .material-symbols-rounded { color: var(--ac-primary); }
    .section-head h2 { font-size: 18px; font-weight: 800; color: var(--ac-text); }
    .section-head p { font-size: 12.5px; color: var(--ac-muted); margin-top: 2px; }
    .row-head { justify-content: space-between; align-items: center; }
    .head-title { display: flex; align-items: center; gap: 12px; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .grid-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .grid-form label,
    .stack-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ac-text-2); }
    .stack-form { display: grid; gap: 16px; }
    .check-row { flex-direction: row !important; align-items: center; gap: 10px !important; min-height: 42px; }
    .form-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
    .settings-list { display: grid; gap: 10px; }
    .setting-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 14px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); }
    .setting-row span { display: grid; gap: 3px; }
    .setting-row strong { font-size: 13.5px; color: var(--ac-text); }
    .setting-row small { font-size: 12px; color: var(--ac-muted); }
    .filter-row { margin-bottom: 12px; }
    .activity-list { display: grid; gap: 10px; }
    .activity-item { display: flex; align-items: center; gap: 12px; padding: 13px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); }
    .activity-item div { flex: 1; min-width: 0; }
    .activity-item strong { font-size: 13.5px; color: var(--ac-text); }
    .activity-item p { font-size: 12px; color: var(--ac-muted); margin-top: 2px; }
    .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--ac-success); box-shadow: 0 0 0 3px rgba(16,185,129,0.14); }
    .status-dot.warn { background: var(--ac-warning); box-shadow: 0 0 0 3px rgba(245,158,11,0.14); }
    .status-dot.info { background: var(--ac-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.14); }
    .status-pill { font-size: 11px; font-weight: 700; color: var(--ac-muted); border: 1px solid var(--ac-border); border-radius: var(--ac-r-full); padding: 4px 8px; }
    .empty-state { padding: 22px; text-align: center; color: var(--ac-muted); border: 1px dashed var(--ac-border); border-radius: var(--ac-r-sm); }
    .danger { color: var(--ac-error); }
    @media (max-width: 760px) {
      .page-head, .row-head { flex-direction: column; }
      .grid-form { grid-template-columns: 1fr; }
      .form-actions { justify-content: flex-start; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileActionPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly tenant = inject(TenantContextService);

  protected readonly mode = computed(() => this.route.snapshot.data['mode'] as ProfileActionMode);
  protected readonly email = computed(() => this.authStore.session()?.email ?? '');
  protected readonly languages = computed(() => this.i18n.languages().length ? this.i18n.languages() : fallbackLanguages);
  protected readonly savingPassword = signal(false);
  protected activityQuery = '';

  protected account = readJson(accountStorageKey, {
    displayName: this.authStore.session()?.fullName ?? '',
    email: this.authStore.session()?.email ?? '',
    language: this.tenant.cultureCode(),
    timeZone: 'Asia/Kolkata',
    emailDigest: true,
    compactMode: false
  });

  protected security = readJson(securityStorageKey, {
    loginAlerts: true,
    requireVerifiedEmail: true,
    twoStep: false
  });

  protected password = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  private readonly activity = signal<ActivityEntry[]>(readJson<ActivityEntry[]>(activityStorageKey, [
    {
      id: crypto.randomUUID(),
      action: 'Signed in',
      area: this.roleLabel(),
      timestamp: new Date().toLocaleString(),
      status: 'Success'
    }
  ]));

  protected readonly filteredActivity = computed(() => {
    const query = this.activityQuery.trim().toLowerCase();
    if (!query) {
      return this.activity();
    }
    return this.activity().filter(entry =>
      `${entry.action} ${entry.area} ${entry.status}`.toLowerCase().includes(query)
    );
  });

  protected readonly title = computed(() => {
    const titles: Record<ProfileActionMode, string> = {
      account: 'Account Settings',
      security: 'Security Settings',
      activity: 'Activity Logs',
      password: 'Change Password'
    };
    return titles[this.mode()];
  });

  protected readonly subtitle = computed(() => {
    const subtitles: Record<ProfileActionMode, string> = {
      account: 'Manage account preferences and localization.',
      security: 'Control security preferences for this account.',
      activity: 'View and manage account activity.',
      password: 'Change your account password securely.'
    };
    return subtitles[this.mode()];
  });

  protected saveAccountSettings(): void {
    window.localStorage.setItem(accountStorageKey, JSON.stringify(this.account));
    this.addActivityEntry('Updated account settings', 'Profile');
    this.toast.success('Account settings saved');
  }

  protected resetAccountSettings(): void {
    window.localStorage.removeItem(accountStorageKey);
    this.account = {
      displayName: this.authStore.session()?.fullName ?? '',
      email: this.authStore.session()?.email ?? '',
      language: this.tenant.cultureCode(),
      timeZone: 'Asia/Kolkata',
      emailDigest: true,
      compactMode: false
    };
    this.toast.info('Account settings reset');
  }

  protected async changeLanguage(cultureCode: string): Promise<void> {
    await this.i18n.loadCatalog(cultureCode);
    this.account.language = cultureCode;
  }

  protected saveSecuritySettings(): void {
    window.localStorage.setItem(securityStorageKey, JSON.stringify(this.security));
    this.addActivityEntry('Updated security settings', 'Security');
    this.toast.success('Security settings saved');
  }

  protected addActivity(): void {
    this.addActivityEntry('Manual activity note', 'Activity Logs', 'Info');
    this.toast.success('Activity entry created');
  }

  protected clearActivity(): void {
    this.activity.set([]);
    window.localStorage.setItem(activityStorageKey, JSON.stringify([]));
    this.toast.info('Activity logs cleared');
  }

  protected async changePassword(): Promise<void> {
    if (this.password.newPassword !== this.password.confirmPassword) {
      this.toast.error('Password mismatch', 'New password and confirm password must match.');
      return;
    }

    this.savingPassword.set(true);
    try {
      await this.authService.changePassword({
        currentPassword: this.password.currentPassword,
        newPassword: this.password.newPassword
      });
      this.addActivityEntry('Changed password', 'Security');
      this.toast.success('Password changed', 'Please sign in again with the new password.');
      this.authStore.clearSession();
      await this.router.navigateByUrl('/auth/login');
    } catch {
      this.toast.error('Password not changed', 'Please check the current password and try again.');
    } finally {
      this.savingPassword.set(false);
    }
  }

  private addActivityEntry(action: string, area: string, status: ActivityEntry['status'] = 'Success'): void {
    const entry: ActivityEntry = {
      id: crypto.randomUUID(),
      action,
      area,
      timestamp: new Date().toLocaleString(),
      status
    };
    this.activity.update(entries => [entry, ...entries]);
    window.localStorage.setItem(activityStorageKey, JSON.stringify(this.activity()));
  }

  private roleLabel(): string {
    return getUserRoleLabel(this.authStore.session());
  }
}

function readJson<T>(key: string, fallback: T): T {
  const value = window.localStorage.getItem(key);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}
