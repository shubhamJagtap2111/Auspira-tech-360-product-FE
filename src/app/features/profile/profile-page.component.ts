import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthenticationSession, AuthResponse, CurrentUserProfile } from '../../core/auth/auth.models';
import { getUserRoleLabel, isPlatformUser as isPlatformSession } from '../../core/auth/user-access';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AdministrationDashboard } from '../dashboard/administration-dashboard.models';
import { AdministrationDashboardService } from '../dashboard/administration-dashboard.service';

type ProfileTab = 'personal' | 'security' | 'preferences' | 'notifications' | 'sessions';

interface ProfileSessionItem {
  id: string;
  icon: string;
  device: string;
  location: string;
  browser: string;
  time: string;
}

interface ProfileFormModel {
  firstName: string;
  lastName: string;
  mobileNo: string;
}

@Component({
  standalone: true,
  imports: [FormsModule, AcDropdownComponent],
  template: `
    <div class="profile-page">

      <!-- Page Header -->
      <div class="page-header">
        <div>
          <p class="ac-eyebrow">Account</p>
          <h1 class="ac-page-title">My Profile</h1>
          <p class="page-sub">Manage your account settings and preferences.</p>
        </div>
      </div>

      <!-- Profile Hero -->
      <div class="ac-card profile-hero">
        <div class="hero-left">
          <div class="avatar-upload">
            <div class="big-avatar">{{ userInitials() }}</div>
            <button class="upload-btn" title="Upload photo">
              <span class="material-symbols-rounded" style="font-size:16px">photo_camera</span>
            </button>
          </div>
          <div class="hero-info">
            <h2 class="hero-name">{{ displayName() }}</h2>
            <p class="hero-role">{{ roleLabel() }} - {{ organizationLabel() }}</p>
            <div class="hero-badges">
              <span class="ac-badge ac-badge-primary">{{ roleLabel() }}</span>
              <span class="ac-badge" [class.ac-badge-success]="isAccountActive()" [class.ac-badge-secondary]="!isAccountActive()">{{ isAccountActive() ? 'Active' : 'Inactive' }}</span>
              <span class="ac-badge ac-badge-secondary">{{ displayEmail() }}</span>
            </div>
          </div>
        </div>
        <div class="hero-stats">
          @for (s of heroStats(); track s.label) {
            <div class="hero-stat">
              <strong>{{ s.value }}</strong>
              <span>{{ s.label }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Tabs -->
      <div class="profile-layout">
        <nav class="profile-tabs">
          @for (tab of tabs; track tab.id) {
            <button class="tab-btn" [class.active]="activeTab() === tab.id"
                    (click)="activeTab.set(tab.id)">
              <span class="material-symbols-rounded tab-icon" [class.msf]="activeTab() === tab.id">{{ tab.icon }}</span>
              <span>{{ tab.label }}</span>
            </button>
          }
        </nav>

        <div class="tab-content">

          <!-- ── Personal Info ── -->
          @if (activeTab() === 'personal') {
            <div class="content-card ac-card">
              <div class="section-head profile-edit-head">
                <div>
                  <h3 class="ac-section-title">Personal Information</h3>
                  <p class="section-sub">{{ editingProfile() ? 'Update the details used on your Care360 account.' : 'Personal details from your account record.' }}</p>
                </div>
                @if (!editingProfile()) {
                  <button type="button" class="ac-btn ac-btn-secondary" (click)="startEditProfile()">
                    <span class="material-symbols-rounded" style="font-size:16px">edit</span>
                    Edit details
                  </button>
                }
              </div>
              <form class="profile-form" (ngSubmit)="saveProfile()">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">First Name</label>
                    <input class="ac-input" type="text" name="firstName" [(ngModel)]="profileForm.firstName" [readonly]="!editingProfile()" placeholder="Enter first name" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Last Name</label>
                    <input class="ac-input" type="text" name="lastName" [(ngModel)]="profileForm.lastName" [readonly]="!editingProfile()" placeholder="Enter last name" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input class="ac-input" type="email" [value]="displayEmail()" readonly />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Phone Number</label>
                    <input class="ac-input" type="tel" name="mobileNo" [(ngModel)]="profileForm.mobileNo" [readonly]="!editingProfile()" placeholder="Add phone number" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Role</label>
                    <input class="ac-input" type="text" [value]="roleLabel()" readonly />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Department</label>
                    <input class="ac-input" type="text" [value]="assignmentValue(profile()?.departmentNameKey ?? profile()?.departmentCode, 'Department not assigned')" readonly />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Branch</label>
                    <input class="ac-input" type="text" [value]="assignmentValue(profile()?.branchNameKey ?? profile()?.branchCode, 'Branch not assigned')" readonly />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Account Created</label>
                    <input class="ac-input" type="text" [value]="formatDate(profile()?.createdDate)" readonly />
                  </div>
                </div>
                @if (editingProfile()) {
                  <div class="form-actions">
                    <button type="button" class="ac-btn ac-btn-secondary" (click)="cancelEditProfile()" [disabled]="savingProfile()">Cancel</button>
                    <button type="submit" class="ac-btn ac-btn-primary" [disabled]="savingProfile()">
                      <span class="material-symbols-rounded" style="font-size:16px">{{ savingProfile() ? 'progress_activity' : 'save' }}</span>
                      {{ savingProfile() ? 'Saving...' : 'Save changes' }}
                    </button>
                  </div>
                }
              </form>
            </div>
          }

          <!-- ── Security ── -->
          @if (activeTab() === 'security') {
            <div class="content-card ac-card">
              <div class="section-head">
                <h3 class="ac-section-title">Security Settings</h3>
                <p class="section-sub">Manage your password and two-factor authentication.</p>
              </div>
              <div class="security-sections">
                <div class="security-block">
                  <div class="security-block-head">
                    <div>
                      <h4 class="security-title">Change Password</h4>
                      <p class="security-desc">{{ passwordChangedLabel() }}</p>
                    </div>
                  </div>
                  <form class="profile-form">
                    <div class="form-group">
                      <label class="form-label">Current Password</label>
                      <input class="ac-input" type="password" placeholder="••••••••" />
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input class="ac-input" type="password" placeholder="Min 8 chars" />
                      </div>
                      <div class="form-group">
                        <label class="form-label">Confirm Password</label>
                        <input class="ac-input" type="password" placeholder="Repeat password" />
                      </div>
                    </div>
                    <div class="form-actions">
                      <button type="submit" class="ac-btn ac-btn-primary">Update Password</button>
                    </div>
                  </form>
                </div>
                <hr class="ac-divider" />
                <div class="security-block">
                  <div class="security-block-head">
                    <div>
                      <h4 class="security-title">Two-Factor Authentication</h4>
                      <p class="security-desc">Add an extra layer of security to your account.</p>
                    </div>
                    <button class="ac-btn ac-btn-secondary" style="flex-shrink:0">Enable 2FA</button>
                  </div>
                  <div class="twofa-methods">
                    @for (m of twoFaMethods; track m.label) {
                      <div class="twofa-method">
                        <div class="twofa-icon" [style.background]="m.bg">
                          <span class="material-symbols-rounded" style="font-size:18px" [style.color]="m.color">{{ m.icon }}</span>
                        </div>
                        <div class="twofa-info">
                          <p class="twofa-title">{{ m.label }}</p>
                          <p class="twofa-desc">{{ m.desc }}</p>
                        </div>
                        <span class="twofa-status" [class.enabled]="m.enabled">{{ m.enabled ? 'Enabled' : 'Disabled' }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- ── Preferences ── -->
          @if (activeTab() === 'preferences') {
            <div class="content-card ac-card">
              <div class="section-head">
                <h3 class="ac-section-title">Preferences</h3>
                <p class="section-sub">Customize your Care360 experience.</p>
              </div>
              <div class="prefs-list">
                @for (pref of preferences; track pref.label) {
                  <div class="pref-item">
                    <div class="pref-icon" [style.background]="pref.bg">
                      <span class="material-symbols-rounded" style="font-size:18px" [style.color]="pref.color">{{ pref.icon }}</span>
                    </div>
                    <div class="pref-info">
                      <p class="pref-title">{{ pref.label }}</p>
                      <p class="pref-desc">{{ pref.desc }}</p>
                    </div>
                    <div class="toggle" [class.on]="pref.enabled" (click)="pref.enabled = !pref.enabled">
                      <div class="toggle-knob"></div>
                    </div>
                  </div>
                }
              </div>
              <hr class="ac-divider" />
              <div class="form-row" style="margin-top:16px">
                <div class="form-group">
                  <label class="form-label">Language</label>
                  <ac-dropdown name="profileLanguage" [(ngModel)]="profileLanguage" [options]="languageOptions" />
                </div>
                <div class="form-group">
                  <label class="form-label">Timezone</label>
                  <ac-dropdown name="profileTimezone" [(ngModel)]="profileTimezone" [options]="timeZoneOptions" />
                </div>
              </div>
            </div>
          }

          <!-- ── Notifications ── -->
          @if (activeTab() === 'notifications') {
            <div class="content-card ac-card">
              <div class="section-head">
                <h3 class="ac-section-title">Notification Settings</h3>
                <p class="section-sub">Choose what notifications you want to receive.</p>
              </div>
              @for (group of notifGroups; track group.label) {
                <div class="notif-group">
                  <h4 class="notif-group-label">{{ group.label }}</h4>
                  @for (item of group.items; track item.label) {
                    <div class="notif-item">
                      <div class="notif-info">
                        <p class="notif-title">{{ item.label }}</p>
                        <p class="notif-desc">{{ item.desc }}</p>
                      </div>
                      <div class="notif-channels">
                        <label class="channel-check">
                          <input type="checkbox" [checked]="item.email" /> Email
                        </label>
                        <label class="channel-check">
                          <input type="checkbox" [checked]="item.push" /> Push
                        </label>
                        <label class="channel-check">
                          <input type="checkbox" [checked]="item.sms" /> SMS
                        </label>
                      </div>
                    </div>
                  }
                </div>
                <hr class="ac-divider" />
              }
            </div>
          }

          <!-- ── Sessions ── -->
          @if (activeTab() === 'sessions') {
            <div class="content-card ac-card">
              <div class="section-head">
                <h3 class="ac-section-title">Active Sessions</h3>
                <p class="section-sub">These devices are currently logged in to your account.</p>
              </div>
              <div class="sessions-list">
                @for (s of sessions(); track s.id) {
                  <div class="session-item">
                    <div class="session-icon">
                      <span class="material-symbols-rounded" style="font-size:22px;color:var(--ac-muted)">{{ s.icon }}</span>
                    </div>
                    <div class="session-info">
                      <div class="session-top">
                        <p class="session-device">{{ s.device }}</p>
                      </div>
                      <p class="session-meta">{{ s.location }} · {{ s.browser }} · {{ s.time }}</p>
                    </div>
                  </div>
                } @empty {
                  <p class="empty-state">No active sessions available for this account.</p>
                }
              </div>
            </div>
          }

        </div>
      </div>
    </div>
  `,
  styles: `
    .profile-page {
      display: flex; flex-direction: column; gap: 24px;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; }
    .page-sub { font-size: 13.5px; color: var(--ac-muted); margin-top: 4px; }

    /* Hero */
    .profile-hero {
      display: flex; align-items: center; justify-content: space-between;
      gap: 24px; padding: 24px; flex-wrap: wrap;
    }
    .hero-left { display: flex; align-items: center; gap: 20px; }
    .avatar-upload { position: relative; }
    .big-avatar {
      display: flex; align-items: center; justify-content: center;
      width: 72px; height: 72px; border-radius: 18px;
      background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary));
      color: #fff; font-size: 22px; font-weight: 800;
    }
    .upload-btn {
      position: absolute; bottom: -4px; right: -4px;
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--ac-primary); color: #fff;
      border: 2px solid var(--ac-surface); cursor: pointer;
      transition: all 150ms ease;
    }
    .upload-btn:hover { background: var(--ac-primary-hover); transform: scale(1.1); }
    .hero-name  { font-size: 18px; font-weight: 800; color: var(--ac-text); letter-spacing: -0.01em; }
    .hero-role  { font-size: 13px; color: var(--ac-muted); margin: 3px 0 10px; }
    .hero-role + .hero-role { display: none; }
    .hero-badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .hero-stats { display: flex; gap: 28px; flex-wrap: wrap; }
    .hero-stat { display: flex; flex-direction: column; align-items: center; }
    .hero-stat strong { font-size: 20px; font-weight: 800; color: var(--ac-text); }
    .hero-stat span   { font-size: 11.5px; color: var(--ac-muted); margin-top: 2px; }

    /* Layout */
    .profile-layout { display: grid; grid-template-columns: 220px 1fr; gap: 20px; align-items: start; }
    @media (max-width: 768px) { .profile-layout { grid-template-columns: 1fr; } }

    /* Tabs nav */
    .profile-tabs {
      display: flex; flex-direction: column; gap: 2px;
      background: var(--ac-surface); border: 1px solid var(--ac-border);
      border-radius: var(--ac-r); padding: 8px;
      box-shadow: var(--ac-sh-sm);
    }
    .tab-btn {
      display: flex; align-items: center; gap: 10px;
      height: 38px; padding: 0 12px;
      border-radius: var(--ac-r-sm); font-size: 13.5px;
      font-weight: 500; color: var(--ac-text-3);
      transition: all var(--ac-t); cursor: pointer; border: none; background: none;
      text-align: left;
    }
    .tab-btn:hover { background: var(--ac-surface-2); color: var(--ac-text); }
    .tab-btn.active {
      background: var(--ac-item-active-bg);
      color: var(--ac-item-active-text); font-weight: 600;
    }
    .tab-icon { font-size: 18px !important; color: var(--ac-muted); }
    .tab-btn.active .tab-icon { color: var(--ac-item-active-text); }

    /* Content */
    .content-card { padding: 24px; }
    .section-head { margin-bottom: 24px; }
    .profile-edit-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .section-sub { font-size: 13px; color: var(--ac-muted); margin-top: 3px; }

    /* Form */
    .profile-form { display: flex; flex-direction: column; gap: 16px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 640px) { .form-row { grid-template-columns: 1fr; } }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 600; color: var(--ac-text-2); }
    .bio-textarea { height: auto; padding-top: 10px; padding-bottom: 10px; resize: vertical; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 8px; }

    /* Security */
    .security-sections { display: flex; flex-direction: column; gap: 20px; }
    .security-block-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .security-title { font-size: 14px; font-weight: 700; color: var(--ac-text); }
    .security-desc  { font-size: 12.5px; color: var(--ac-muted); margin-top: 2px; }
    .twofa-methods  { display: flex; flex-direction: column; gap: 12px; }
    .twofa-method { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); }
    .twofa-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--ac-r-sm); flex-shrink: 0; }
    .twofa-info { flex: 1; }
    .twofa-title { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .twofa-desc  { font-size: 12px; color: var(--ac-muted); }
    .twofa-status { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: var(--ac-r-full); background: var(--ac-surface-2); color: var(--ac-muted); }
    .twofa-status.enabled { background: var(--ac-success-light); color: var(--ac-success); }

    /* Preferences toggle */
    .prefs-list { display: flex; flex-direction: column; gap: 2px; }
    .pref-item { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--ac-border); }
    .pref-item:last-child { border-bottom: none; }
    .pref-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--ac-r-sm); flex-shrink: 0; }
    .pref-info { flex: 1; }
    .pref-title { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .pref-desc  { font-size: 12px; color: var(--ac-muted); margin-top: 1px; }
    .toggle {
      width: 42px; height: 24px; border-radius: var(--ac-r-full);
      background: var(--ac-surface-3); position: relative; cursor: pointer;
      transition: background 0.25s; flex-shrink: 0;
    }
    .toggle.on { background: var(--ac-primary); }
    .toggle-knob {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; transition: transform 0.25s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    .toggle.on .toggle-knob { transform: translateX(18px); }

    /* Notifications */
    .notif-group { margin-bottom: 8px; }
    .notif-group-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ac-muted); margin-bottom: 10px; padding: 0 0 4px; border-bottom: 1px solid var(--ac-border); }
    .notif-item { display: flex; align-items: center; gap: 16px; padding: 10px 0; }
    .notif-info { flex: 1; }
    .notif-title { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .notif-desc  { font-size: 12px; color: var(--ac-muted); margin-top: 1px; }
    .notif-channels { display: flex; gap: 16px; flex-shrink: 0; }
    .channel-check { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--ac-text-3); cursor: pointer; }

    /* Sessions */
    .sessions-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
    .session-item { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--ac-border); border-radius: var(--ac-r-sm); }
    .session-item.current { border-color: var(--ac-primary); background: var(--ac-primary-light); }
    .session-icon { flex-shrink: 0; }
    .session-info { flex: 1; min-width: 0; }
    .session-top { display: flex; align-items: center; gap: 8px; }
    .session-device { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .current-badge { padding: 2px 8px; border-radius: var(--ac-r-full); background: var(--ac-primary-light); color: var(--ac-primary); font-size: 10.5px; font-weight: 700; }
    .session-meta  { font-size: 12px; color: var(--ac-muted); margin-top: 2px; }
    .revoke-btn { padding: 5px 12px; border-radius: var(--ac-r-sm); background: transparent; border: 1px solid var(--ac-error-light); color: var(--ac-error); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 150ms; }
    .revoke-btn:hover { background: var(--ac-error-light); }
    .sessions-footer { display: flex; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePageComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(AdministrationDashboardService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  protected readonly activeTab = signal<ProfileTab>('personal');
  protected readonly profile = signal<CurrentUserProfile | null>(null);
  protected readonly dashboard = signal<AdministrationDashboard | null>(null);
  protected readonly sessions = signal<ProfileSessionItem[]>([]);
  protected readonly editingProfile = signal(false);
  protected readonly savingProfile = signal(false);
  protected profileForm: ProfileFormModel = { firstName: '', lastName: '', mobileNo: '' };
  protected readonly displayName = computed(() => {
    const profile = this.profile();
    const session = this.authStore.session();
    return profile?.fullName?.trim() || session?.fullName?.trim() || profile?.email || session?.email || 'User';
  });
  protected readonly displayEmail = computed(() => this.profile()?.email ?? this.authStore.session()?.email ?? '');
  protected readonly roleLabel = computed(() => getUserRoleLabel(this.profileSession()));
  protected readonly organizationLabel = computed(() => {
    const session = this.profileSession();
    const profile = this.profile();
    return isPlatformSession(session)
      ? 'Auspira Care360'
      : profile?.hospitalName?.trim() || formatTenantName(profile?.tenantCode || this.tenantContext.tenantCode());
  });
  protected readonly isAccountActive = computed(() => this.profile()?.isActive ?? true);
  protected readonly userInitials = computed(() => getInitials(this.displayName(), this.displayEmail()));
  protected readonly firstName = computed(() => this.nameParts()[0] ?? '');
  protected readonly lastName = computed(() => this.nameParts().slice(1).join(' '));
  private readonly nameParts = computed(() => this.displayName().split(/\s+/).filter(Boolean));
  protected profileLanguage = 'en-US';
  protected profileTimezone = 'Asia/Kolkata';
  protected readonly languageOptions = [
    { label: 'English (US)', value: 'en-US' },
    { label: 'Hindi', value: 'hi-IN' },
    { label: 'Marathi', value: 'mr-IN' }
  ];
  protected readonly timeZoneOptions = [
    { label: 'Asia/Kolkata (IST +5:30)', value: 'Asia/Kolkata' },
    { label: 'UTC', value: 'UTC' }
  ];

  protected readonly tabs: { id: ProfileTab; label: string; icon: string }[] = [
    { id: 'personal',      label: 'Personal Info',   icon: 'person' },
    { id: 'security',      label: 'Security',        icon: 'security' },
    { id: 'preferences',   label: 'Preferences',     icon: 'tune' },
    { id: 'notifications', label: 'Notifications',   icon: 'notifications' },
    { id: 'sessions',      label: 'Sessions',        icon: 'devices' }
  ];

  protected readonly heroStats = computed(() => [
    { value: formatMemberSince(this.profile()?.createdDate), label: 'Member since' },
    { value: formatNumber(this.actionsLogged()), label: 'Actions logged' },
    { value: formatNumber(this.assignedModuleCount()), label: 'Modules assigned' }
  ]);

  protected preferences = [
    { icon: 'dark_mode',     label: 'Dark Mode',            desc: 'Toggle between light and dark theme',     bg: 'rgba(37,99,235,0.08)',   color: '#2563EB', enabled: false },
    { icon: 'notifications', label: 'Desktop Notifications', desc: 'Show browser notifications',             bg: 'rgba(245,158,11,0.08)',  color: '#F59E0B', enabled: true  },
    { icon: 'mail',          label: 'Email Digest',          desc: 'Daily summary of key activities',         bg: 'rgba(16,185,129,0.08)',  color: '#10B981', enabled: true  },
    { icon: 'language',      label: 'Auto-Detect Language',  desc: 'Use browser language preference',         bg: 'rgba(124,58,237,0.08)', color: '#7C3AED', enabled: false }
  ];

  protected readonly twoFaMethods = [
    { icon: 'smartphone',  label: 'Authenticator App',  desc: 'Google Authenticator or Authy',      bg: 'rgba(37,99,235,0.08)',  color: '#2563EB', enabled: false },
    { icon: 'sms',         label: 'SMS / Text Message', desc: 'One-time code via text message',      bg: 'rgba(16,185,129,0.08)', color: '#10B981', enabled: false },
    { icon: 'mail',        label: 'Email OTP',          desc: 'One-time code via email',             bg: 'rgba(245,158,11,0.08)', color: '#F59E0B', enabled: false }
  ];

  protected readonly notifGroups = [
    {
      label: 'Clinical',
      items: [
        { label: 'New Patient Registered',    desc: 'When a new patient is added to the system', email: true,  push: true,  sms: false },
        { label: 'Appointment Reminders',     desc: 'Upcoming appointment notifications',         email: true,  push: true,  sms: true  },
        { label: 'Lab Results Ready',         desc: 'When lab reports are completed',             email: false, push: true,  sms: false }
      ]
    },
    {
      label: 'Operations',
      items: [
        { label: 'Low Pharmacy Stock',        desc: 'When medicines reach reorder level',         email: true,  push: true,  sms: true  },
        { label: 'Invoice Generated',         desc: 'When billing invoices are created',          email: true,  push: false, sms: false }
      ]
    }
  ];

  async ngOnInit(): Promise<void> {
    await Promise.allSettled([this.loadProfile(), this.loadDashboard(), this.loadSessions()]);
  }

  protected assignmentValue(value: string | null | undefined, fallback: string): string {
    return value?.trim() ? humanizeValue(value) : fallback;
  }

  protected formatDate(value: string | null | undefined): string {
    return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Sync pending';
  }

  protected passwordChangedLabel(): string {
    const value = this.profile()?.passwordChangedDate;
    return value ? `Last changed ${formatRelativeDate(value)}` : 'Password change date not available';
  }

  protected startEditProfile(): void {
    this.syncProfileForm();
    this.editingProfile.set(true);
  }

  protected cancelEditProfile(): void {
    this.syncProfileForm();
    this.editingProfile.set(false);
  }

  protected async saveProfile(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.savingProfile()) {
      return;
    }

    const fullName = `${this.profileForm.firstName} ${this.profileForm.lastName}`.replace(/\s+/g, ' ').trim();
    if (!fullName) {
      return;
    }

    this.savingProfile.set(true);
    try {
      const response = await this.authService.updateCurrentUser({
        fullName,
        mobileNo: this.profileForm.mobileNo.trim() || null,
        languageCode: this.profileLanguage || profile.languageCode,
        timeZoneCode: this.profileTimezone || profile.timeZoneCode,
        rowVersion: profile.rowVersion
      });

      if (!response.success || !response.data) {
        this.toast.error(response.message);
        return;
      }

      this.profile.set(response.data);
      this.syncProfileForm();
      this.refreshStoredSession(response.data);
      this.editingProfile.set(false);
      this.toast.success('Profile details updated');
    } finally {
      this.savingProfile.set(false);
    }
  }

  private async loadProfile(): Promise<void> {
    const profile = await this.authService.getCurrentUser();
    this.profile.set(profile);
    this.profileLanguage = profile.languageCode || this.profileLanguage;
    this.profileTimezone = profile.timeZoneCode || this.profileTimezone;
    this.syncProfileForm();
  }

  private async loadDashboard(): Promise<void> {
    const response = await this.dashboardService.getDashboard().catch(() => null);
    if (response?.success && response.data) {
      this.dashboard.set(response.data);
    }
  }

  private async loadSessions(): Promise<void> {
    const response = await this.authService.getSessions().catch(() => null);
    this.sessions.set(response?.success && response.data ? response.data.map(mapSession) : []);
  }

  private profileSession(): AuthResponse | null {
    const session = this.authStore.session();
    const profile = this.profile();
    return profile && session
      ? {
          ...session,
          email: profile.email,
          fullName: profile.fullName,
          permissions: profile.permissions.length > 0 ? profile.permissions : session.permissions,
          roleCodes: profile.roleCodes.length > 0 ? profile.roleCodes : session.roleCodes
        }
      : session;
  }

  private syncProfileForm(): void {
    const parts = this.displayName().split(/\s+/).filter(Boolean);
    this.profileForm = {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      mobileNo: this.profile()?.mobileNo ?? ''
    };
  }

  private refreshStoredSession(profile: CurrentUserProfile): void {
    const session = this.authStore.session();
    if (!session) {
      return;
    }

    this.authStore.setSession({
      ...session,
      fullName: profile.fullName,
      email: profile.email,
      permissions: profile.permissions.length > 0 ? profile.permissions : session.permissions,
      roleCodes: profile.roleCodes.length > 0 ? profile.roleCodes : session.roleCodes
    });
  }

  private actionsLogged(): number {
    return this.dashboard()?.auditSummary.reduce((total, item) => total + item.eventCount, 0) ?? 0;
  }

  private assignedModuleCount(): number {
    const menuCount = this.authStore.session()?.menuItems?.length ?? 0;
    if (menuCount > 0) {
      return menuCount;
    }

    return new Set(this.authStore.permissions().map(permission => permission.split('.')[0]).filter(Boolean)).size;
  }
}

function getInitials(displayName: string, email: string): string {
  const source = displayName && displayName !== 'User' ? displayName : email;
  const initials = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'U';
}

function mapSession(session: AuthenticationSession): ProfileSessionItem {
  const browser = detectBrowser(session.userAgent);
  return {
    id: session.sessionId,
    icon: detectDeviceIcon(session.userAgent),
    device: session.machineName?.trim() || browser || 'Active device',
    location: session.ipAddress?.trim() || 'Location not captured',
    browser: browser || 'Browser not captured',
    time: formatRelativeDate(session.lastUsedDate ?? session.createdDate)
  };
}

function formatMemberSince(value: string | null | undefined): string {
  if (!value) {
    return 'New';
  }

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return 'New';
  }

  const days = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000));
  if (days < 1) {
    return 'Today';
  }
  if (days < 31) {
    return `${days}d`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}m`;
  }

  return `${(days / 365).toFixed(1)}y`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date not available';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function humanizeValue(value: string): string {
  return value
    .replace(/^Navigation\./, '')
    .replace(/^TimeZone\./, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function detectBrowser(userAgent: string | null): string {
  const value = userAgent ?? '';
  if (value.includes('Edg/')) {
    return 'Microsoft Edge';
  }
  if (value.includes('Chrome/')) {
    return 'Chrome';
  }
  if (value.includes('Firefox/')) {
    return 'Firefox';
  }
  if (value.includes('Safari/')) {
    return 'Safari';
  }
  return '';
}

function detectDeviceIcon(userAgent: string | null): string {
  const value = userAgent?.toLowerCase() ?? '';
  if (value.includes('iphone') || value.includes('android')) {
    return 'phone_iphone';
  }
  if (value.includes('ipad') || value.includes('tablet')) {
    return 'tablet';
  }
  return 'computer';
}

function formatTenantName(tenantCode: string): string {
  if (!tenantCode || tenantCode === 'master') {
    return 'Hospital';
  }

  return tenantCode
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
