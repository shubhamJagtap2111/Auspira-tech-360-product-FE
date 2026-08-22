import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmDialogComponent } from '../../shared/ui/dialog/confirm-dialog.component';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { getUserRoleLabel, isHospitalAdminUser as isHospitalAdminSession } from '../../core/auth/user-access';
import { Language } from '../../core/i18n/i18n.models';
import { AppLoaderComponent } from '../../shared/ui/app-loader/app-loader.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  requiredPermission?: string;
  hospitalAdminOnly?: boolean;
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  requiredPermissionPrefix?: string;
  items: NavItem[];
}

interface AiChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

const fallbackLanguages: Language[] = [
  { cultureCode: 'en-US', englishName: 'English', nativeName: 'English', isDefault: true, direction: 'LeftToRight' },
  { cultureCode: 'hi-IN', englishName: 'Hindi', nativeName: 'Hindi', isDefault: false, direction: 'LeftToRight' },
  { cultureCode: 'mr-IN', englishName: 'Marathi', nativeName: 'Marathi', isDefault: false, direction: 'LeftToRight' }
];

@Component({
  selector: 'ac-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FormsModule, ConfirmDialogComponent, AppLoaderComponent],
  template: `
    @if (isAuthPage()) {
      <router-outlet />
    } @else if (isAuthenticated()) {
      <div class="shell" [class.collapsed]="sidebarCollapsed()">

        <!-- ════════ SIDEBAR ════════ -->
        <aside class="sidebar">

          <!-- Brand -->
          <div class="brand">
            <div class="brand-logo">
              <span class="material-symbols-rounded msf" style="font-size:22px;color:#fff">favorite</span>
            </div>
            @if (!sidebarCollapsed()) {
              <div class="brand-text">
                <strong>Care360</strong>
                <span>Healthcare ERP</span>
              </div>
            }
          </div>

          <!-- Navigation -->
          <nav class="nav">
            @for (group of filteredNavGroups(); track group.label) {
              <div class="nav-group">
                @if (!sidebarCollapsed()) {
                  <p class="nav-group-label">{{ group.label }}</p>
                }
                @for (item of group.items; track item.path + item.label) {
                  @if (item.children?.length) {
                    <a class="nav-item nav-parent"
                       [routerLink]="item.path"
                       routerLinkActive="active"
                       [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                       [title]="sidebarCollapsed() ? item.label : ''">
                      <span class="material-symbols-rounded nav-icon">{{ item.icon }}</span>
                      @if (!sidebarCollapsed()) {
                        <span class="nav-label">{{ item.label }}</span>
                      }
                    </a>
                    @if (!sidebarCollapsed()) {
                      <div class="nav-children">
                        @for (child of item.children; track child.path + child.label) {
                          <a class="nav-child"
                             [routerLink]="child.path"
                             routerLinkActive="active"
                             [routerLinkActiveOptions]="{ exact: child.path === '/' }">
                            <span>{{ child.label }}</span>
                          </a>
                        }
                      </div>
                    }
                  } @else {
                    <a class="nav-item"
                       [routerLink]="item.path"
                       routerLinkActive="active"
                       [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                       [title]="sidebarCollapsed() ? item.label : ''">
                      <span class="material-symbols-rounded nav-icon">{{ item.icon }}</span>
                      @if (!sidebarCollapsed()) {
                        <span class="nav-label">{{ item.label }}</span>
                      }
                    </a>
                  }
                }
              </div>
            }
          </nav>

          <!-- Sidebar Footer -->
          <div class="sidebar-footer">
            <a class="nav-item" [title]="sidebarCollapsed() ? 'Support' : ''">
              <span class="material-symbols-rounded nav-icon">support_agent</span>
              @if (!sidebarCollapsed()) { <span class="nav-label">Support</span> }
            </a>
            <a class="nav-item" [title]="sidebarCollapsed() ? 'Documentation' : ''">
              <span class="material-symbols-rounded nav-icon">menu_book</span>
              @if (!sidebarCollapsed()) { <span class="nav-label">Documentation</span> }
            </a>
          </div>

          <!-- Toggle -->
          <button class="sidebar-toggle" (click)="toggleSidebar()"
                  [title]="sidebarCollapsed() ? 'Expand' : 'Collapse'">
            <span class="material-symbols-rounded">
              {{ sidebarCollapsed() ? 'chevron_right' : 'chevron_left' }}
            </span>
          </button>
        </aside>

        <!-- ════════ MAIN AREA ════════ -->
        <div class="shell-main">

          <!-- ── HEADER ── -->
          <header class="header">

            <!-- Search -->
            <div class="header-left">
              <button class="search-btn" (click)="commandOpen.set(true)">
                <span class="material-symbols-rounded" style="font-size:18px;color:var(--ac-muted)">search</span>
                <span class="search-placeholder">Search anything...</span>
                <kbd class="search-kbd">⌘K</kbd>
              </button>
            </div>

            <!-- Tenant / Branch -->
            <div class="header-center">
              <div class="tenant-chip">
                <span class="tenant-dot"></span>
                <span class="tenant-name">{{ hospitalHeaderLabel() }}</span>
              </div>
              <button class="branch-btn">
                <span class="material-symbols-rounded" style="font-size:16px">account_tree</span>
                <span>{{ branchHeaderLabel() }}</span>
                <span class="material-symbols-rounded" style="font-size:16px">expand_more</span>
              </button>
            </div>

            <!-- Actions -->
            <div class="header-right">
              <button class="hdr-btn notif-btn" (click)="toggleNotifications()" title="Notifications">
                <span class="material-symbols-rounded">notifications</span>
                <span class="notif-dot">3</span>
              </button>
              <button class="hdr-btn" title="Messages">
                <span class="material-symbols-rounded">chat_bubble</span>
              </button>
              <button class="hdr-btn" (click)="toggleDark()" [title]="dark() ? 'Light mode' : 'Dark mode'">
                <span class="material-symbols-rounded">{{ dark() ? 'light_mode' : 'dark_mode' }}</span>
              </button>
              <button class="hdr-btn lang-btn" title="Language" (click)="toggleLanguageMenu()">
                <span class="material-symbols-rounded">language</span>
                <span class="lang-code">{{ activeLang() }}</span>
              </button>
              <div class="hdr-sep"></div>
              <button class="profile-btn" (click)="toggleProfileMenu()">
                <div class="avatar">
                  <span>{{ userInitials() }}</span>
                </div>
                <div class="profile-meta">
                  <span class="profile-name">{{ displayName() }}</span>
                  <span class="profile-role">{{ roleLabel() }}</span>
                </div>
                <span class="material-symbols-rounded" style="font-size:18px;color:var(--ac-muted)">expand_more</span>
              </button>
            </div>
          </header>

          <!-- Notifications Panel -->
          @if (notifOpen()) {
            <div class="notif-panel">
              <div class="np-head">
                <span class="np-title">Notifications</span>
                <button class="np-markall">Mark all as read</button>
              </div>
              @for (n of notifications; track n.id) {
                <div class="np-item" [class.unread]="n.unread">
                  <div class="np-icon" [style.background]="n.bg" [style.color]="n.color">
                    <span class="material-symbols-rounded msf" style="font-size:18px">{{ n.icon }}</span>
                  </div>
                  <div class="np-body">
                    <p class="np-label">{{ n.title }}</p>
                    <p class="np-time">{{ n.time }}</p>
                  </div>
                  @if (n.unread) { <span class="np-dot"></span> }
                </div>
              }
              <div class="np-footer">
                <a routerLink="/">View all notifications →</a>
              </div>
            </div>
          }

          <!-- Language Dropdown -->
          @if (langOpen()) {
            <div class="lang-drop">
              <div class="lang-head">
                <span class="material-symbols-rounded">translate</span>
                <div>
                  <p class="lang-title">Language</p>
                  <p class="lang-sub">Choose display language</p>
                </div>
              </div>
              @for (language of availableLanguages(); track language.cultureCode) {
                <button class="lang-item"
                        [class.active]="language.cultureCode === activeCulture()"
                        (click)="selectLanguage(language.cultureCode)">
                  <span class="lang-current">
                    @if (language.cultureCode === activeCulture()) {
                      <span class="material-symbols-rounded">check</span>
                    }
                  </span>
                  <span class="lang-copy">
                    <strong>{{ language.englishName }}</strong>
                    <small>{{ language.nativeName }} - {{ language.cultureCode }}</small>
                  </span>
                </button>
              }
            </div>
          }

          <!-- Profile Dropdown -->
          @if (profileOpen()) {
            <div class="profile-drop">
              <div class="pd-user">
                <div class="pd-avatar">{{ userInitials() }}</div>
                <div class="pd-info">
                  <p class="pd-name">{{ displayName() }}</p>
                  <p class="pd-role">{{ roleLabel() }}</p>
                  <p class="pd-org">{{ organizationLabel() }}</p>
                </div>
              </div>
              <hr class="pd-sep" />
              @for (item of profileMenu; track item.label) {
                <a class="pd-item" [routerLink]="item.path" (click)="profileOpen.set(false)">
                  <span class="material-symbols-rounded pd-item-icon">{{ item.icon }}</span>
                  <span>{{ item.label }}</span>
                </a>
              }
              <hr class="pd-sep" />
              <button class="pd-item pd-logout" (click)="logout()">
                <span class="material-symbols-rounded pd-item-icon" style="color:var(--ac-error)">logout</span>
                <span style="color:var(--ac-error)">Sign Out</span>
              </button>
            </div>
          }

          <!-- Close dropdowns backdrop -->
          @if (notifOpen() || profileOpen() || langOpen()) {
            <div class="drop-backdrop" (click)="closeDropdowns()"></div>
          }

          <!-- Page Content -->
          <main class="main-content">
            <router-outlet />
          </main>
        </div>

        <!-- ════════ COMMAND PALETTE ════════ -->
        @if (commandOpen()) {
          <div class="cp-overlay" (click)="commandOpen.set(false)">
            <div class="cp-modal" (click)="$event.stopPropagation()">
              <div class="cp-search-row">
                <span class="material-symbols-rounded" style="color:var(--ac-muted);font-size:20px">search</span>
                <input class="cp-input" [(ngModel)]="cpQuery"
                       placeholder="Search pages, patients, actions..."
                       (keydown.escape)="commandOpen.set(false)"
                       autofocus />
                <kbd class="cp-esc">ESC</kbd>
              </div>
              <div class="cp-body">
                @if (!cpQuery) {
                  <div class="cp-section">
                    <p class="cp-section-label">Quick Navigation</p>
                    @for (item of allNavItems().slice(0,8); track item.path + item.label) {
                      <a class="cp-item" [routerLink]="item.path" (click)="commandOpen.set(false)">
                        <span class="material-symbols-rounded cp-item-icon">{{ item.icon }}</span>
                        <span>{{ item.label }}</span>
                        <span class="cp-tag">Page</span>
                      </a>
                    }
                  </div>
                } @else {
                  <div class="cp-section">
                    @for (item of filteredNav(); track item.path + item.label) {
                      <a class="cp-item" [routerLink]="item.path" (click)="commandOpen.set(false)">
                        <span class="material-symbols-rounded cp-item-icon">{{ item.icon }}</span>
                        <span>{{ item.label }}</span>
                      </a>
                    }
                    @if (filteredNav().length === 0) {
                      <p class="cp-empty">No results for "{{ cpQuery }}"</p>
                    }
                  </div>
                }
              </div>
              <div class="cp-footer">
                <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
                <span><kbd>↵</kbd> Open</span>
                <span><kbd>ESC</kbd> Close</span>
              </div>
            </div>
          </div>
        }

        <!-- ════════ AIRA ASSISTANT ════════ -->
        @if (aiAssistantOpen()) {
          <section class="ai-chat-panel" aria-label="AIRA assistant chat">
            <header class="ai-chat-head">
              <div class="ai-chat-title">
                <span class="ai-chat-icon">
                  <span class="material-symbols-rounded">auto_awesome</span>
                </span>
                <div>
                  <strong>AIRA</strong>
                  <span>Care360 Ask AI</span>
                </div>
              </div>
              <button class="ai-icon-btn" type="button" title="Close AIRA" (click)="aiAssistantOpen.set(false)">
                <span class="material-symbols-rounded">close</span>
              </button>
            </header>
            <div class="ai-chat-body">
              @for (message of aiMessages(); track message.role + message.text) {
                <div class="ai-message" [class.user]="message.role === 'user'">
                  <p>{{ message.text }}</p>
                </div>
              }
              <div class="ai-suggestions">
                @for (suggestion of aiSuggestions; track suggestion) {
                  <button type="button" (click)="askAiSuggestion(suggestion)">{{ suggestion }}</button>
                }
              </div>
            </div>
            <form class="ai-chat-input" (submit)="sendAiMessage($event)">
              <input name="aiPrompt" [(ngModel)]="aiPrompt" placeholder="Ask AIRA anything..." autocomplete="off" />
              <button type="submit" title="Send message">
                <span class="material-symbols-rounded">send</span>
              </button>
            </form>
          </section>
        }

        <button class="ai-bot-launcher" type="button" [class.chat-open]="aiAssistantOpen()" (click)="toggleAiAssistant()" aria-label="Open AIRA Ask AI">
          <span class="ai-minimize-dot">
            <span class="material-symbols-rounded">{{ aiAssistantOpen() ? 'remove' : 'add' }}</span>
          </span>
          <span class="ai-bot-art" aria-hidden="true">
            <span class="ai-bot-head">
              <span class="ai-bot-eye"></span>
              <span class="ai-bot-eye"></span>
            </span>
            <span class="ai-bot-body">
              <span class="material-symbols-rounded">bolt</span>
            </span>
            <span class="ai-bot-arm left"></span>
            <span class="ai-bot-arm right"></span>
            <span class="ai-bot-leg left"></span>
            <span class="ai-bot-leg right"></span>
          </span>
          <span class="ai-bot-label">
            <strong>AIRA</strong>
            <span>Ask AI</span>
          </span>
        </button>

        <!-- ════════ TOASTS ════════ -->
        <div class="ac-toast-stack">
          @for (t of toastSvc.toasts(); track t.id) {
            <div class="ac-toast" [class]="'ac-toast-' + t.type">
              <span class="material-symbols-rounded msf toast-icon" [style.color]="toastColor(t.type)">
                {{ toastIcon(t.type) }}
              </span>
              <div class="toast-body">
                <p class="toast-title">{{ t.title }}</p>
                @if (t.message) { <p class="toast-msg">{{ t.message }}</p> }
              </div>
              <button class="toast-close" (click)="toastSvc.dismiss(t.id)">
                <span class="material-symbols-rounded" style="font-size:18px">close</span>
              </button>
            </div>
          }
        </div>

      </div>
    } @else {
      <router-outlet />
    }
    <ac-confirm-dialog />
    <ac-app-loader />
  `,
  styles: `
    /* ── Shell Layout ── */
    :host { display: block; height: 100%; }

    .shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--ac-bg);
    }

    /* ── Sidebar ── */
    .sidebar {
      position: relative;
      display: flex;
      flex-direction: column;
      width: var(--ac-sidebar-w);
      min-width: var(--ac-sidebar-w);
      height: 100%;
      background: var(--ac-sidebar-bg);
      border-right: 1px solid var(--ac-border);
      overflow: hidden;
      transition: width var(--ac-t-slow), min-width var(--ac-t-slow);
      z-index: 50;
    }
    .shell.collapsed .sidebar {
      width: var(--ac-sidebar-w-sm);
      min-width: var(--ac-sidebar-w-sm);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid var(--ac-border);
      white-space: nowrap;
      overflow: hidden;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      min-width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary));
      box-shadow: 0 4px 12px rgba(37,99,235,0.35);
    }
    .brand-text strong {
      display: block;
      font-size: 15px;
      font-weight: 800;
      color: var(--ac-text);
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .brand-text span {
      font-size: 11px;
      color: var(--ac-muted);
      font-weight: 600;
    }

    /* Nav */
    .nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .nav-group { margin-bottom: 6px; }
    .nav-group-label {
      padding: 6px 8px 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ac-muted-2);
      white-space: nowrap;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 38px;
      padding: 0 10px;
      border-radius: var(--ac-r-sm);
      color: var(--ac-text-3);
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--ac-t);
      white-space: nowrap;
      overflow: hidden;
      text-decoration: none;
    }
    .nav-item:hover {
      background: var(--ac-item-active-bg);
      color: var(--ac-item-active-text);
    }
    .nav-item.active {
      background: var(--ac-item-active-bg);
      color: var(--ac-item-active-text);
      font-weight: 600;
    }
    .nav-item.active .nav-icon {
      color: var(--ac-item-active-text);
    }
    .nav-parent {
      margin-top: 2px;
      font-weight: 700;
    }
    .nav-children {
      display: grid;
      gap: 1px;
      margin: 1px 0 6px 28px;
      padding-left: 8px;
      border-left: 1px solid var(--ac-border);
    }
    .nav-child {
      min-height: 28px;
      display: flex;
      align-items: center;
      padding: 0 8px;
      border-radius: var(--ac-r-sm);
      color: var(--ac-muted);
      font-size: 12.5px;
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nav-child:hover,
    .nav-child.active {
      background: var(--ac-item-active-bg);
      color: var(--ac-item-active-text);
    }
    .nav-icon {
      font-size: 18px !important;
      min-width: 18px;
      color: var(--ac-muted);
      transition: color var(--ac-t);
    }
    .nav-label { transition: opacity var(--ac-t-slow); }

    /* Sidebar Footer */
    .sidebar-footer {
      padding: 8px 10px;
      border-top: 1px solid var(--ac-border);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Toggle Button */
    .sidebar-toggle {
      position: absolute;
      bottom: 100px;
      right: -12px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--ac-r-full);
      background: var(--ac-surface);
      border: 1px solid var(--ac-border);
      color: var(--ac-muted);
      box-shadow: var(--ac-sh-sm);
      transition: all var(--ac-t);
      cursor: pointer;
      z-index: 10;
    }
    .sidebar-toggle:hover {
      background: var(--ac-primary);
      border-color: var(--ac-primary);
      color: #fff;
    }
    .sidebar-toggle .material-symbols-rounded { font-size: 16px !important; }

    /* ── Shell Main ── */
    .shell-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      position: relative;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      height: var(--ac-header-h);
      min-height: var(--ac-header-h);
      padding: 0 20px;
      background: var(--ac-header-bg);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--ac-border);
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .header-left { flex: 1; min-width: 0; }
    .header-center {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    /* Search button */
    .search-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 38px;
      padding: 0 14px;
      max-width: 420px;
      background: var(--ac-surface-2);
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-sm);
      cursor: pointer;
      transition: all var(--ac-t);
    }
    .search-btn:hover {
      border-color: var(--ac-primary);
      background: var(--ac-surface);
      box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
    }
    .search-placeholder {
      flex: 1;
      font-size: 13px;
      color: var(--ac-muted);
      text-align: left;
    }
    .search-kbd {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 6px;
      border: 1px solid var(--ac-border);
      border-radius: 5px;
      font-size: 11px;
      font-family: inherit;
      color: var(--ac-muted);
      background: var(--ac-surface);
    }

    /* Tenant chip */
    .tenant-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-full);
      background: var(--ac-surface-2);
    }
    .tenant-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ac-success);
      box-shadow: 0 0 0 2px rgba(16,185,129,0.2);
    }
    .tenant-name { font-size: 13px; font-weight: 600; color: var(--ac-text-2); }

    .branch-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-full);
      background: var(--ac-surface);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--ac-text-3);
      transition: all var(--ac-t);
      cursor: pointer;
    }
    .branch-btn:hover { border-color: var(--ac-border-2); background: var(--ac-surface-2); }

    /* Header buttons */
    .hdr-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--ac-r-sm);
      color: var(--ac-muted);
      transition: all var(--ac-t);
      position: relative;
      cursor: pointer;
    }
    .hdr-btn:hover { background: var(--ac-surface-2); color: var(--ac-text); }
    .hdr-btn .material-symbols-rounded { font-size: 20px !important; }

    .notif-btn { position: relative; }
    .notif-dot {
      position: absolute;
      top: 4px;
      right: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: var(--ac-r-full);
      background: var(--ac-error);
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      border: 2px solid var(--ac-header-bg);
    }

    .lang-btn { width: auto; padding: 0 8px; gap: 4px; }
    .lang-code { font-size: 12px; font-weight: 700; }
    .hdr-sep { width: 1px; height: 24px; background: var(--ac-border); margin: 0 6px; }

    /* Profile button */
    .profile-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 38px;
      padding: 0 8px 0 4px;
      border-radius: var(--ac-r-sm);
      transition: background var(--ac-t);
      cursor: pointer;
    }
    .profile-btn:hover { background: var(--ac-surface-2); }
    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--ac-r-full);
      background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary));
      color: #fff;
      font-size: 11px;
      font-weight: 800;
    }
    .profile-meta { display: flex; flex-direction: column; }
    .profile-name { font-size: 13px; font-weight: 600; color: var(--ac-text); line-height: 1.2; }
    .profile-role { font-size: 11px; color: var(--ac-muted); }

    /* ── Notifications Panel ── */
    .notif-panel {
      position: absolute;
      top: calc(var(--ac-header-h) + 8px);
      right: 160px;
      width: 360px;
      background: var(--ac-surface);
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-lg);
      box-shadow: var(--ac-sh-xl);
      z-index: 200;
      animation: scaleIn 0.15s ease;
      overflow: hidden;
    }
    .np-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--ac-border);
    }
    .np-title { font-size: 14px; font-weight: 700; color: var(--ac-text); }
    .np-markall { font-size: 12px; color: var(--ac-primary); font-weight: 600; cursor: pointer; }
    .np-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--ac-border);
      transition: background var(--ac-t);
      cursor: pointer;
      position: relative;
    }
    .np-item:hover { background: var(--ac-surface-2); }
    .np-item.unread { background: var(--ac-primary-light); }
    .np-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--ac-r-sm);
      flex-shrink: 0;
    }
    .np-body { flex: 1; min-width: 0; }
    .np-label { font-size: 13px; font-weight: 500; color: var(--ac-text); line-height: 1.3; }
    .np-time { font-size: 11px; color: var(--ac-muted); margin-top: 2px; }
    .np-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ac-primary);
      flex-shrink: 0;
    }
    .np-footer {
      padding: 12px 16px;
      text-align: center;
    }
    .np-footer a { font-size: 13px; color: var(--ac-primary); font-weight: 600; }

    /* ── Profile Dropdown ── */
    .lang-drop {
      position: absolute;
      top: calc(var(--ac-header-h) + 8px);
      right: 170px;
      width: 280px;
      background: var(--ac-surface);
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-lg);
      box-shadow: var(--ac-sh-xl);
      z-index: 200;
      animation: scaleIn 0.15s ease;
      overflow: hidden;
    }
    .lang-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--ac-border);
    }
    .lang-head .material-symbols-rounded { color: var(--ac-primary); font-size: 20px !important; }
    .lang-title { font-size: 14px; font-weight: 800; color: var(--ac-text); }
    .lang-sub { font-size: 11.5px; color: var(--ac-muted); margin-top: 1px; }
    .lang-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 11px 14px;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      transition: background var(--ac-t);
    }
    .lang-item:hover,
    .lang-item.active { background: var(--ac-surface-2); }
    .lang-current {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      color: var(--ac-primary);
      flex-shrink: 0;
    }
    .lang-current .material-symbols-rounded { font-size: 18px !important; }
    .lang-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .lang-copy strong { font-size: 13px; color: var(--ac-text); }
    .lang-copy small { font-size: 11.5px; color: var(--ac-muted); }

    .profile-drop {
      position: absolute;
      top: calc(var(--ac-header-h) + 8px);
      right: 20px;
      width: 260px;
      background: var(--ac-surface);
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-lg);
      box-shadow: var(--ac-sh-xl);
      z-index: 200;
      animation: scaleIn 0.15s ease;
      overflow: hidden;
    }
    .pd-user {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
    }
    .pd-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--ac-r-full);
      background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary));
      color: #fff;
      font-size: 14px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .pd-info { min-width: 0; }
    .pd-name { font-size: 14px; font-weight: 700; color: var(--ac-text); }
    .pd-role { font-size: 12px; color: var(--ac-muted); margin-top: 1px; }
    .pd-org { font-size: 11px; color: var(--ac-muted); }
    .pd-sep { border: none; border-top: 1px solid var(--ac-border); margin: 4px 0; }
    .pd-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 16px;
      font-size: 13.5px;
      color: var(--ac-text-3);
      cursor: pointer;
      transition: background var(--ac-t);
      border: none;
      width: 100%;
      text-align: left;
      background: none;
    }
    .pd-item:hover { background: var(--ac-surface-2); }
    .pd-item-icon { font-size: 18px !important; color: var(--ac-muted); }
    .pd-logout { color: var(--ac-error); }

    /* Backdrop for dropdowns */
    .drop-backdrop {
      position: fixed;
      inset: 0;
      z-index: 199;
    }

    /* ── Main Content ── */
    .main-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 28px 32px;
    }

    /* ── Command Palette ── */
    .cp-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(6px);
      z-index: 9000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      animation: fadeIn 0.15s ease;
    }
    .cp-modal {
      width: min(560px, 95vw);
      background: var(--ac-surface);
      border: 1px solid var(--ac-border);
      border-radius: var(--ac-r-lg);
      box-shadow: var(--ac-sh-xl);
      overflow: hidden;
      animation: scaleIn 0.2s cubic-bezier(0.16,1,0.3,1);
    }
    .cp-search-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--ac-border);
    }
    .cp-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 15px;
      color: var(--ac-text);
    }
    .cp-input::placeholder { color: var(--ac-muted-2); }
    .cp-esc {
      padding: 3px 8px;
      border: 1px solid var(--ac-border);
      border-radius: 5px;
      font-size: 11px;
      color: var(--ac-muted);
      font-family: inherit;
      background: var(--ac-surface-2);
    }
    .cp-body { max-height: 360px; overflow-y: auto; }
    .cp-section { padding: 8px 8px 4px; }
    .cp-section-label {
      padding: 4px 8px 6px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ac-muted);
    }
    .cp-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: var(--ac-r-sm);
      color: var(--ac-text-3);
      font-size: 13.5px;
      transition: all var(--ac-t);
      cursor: pointer;
    }
    .cp-item:hover { background: var(--ac-item-active-bg); color: var(--ac-item-active-text); }
    .cp-item-icon { font-size: 18px !important; color: var(--ac-muted); }
    .cp-tag {
      margin-left: auto;
      padding: 2px 8px;
      border-radius: var(--ac-r-full);
      background: var(--ac-surface-2);
      font-size: 10.5px;
      color: var(--ac-muted);
    }
    .cp-empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--ac-muted);
      font-size: 14px;
    }
    .cp-footer {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      border-top: 1px solid var(--ac-border);
      background: var(--ac-surface-2);
    }
    .cp-footer span { font-size: 11.5px; color: var(--ac-muted); display: flex; align-items: center; gap: 4px; }
    .cp-footer kbd {
      display: inline-flex;
      align-items: center;
      padding: 1px 5px;
      border: 1px solid var(--ac-border);
      border-radius: 4px;
      font-size: 10px;
      font-family: inherit;
      background: var(--ac-surface);
      color: var(--ac-muted);
    }

    /* ── AIRA Assistant ── */
    .ai-bot-launcher {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 250;
      display: grid;
      place-items: center;
      width: 124px;
      min-height: 152px;
      border: none;
      background: transparent;
      cursor: pointer;
      isolation: isolate;
      filter: drop-shadow(0 18px 28px rgba(37,99,235,.22));
    }
    .ai-bot-launcher::before {
      content: '';
      position: absolute;
      inset: 14px 6px 8px;
      border-radius: 36px;
      background:
        radial-gradient(circle at 50% 20%, rgba(255,255,255,.95), rgba(239,246,255,.9) 48%, rgba(219,234,254,.6));
      box-shadow: inset 0 0 0 1px rgba(191,219,254,.75);
      z-index: -2;
    }
    .ai-bot-launcher:hover .ai-bot-art { transform: translateY(-3px); }
    .ai-bot-launcher.chat-open { filter: drop-shadow(0 20px 34px rgba(37,99,235,.28)); }
    .ai-minimize-dot {
      position: absolute;
      top: 18px;
      right: 2px;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: var(--ac-r-full);
      border: 1px solid rgba(191,219,254,.9);
      background: var(--ac-surface);
      color: var(--ac-primary);
      box-shadow: var(--ac-sh-md);
      z-index: 2;
    }
    .ai-minimize-dot .material-symbols-rounded { font-size: 20px !important; }
    .ai-bot-art {
      position: relative;
      display: block;
      width: 76px;
      height: 92px;
      margin-top: 12px;
      transition: transform var(--ac-t);
    }
    .ai-bot-head {
      position: absolute;
      top: 0;
      left: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      width: 54px;
      height: 38px;
      border-radius: 20px 20px 16px 16px;
      background: linear-gradient(145deg, #f8fafc, #b8c7d9 42%, #101827 44%, #0b1220);
      border: 2px solid rgba(255,255,255,.9);
      box-shadow: 0 8px 18px rgba(15,23,42,.22), inset 0 1px 5px rgba(255,255,255,.35);
      transform: translateX(-50%);
    }
    .ai-bot-head::before,
    .ai-bot-head::after {
      content: '';
      position: absolute;
      top: 13px;
      width: 9px;
      height: 9px;
      border-radius: var(--ac-r-full);
      background: #dbeafe;
      box-shadow: 0 0 10px #38bdf8;
    }
    .ai-bot-head::before { left: -8px; }
    .ai-bot-head::after { right: -8px; }
    .ai-bot-eye {
      width: 10px;
      height: 8px;
      border-radius: var(--ac-r-full);
      background: #22d3ee;
      box-shadow: 0 0 13px #22d3ee;
    }
    .ai-bot-body {
      position: absolute;
      top: 36px;
      left: 50%;
      display: grid;
      place-items: center;
      width: 42px;
      height: 50px;
      border-radius: 16px 16px 18px 18px;
      background: linear-gradient(160deg, #ffffff, #dbeafe 56%, #c7d2fe);
      border: 2px solid rgba(255,255,255,.95);
      box-shadow: 0 10px 18px rgba(37,99,235,.16);
      transform: translateX(-50%);
    }
    .ai-bot-body .material-symbols-rounded { font-size: 18px !important; color: var(--ac-primary); }
    .ai-bot-arm,
    .ai-bot-leg {
      position: absolute;
      display: block;
      border-radius: 999px;
      background: linear-gradient(180deg, #f8fafc, #9ca3af);
      border: 1px solid rgba(100,116,139,.35);
    }
    .ai-bot-arm { top: 46px; width: 10px; height: 30px; }
    .ai-bot-arm.left { left: 8px; transform: rotate(16deg); }
    .ai-bot-arm.right { right: 6px; transform: rotate(-42deg); transform-origin: top center; }
    .ai-bot-leg { bottom: 0; width: 11px; height: 20px; }
    .ai-bot-leg.left { left: 28px; }
    .ai-bot-leg.right { right: 28px; }
    .ai-bot-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 106px;
      min-height: 44px;
      margin-top: -1px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ac-surface) 92%, #dbeafe);
      border: 1px solid rgba(191,219,254,.95);
      box-shadow: var(--ac-sh-sm);
      color: var(--ac-primary);
    }
    .ai-bot-label strong { font-size: 16px; line-height: 1; font-weight: 900; }
    .ai-bot-label span { font-size: 12px; line-height: 1.1; font-weight: 800; color: var(--ac-text-3); }

    .ai-chat-panel {
      position: fixed;
      right: 28px;
      bottom: 186px;
      z-index: 260;
      display: flex;
      flex-direction: column;
      width: min(380px, calc(100vw - 36px));
      max-height: min(620px, calc(100dvh - 226px));
      overflow: hidden;
      border: 1px solid var(--ac-border);
      border-radius: 20px;
      background: var(--ac-surface);
      box-shadow: 0 28px 70px rgba(15,23,42,.22);
      animation: scaleIn .18s cubic-bezier(.16,1,.3,1);
    }
    .ai-chat-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px;
      border-bottom: 1px solid var(--ac-border);
      background: linear-gradient(135deg, color-mix(in srgb, var(--ac-primary) 9%, var(--ac-surface)), var(--ac-surface));
    }
    .ai-chat-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .ai-chat-title strong { display: block; font-size: 15px; color: var(--ac-text); }
    .ai-chat-title span:not(.material-symbols-rounded):not(.ai-chat-icon) { display: block; font-size: 12px; color: var(--ac-muted); }
    .ai-chat-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 14px;
      background: var(--ac-primary);
      color: #fff;
      box-shadow: 0 12px 22px rgba(37,99,235,.24);
      flex-shrink: 0;
    }
    .ai-chat-icon .material-symbols-rounded { font-size: 21px !important; }
    .ai-icon-btn {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: 1px solid var(--ac-border);
      border-radius: 12px;
      background: var(--ac-surface);
      color: var(--ac-muted);
      cursor: pointer;
    }
    .ai-icon-btn:hover { color: var(--ac-primary); border-color: color-mix(in srgb, var(--ac-primary) 30%, var(--ac-border)); }
    .ai-icon-btn .material-symbols-rounded { font-size: 19px !important; }
    .ai-chat-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      overflow-y: auto;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--ac-surface-2) 42%, transparent), transparent 52%);
    }
    .ai-message {
      max-width: 86%;
      padding: 10px 12px;
      border-radius: 16px 16px 16px 6px;
      background: var(--ac-surface-2);
      border: 1px solid var(--ac-border);
      color: var(--ac-text-2);
      font-size: 13px;
      line-height: 1.45;
    }
    .ai-message.user {
      align-self: flex-end;
      border-radius: 16px 16px 6px 16px;
      background: var(--ac-primary);
      border-color: var(--ac-primary);
      color: #fff;
    }
    .ai-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }
    .ai-suggestions button {
      border: 1px solid color-mix(in srgb, var(--ac-primary) 20%, var(--ac-border));
      border-radius: 999px;
      background: color-mix(in srgb, var(--ac-primary) 8%, var(--ac-surface));
      color: var(--ac-primary);
      font-size: 12px;
      font-weight: 700;
      padding: 7px 10px;
      cursor: pointer;
    }
    .ai-chat-input {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--ac-border);
      background: var(--ac-surface);
    }
    .ai-chat-input input {
      flex: 1;
      min-width: 0;
      height: 42px;
      border: 1px solid var(--ac-border);
      border-radius: 14px;
      background: var(--ac-surface-2);
      color: var(--ac-text);
      padding: 0 12px;
      outline: none;
      font-size: 13px;
    }
    .ai-chat-input input:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 16%, transparent); }
    .ai-chat-input button {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border: none;
      border-radius: 14px;
      background: var(--ac-primary);
      color: #fff;
      cursor: pointer;
      box-shadow: 0 12px 20px rgba(37,99,235,.2);
    }
    .ai-chat-input button .material-symbols-rounded { font-size: 19px !important; }

    /* ── Toast ── */
    .toast-icon { font-size: 20px !important; }
    .toast-body { flex: 1; min-width: 0; }
    .toast-title { font-size: 13.5px; font-weight: 600; color: var(--ac-text); }
    .toast-msg { font-size: 12px; color: var(--ac-muted); margin-top: 2px; }
    .toast-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--ac-r-sm);
      color: var(--ac-muted);
      cursor: pointer;
      transition: background var(--ac-t);
    }
    .toast-close:hover { background: var(--ac-surface-2); }

    /* ── Animations ── */
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

    @media (max-width: 980px) {
      .search-placeholder,
      .search-kbd,
      .profile-meta,
      .profile-btn > .material-symbols-rounded,
      .hdr-sep { display: none; }
      .search-btn { width: 40px; padding: 0; justify-content: center; }
      .tenant-name,
      .branch-btn span:not(.material-symbols-rounded) {
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    @media (max-width: 760px) {
      :host { height: 100dvh; overflow: hidden; }
      .shell { display: block; height: 100dvh; overflow: hidden; }
      .shell-main { height: calc(100dvh - 68px); min-width: 0; }
      .header {
        height: 58px;
        min-height: 58px;
        padding: 0 10px;
        gap: 8px;
        justify-content: space-between;
      }
      .header-left,
      .branch-btn,
      .header-right .hdr-btn[title='Messages'],
      .lang-btn { display: none; }
      .header-center { flex: 1 1 auto; min-width: 0; justify-content: flex-start; }
      .tenant-chip { max-width: 100%; min-width: 0; padding-inline: 10px; }
      .tenant-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .header-right { flex: 0 0 auto; gap: 2px; }
      .hdr-btn { width: 34px; height: 34px; }
      .profile-btn { height: 36px; padding: 0; }
      .avatar { width: 32px; height: 32px; }
      .main-content {
        height: calc(100dvh - 126px);
        padding: 16px 12px 20px;
        overflow-x: hidden;
        overflow-y: auto;
      }

      .sidebar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        top: auto;
        width: 100%;
        min-width: 0;
        height: 68px;
        border-right: 0;
        border-top: 1px solid var(--ac-border);
        z-index: 80;
        box-shadow: 0 -12px 30px rgba(15,23,42,.08);
      }
      .shell.collapsed .sidebar { width: 100%; min-width: 0; }
      .brand,
      .sidebar-footer,
      .sidebar-toggle,
      .nav-group-label,
      .nav-label,
      .nav-children { display: none; }
      .nav {
        height: 100%;
        padding: 8px 10px;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
      }
      .nav::-webkit-scrollbar { display: none; }
      .nav-group { display: contents; }
      .nav-item {
        width: 46px;
        min-width: 46px;
        height: 46px;
        padding: 0;
        justify-content: center;
        border-radius: 14px;
      }
      .nav-icon { min-width: 0; font-size: 21px !important; }
      .nav-item.active {
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ac-primary) 18%, transparent);
      }

      .notif-panel,
      .lang-drop,
      .profile-drop {
        position: fixed;
        top: 66px;
        right: 10px;
        left: 10px;
        width: auto;
        max-height: calc(100dvh - 150px);
        overflow: auto;
      }
      .cp-overlay { padding: 10vh 12px 0; }
      .cp-modal { width: 100%; }
      .cp-footer { display: none; }
      .ai-bot-launcher {
        right: 12px;
        bottom: 78px;
        width: 96px;
        min-height: 118px;
        transform: scale(.88);
        transform-origin: bottom right;
      }
      .ai-chat-panel {
        left: 10px;
        right: 10px;
        bottom: 192px;
        width: auto;
        max-height: calc(100dvh - 262px);
        border-radius: 18px;
      }
      .ai-chat-body { padding: 12px; }
      .ai-message { max-width: 92%; }
    }

    @media (max-width: 380px) {
      .tenant-name { max-width: 118px; }
      .main-content { padding-inline: 10px; }
      .nav { gap: 6px; padding-inline: 8px; }
      .nav-item { width: 43px; min-width: 43px; }
      .ai-bot-launcher { right: 6px; transform: scale(.8); }
      .ai-chat-panel { bottom: 176px; max-height: calc(100dvh - 238px); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent implements OnInit {
  protected readonly i18n    = inject(I18nService);
  protected readonly toastSvc = inject(ToastService);
  private   readonly router  = inject(Router);
  private   readonly authService = inject(AuthService);
  private   readonly authStore = inject(AuthStore);

  /* ── State ── */
  protected readonly sidebarCollapsed = signal<boolean>(
    localStorage.getItem('ac-sidebar') === 'true'
  );
  protected readonly dark = signal<boolean>(
    localStorage.getItem('ac-dark') === 'true'
  );
  protected readonly commandOpen  = signal(false);
  protected readonly notifOpen    = signal(false);
  protected readonly profileOpen  = signal(false);
  protected readonly langOpen     = signal(false);
  protected readonly aiAssistantOpen = signal(false);
  protected readonly aiMessages = signal<AiChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hi, I am AIRA. I can help you find pages, review patient workflows, and answer Care360 questions.'
    }
  ]);
  protected cpQuery = '';
  protected aiPrompt = '';
  protected readonly aiSuggestions = [
    'How do I register a patient?',
    'Open hospital admin',
    'Show today dashboard'
  ];

  /* ── Route detection ── */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(window.location.pathname + window.location.search)
    ),
    { initialValue: window.location.pathname + window.location.search }
  );
  protected readonly isAuthPage = computed(() =>
    this.currentUrl().startsWith('/auth')
  );
  protected readonly isAuthenticated = computed(() => this.authStore.isAuthenticated());

  /* ── Dark mode effect ── */
  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('dark', this.dark());
    });
  }

  ngOnInit(): void {
    document.documentElement.classList.toggle('dark', this.dark());
  }

  /* ── Language ── */
  protected readonly activeLang = computed(() =>
    (this.i18n.catalog()?.effectiveCulture ?? 'en-US').split('-')[0].toUpperCase()
  );
  protected readonly activeCulture = computed(() =>
    this.i18n.catalog()?.effectiveCulture ?? 'en-US'
  );
  protected readonly availableLanguages = computed<Language[]>(() => {
    const languages = this.i18n.languages();
    return languages.length > 0 ? languages : fallbackLanguages;
  });

  protected readonly displayName = computed(() => {
    const session = this.authStore.session();
    return session?.fullName?.trim() || session?.email || 'User';
  });
  protected readonly displayEmail = computed(() => this.authStore.session()?.email ?? '');
  protected readonly isHospitalAdminUser = computed(() =>
    isHospitalAdminSession(this.authStore.session())
  );
  protected readonly roleLabel = computed(() => getUserRoleLabel(this.authStore.session()));
  protected readonly organizationLabel = computed(() =>
    this.authStore.session()?.hospitalName?.trim() || 'Auspira Care360'
  );
  protected readonly hospitalHeaderLabel = computed(() => this.organizationLabel());
  protected readonly branchHeaderLabel = computed(() => 'Main Branch');
  protected readonly userInitials = computed(() => getInitials(this.displayName(), this.displayEmail()));

  /* ── Navigation Groups ── */
  protected readonly navGroups: NavGroup[] = [
    {
      label: 'Dashboard',
      items: [
        { path: '/', label: 'Dashboard', icon: 'dashboard' }
      ]
    },
    {
      label: 'Clinical',
      items: [
        { path: '/patients',     label: 'Patients',     icon: 'people' },
        { path: '/doctors',      label: 'Doctors',      icon: 'medical_services' },
        { path: '/appointments', label: 'Appointments', icon: 'event' },
        { path: '/opd',          label: 'OPD',          icon: 'local_hospital' },
        { path: '/ipd',          label: 'IPD',          icon: 'king_bed' }
      ]
    },
    {
      label: 'Operations',
      items: [
        { path: '/laboratory', label: 'Laboratory', icon: 'biotech' },
        { path: '/pharmacy',   label: 'Pharmacy',   icon: 'medication' },
        { path: '/billing',    label: 'Billing',    icon: 'receipt_long' },
        { path: '/inventory',  label: 'Inventory',  icon: 'inventory_2' }
      ]
    },
    {
      label: 'Administration',
      items: [
        {
          path: '/administration/users',
          label: 'Hospital Admin',
          icon: 'manage_accounts',
          requiredPermission: 'Administration.UserManagement.View',
          hospitalAdminOnly: true,
          children: [
            { path: '/administration/hospital', label: 'Hospital Profile', icon: 'local_hospital', requiredPermission: 'Administration.Hospital.View' },
            { path: '/administration/branches', label: 'Branches', icon: 'account_tree', requiredPermission: 'Administration.Branch.View' },
            { path: '/administration/users', label: 'Users', icon: 'manage_accounts', requiredPermission: 'Administration.UserManagement.View' },
            { path: '/administration/roles', label: 'Roles', icon: 'admin_panel_settings', requiredPermission: 'Administration.Roles.View' },
            { path: '/administration/permissions', label: 'Permissions', icon: 'rule', requiredPermission: 'Administration.Permissions.View' },
            { path: '/administration/departments', label: 'Departments', icon: 'business', requiredPermission: 'Administration.Department.View' },
            { path: '/administration/designations', label: 'Designations', icon: 'badge', requiredPermission: 'Administration.Designation.View' },
            { path: '/administration/system-configuration', label: 'System Configuration', icon: 'settings', requiredPermission: 'Administration.SystemConfiguration.View' }
          ]
        }
      ]
    },
    {
      label: 'Analytics',
      items: [
        { path: '/reports', label: 'Reports & Insights', icon: 'analytics' }
      ]
    }
  ];

  protected readonly filteredNavGroups = computed(() =>
    this.navGroups
      .filter(group => this.canShowGroup(group))
      .map(group => ({
        ...group,
        items: group.items
          .map(item => this.filterNavItem(item))
          .filter((item): item is NavItem => item !== null)
      }))
      .filter(group => group.items.length > 0)
  );

  protected readonly allNavItems = computed(() =>
    this.filteredNavGroups().flatMap(group =>
      group.items.flatMap(item => [item, ...(item.children ?? [])])
    )
  );

  protected readonly filteredNav = computed(() =>
    this.allNavItems().filter(i =>
      i.label.toLowerCase().includes(this.cpQuery.toLowerCase())
    )
  );

  /* ── Notifications mock data ── */
  private canShowGroup(group: NavGroup): boolean {
    return !group.requiredPermissionPrefix
      || this.authStore.permissions().some(permission => permission.startsWith(group.requiredPermissionPrefix!));
  }

  private filterNavItem(item: NavItem): NavItem | null {
    const children = (item.children ?? [])
      .map(child => this.filterNavItem(child))
      .filter((child): child is NavItem => child !== null);

    const canShowItem = (!item.requiredPermission || this.authStore.hasPermission(item.requiredPermission))
      && (!item.hospitalAdminOnly || this.isHospitalAdminUser());
    if (!canShowItem && children.length === 0) {
      return null;
    }

    return {
      ...item,
      children: children.length > 0 ? children : undefined
    };
  }

  protected readonly notifications = [
    { id: 1, icon: 'person_add', title: 'New patient registered: Rahul Sharma', time: '2 min ago', unread: true,  bg: 'rgba(37,99,235,0.1)',  color: '#2563EB' },
    { id: 2, icon: 'receipt',    title: 'Invoice #INV-0412 generated — ₹4,200', time: '18 min ago', unread: true,  bg: 'rgba(16,185,129,0.1)', color: '#10B981' },
    { id: 3, icon: 'science',    title: 'Lab report ready: CBC for P-1093',    time: '1 hr ago',   unread: false, bg: 'rgba(124,58,237,0.1)', color: '#7C3AED' },
    { id: 4, icon: 'warning',    title: 'Low stock alert: Paracetamol 500mg',  time: '3 hr ago',   unread: false, bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' }
  ];

  /* ── Profile menu ── */
  protected readonly profileMenu = [
    { icon: 'account_circle',    label: 'My Profile',        path: '/profile' },
    { icon: 'settings',          label: 'Account Settings',  path: '/profile/account-settings' },
    { icon: 'security',          label: 'Security Settings', path: '/profile/security-settings' },
    { icon: 'history',           label: 'Activity Logs',     path: '/profile/activity-logs' },
    { icon: 'lock_reset',        label: 'Change Password',   path: '/profile/change-password' }
  ];

  /* ── Actions ── */
  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => {
      const next = !v;
      localStorage.setItem('ac-sidebar', String(next));
      return next;
    });
  }

  toggleDark(): void {
    this.dark.update(v => {
      const next = !v;
      localStorage.setItem('ac-dark', String(next));
      return next;
    });
  }

  toggleNotifications(): void {
    this.notifOpen.update(open => !open);
    this.profileOpen.set(false);
    this.langOpen.set(false);
  }

  toggleProfileMenu(): void {
    this.profileOpen.update(open => !open);
    this.notifOpen.set(false);
    this.langOpen.set(false);
  }

  toggleLanguageMenu(): void {
    this.langOpen.update(open => !open);
    this.notifOpen.set(false);
    this.profileOpen.set(false);
  }

  async selectLanguage(cultureCode: string): Promise<void> {
    try {
      await this.i18n.loadCatalog(cultureCode);
      this.langOpen.set(false);
      this.toastSvc.success('Language updated', `Display language changed to ${cultureCode}.`);
    } catch {
      this.toastSvc.error('Language not changed', 'Unable to load the selected language.');
    }
  }

  closeDropdowns(): void {
    this.notifOpen.set(false);
    this.profileOpen.set(false);
    this.langOpen.set(false);
  }

  toggleAiAssistant(): void {
    this.aiAssistantOpen.update(open => !open);
    this.closeDropdowns();
  }

  askAiSuggestion(prompt: string): void {
    this.aiPrompt = prompt;
    this.sendAiMessage();
  }

  sendAiMessage(event?: Event): void {
    event?.preventDefault();
    const prompt = this.aiPrompt.trim();

    if (!prompt) {
      return;
    }

    this.aiPrompt = '';
    this.aiMessages.update(messages => [
      ...messages,
      { role: 'user', text: prompt },
      { role: 'assistant', text: this.createAiReply(prompt) }
    ]);
  }

  async logout(): Promise<void> {
    this.profileOpen.set(false);
    const refreshToken = this.authStore.refreshToken();

    if (refreshToken) {
      await this.authService.logout(refreshToken).catch(() => undefined);
    }

    this.authStore.clearSession();
    await this.router.navigateByUrl('/auth/login');
  }

  /* ── Command Palette Hotkey ── */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.commandOpen.update(v => !v);
    }
    if (e.key === 'Escape') {
      this.commandOpen.set(false);
      this.notifOpen.set(false);
      this.profileOpen.set(false);
      this.langOpen.set(false);
      this.aiAssistantOpen.set(false);
    }
  }

  private createAiReply(prompt: string): string {
    const normalizedPrompt = prompt.toLowerCase();

    if (normalizedPrompt.includes('patient') || normalizedPrompt.includes('register')) {
      return 'Go to Patients and click Register Patient. AIRA can guide the workflow here; live AI answers can be connected once the backend assistant API is available.';
    }

    if (normalizedPrompt.includes('hospital') || normalizedPrompt.includes('admin')) {
      return 'Open Hospital Admin from the left menu to manage profile, branches, users, roles, and permissions.';
    }

    if (normalizedPrompt.includes('dashboard')) {
      return 'The dashboard gives the operational summary for your hospital. Use the Dashboard menu item to return there.';
    }

    return 'I have noted your question. The AIRA chat shell is ready; connect it to the assistant API to return live answers from your knowledge base.';
  }

  /* ── Toast helpers ── */
  toastIcon(type: string): string {
    const map: Record<string, string> = {
      success: 'check_circle', error: 'error', warning: 'warning', info: 'info'
    };
    return map[type] ?? 'info';
  }

  toastColor(type: string): string {
    const map: Record<string, string> = {
      success: 'var(--ac-success)', error: 'var(--ac-error)',
      warning: 'var(--ac-warning)', info: 'var(--ac-info)'
    };
    return map[type] ?? 'var(--ac-info)';
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
