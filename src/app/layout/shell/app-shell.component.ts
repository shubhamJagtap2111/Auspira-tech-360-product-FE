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
import { AiraChatService } from '../../core/ai/aira-chat.service';
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
  pending?: boolean;
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
              <button
                class="hdr-btn aira-toggle"
                [class.active]="showAiAssistantBot()"
                type="button"
                (click)="toggleAiAssistantBot()"
                [title]="showAiAssistantBot() ? 'Hide AIRA' : 'Show AIRA'">
                <span class="aira-message-icon" aria-hidden="true"></span>
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
        @if (showAiAssistantBot() && aiAssistantOpen()) {
          <section class="ai-chat-panel" aria-label="AIRA assistant chat">
            <header class="ai-chat-head">
              <div class="ai-chat-title">
                <span class="ai-orb mini"><i></i></span>
                <div>
                  <strong>AIRA</strong>
                  <span><i></i> Online - AI Assistant</span>
                </div>
              </div>
              <button class="ai-icon-btn" type="button" title="Close AIRA" (click)="aiAssistantOpen.set(false)">
                <span class="material-symbols-rounded">close</span>
              </button>
            </header>
            <div class="ai-chat-body">
              <div class="ai-welcome">
                <span class="voice-wave"><i></i><i></i><i></i><i></i></span>
                <p class="ai-message bot">Hello. I can help with Auspira Care360 modules, patient workflows, AI features, and daily hospital operations.</p>
                <div class="ai-mini-grid">
                  <span>Care360</span>
                  <span>Patients</span>
                  <span>Reports</span>
                </div>
              </div>
              <div class="ai-suggestions">
                @for (suggestion of aiSuggestions; track suggestion) {
                  <button type="button" (click)="askAiSuggestion(suggestion)">{{ suggestion }}</button>
                }
              </div>
              @for (message of aiMessages(); track message.role + message.text) {
                <div class="ai-message" [class.user]="message.role === 'user'" [class.bot]="message.role === 'assistant'" [class.pending]="message.pending">
                  <p [innerHTML]="formatAiMessage(message.text)"></p>
                </div>
              }
            </div>
            <form class="ai-chat-input" (submit)="sendAiMessage($event)">
              <input name="aiPrompt" [(ngModel)]="aiPrompt" [disabled]="aiSending()" placeholder="Ask about patients, reports, or workflows" autocomplete="off" />
              <button type="submit" title="Send message" [disabled]="aiSending()">
                <span class="material-symbols-rounded">send</span>
              </button>
            </form>
          </section>
        }

        @if (showAiAssistantBot()) {
          <button class="ai-bot-launcher" type="button" [class.chat-open]="aiAssistantOpen()" (click)="toggleAiAssistant()" aria-label="Open AIRA Ask AI">
            <span class="ai-minimize-dot">
              <span class="material-symbols-rounded">{{ aiAssistantOpen() ? 'remove' : 'add' }}</span>
            </span>
            <span class="ai-bot-art" aria-hidden="true">
              <img src="assets/brand/aira-doctor-bot.png" alt="" loading="lazy" decoding="async" />
            </span>
            <span class="ai-bot-label">
              <strong>AIRA</strong>
              <small>Ask AI</small>
            </span>
          </button>
        }

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
    .aira-toggle {
      overflow: hidden;
      color: var(--ac-primary);
      border: 0;
      background: transparent;
      box-shadow: none;
    }
    .aira-message-icon {
      width: 21px;
      height: 21px;
      background: currentColor;
      mask: url('/assets/brand/aira-message.png') center / contain no-repeat;
      -webkit-mask: url('/assets/brand/aira-message.png') center / contain no-repeat;
    }
    .aira-toggle::after {
      content: '';
      position: absolute;
      display: none;
      right: 7px;
      top: 7px;
      width: 6px;
      height: 6px;
      border-radius: 999px;
    }
    .aira-toggle.active {
      color: var(--ac-primary);
      background: transparent;
      box-shadow: none;
    }
    .aira-toggle.active::after {
      display: block;
      background: var(--ac-success);
      box-shadow: 0 0 0 2px var(--ac-header-bg), 0 0 14px rgba(34,197,94,.82);
    }
    .aira-toggle:hover {
      color: var(--ac-primary);
      background: var(--ac-surface-2);
    }

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
      right: 18px;
      bottom: 18px;
      z-index: 250;
      display: grid;
      place-items: center;
      width: 86px;
      min-height: 100px;
      gap: 0;
      padding: 0 0 17px;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--ac-primary);
      cursor: pointer;
      animation: botHover 5.5s ease-in-out infinite;
      filter: drop-shadow(0 14px 22px rgba(37,99,235,.18));
      touch-action: none;
    }
    .ai-bot-launcher:hover .ai-bot-art { transform: translateY(-3px); }
    .ai-bot-launcher.chat-open { filter: drop-shadow(0 16px 28px rgba(37,99,235,.24)); }
    .ai-minimize-dot {
      position: absolute;
      top: 5px;
      right: -1px;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: var(--ac-r-full);
      border: 1px solid rgba(37,99,235,.14);
      background: color-mix(in srgb, var(--ac-surface) 92%, white);
      color: var(--ac-primary);
      box-shadow: 0 8px 20px rgba(37,99,235,.14);
      z-index: 2;
      backdrop-filter: blur(14px);
    }
    .ai-bot-launcher.chat-open .ai-minimize-dot { display: none; }
    .ai-minimize-dot .material-symbols-rounded { font-size: 16px !important; }
    .ai-bot-art {
      position: relative;
      display: grid;
      place-items: center;
      width: 78px;
      height: 82px;
      transition: transform var(--ac-t);
    }
    .ai-bot-art img {
      width: 84px;
      max-width: none;
      height: 90px;
      object-fit: contain;
      object-position: center bottom;
      pointer-events: none;
      user-select: none;
    }
    .ai-bot-label {
      position: absolute;
      left: 50%;
      bottom: 0;
      display: grid;
      min-width: 70px;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.68);
      background:
        radial-gradient(circle at 16% 18%, rgba(8,191,255,.18), transparent 38%),
        color-mix(in srgb, var(--ac-surface) 92%, white);
      color: var(--ac-primary);
      line-height: 1.05;
      text-align: center;
      box-shadow: 0 10px 26px rgba(37,99,235,.14), inset 0 0 0 1px rgba(8,191,255,.08);
      transform: translateX(-50%);
      backdrop-filter: blur(14px);
    }
    .ai-bot-label strong { font-size: 11px; line-height: 1; font-weight: 900; }
    .ai-bot-label small { font-size: 8px; line-height: 1.05; font-weight: 900; color: var(--ac-muted); }

    .ai-chat-panel {
      position: fixed;
      right: 18px;
      bottom: 122px;
      z-index: 260;
      display: flex;
      flex-direction: column;
      width: min(336px, calc(100vw - 28px));
      max-height: min(560px, calc(100dvh - 150px));
      overflow: hidden;
      border: 1px solid var(--ac-border);
      border-radius: 18px;
      background:
        radial-gradient(circle at 12% 0%, rgba(8,191,255,.20), transparent 8rem),
        radial-gradient(circle at 100% 6%, rgba(101,36,223,.10), transparent 9rem),
        linear-gradient(135deg, rgba(244,251,255,.88), color-mix(in srgb, var(--ac-surface) 96%, white)),
        var(--ac-surface);
      box-shadow: 0 22px 60px rgba(15,23,42,.20);
      backdrop-filter: blur(18px);
      animation: scaleIn .18s cubic-bezier(.16,1,.3,1);
    }
    .ai-chat-head {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-bottom: 1px solid var(--ac-border);
      background: linear-gradient(135deg, rgba(37,99,235,.08), rgba(8,191,255,.06), rgba(101,36,223,.06));
    }
    .ai-chat-title { display: flex; align-items: center; gap: 9px; min-width: 0; }
    .ai-chat-title strong { display: block; font-size: 14px; color: var(--ac-text); }
    .ai-chat-title span:not(.ai-orb) { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--ac-muted); }
    .ai-chat-title span:not(.ai-orb) i { width: 6px; height: 6px; border-radius: 999px; background: var(--ac-success); box-shadow: 0 0 10px rgba(34,197,94,.7); }
    .ai-orb {
      position: relative;
      display: inline-grid;
      width: 32px;
      aspect-ratio: 1;
      place-items: center;
      border-radius: 50%;
      background:
        radial-gradient(circle at 35% 28%, white, transparent 18%),
        linear-gradient(135deg, #08bfff, #6524df);
      box-shadow: inset 0 0 14px rgba(255,255,255,.35), 0 0 20px rgba(8,191,255,.45);
    }
    .ai-orb::before,
    .ai-orb::after {
      content: '';
      position: absolute;
      inset: -5px;
      border: 1px solid rgba(8,191,255,.34);
      border-radius: 50%;
      animation: orbRing 6s ease-out infinite;
    }
    .ai-orb::after { animation-delay: 3s; }
    .ai-orb i { width: 6px; height: 6px; border-radius: 50%; background: white; box-shadow: 0 0 18px white; }
    .ai-orb.mini { width: 30px; flex-shrink: 0; }
    .ai-icon-btn {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--ac-border);
      border-radius: 10px;
      background: var(--ac-surface);
      color: var(--ac-muted);
      cursor: pointer;
    }
    .ai-icon-btn:hover { color: var(--ac-primary); border-color: color-mix(in srgb, var(--ac-primary) 30%, var(--ac-border)); }
    .ai-icon-btn .material-symbols-rounded { font-size: 19px !important; }
    .ai-chat-body {
      display: grid;
      max-height: 260px;
      gap: 8px;
      padding: 10px 11px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .ai-welcome { display: grid; gap: 8px; }
    .voice-wave {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      width: max-content;
      min-width: 52px;
      min-height: 34px;
      padding: 7px 10px;
      border-radius: 14px;
      background:
        radial-gradient(circle at 35% 28%, rgba(8,191,255,.24), transparent 2.4rem),
        rgba(37,99,235,.08);
    }
    .voice-wave i {
      width: 3px;
      height: 11px;
      border-radius: 999px;
      background: linear-gradient(180deg, #08bfff, #6524df);
      animation: wave 880ms ease-in-out infinite alternate;
    }
    .voice-wave i:nth-child(2) { height: 17px; animation-delay: 120ms; }
    .voice-wave i:nth-child(3) { height: 14px; animation-delay: 240ms; }
    .voice-wave i:nth-child(4) { height: 19px; animation-delay: 360ms; }
    .ai-mini-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    .ai-mini-grid span {
      min-height: 32px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(37,99,235,.12);
      border-radius: 10px;
      background: color-mix(in srgb, var(--ac-surface) 88%, white);
      color: var(--ac-primary);
      font-size: 10.5px;
      font-weight: 900;
      text-align: center;
    }
    .ai-message {
      max-width: 90%;
      padding: 9px 11px;
      border-radius: 11px;
      font-size: 12.5px;
      line-height: 1.5;
    }
    .ai-message.bot {
      background: rgba(232,239,255,.94);
      color: #34466f;
      border: 0;
    }
    .ai-message.pending {
      color: var(--ac-muted);
      background: linear-gradient(135deg, rgba(239,246,255,.88), rgba(245,243,255,.9));
    }
    .dark .ai-message.bot { color: var(--ac-text-2); background: rgba(37,99,235,.14); }
    .ai-message p { margin: 0; }
    .ai-message p strong { font-weight: 900; color: inherit; }
    .ai-message p em { font-style: normal; font-weight: 800; color: inherit; }
    .ai-message p .ai-bullet { position: relative; display: block; padding-left: 14px; margin-top: 5px; }
    .ai-message p .ai-bullet::before { content: ''; position: absolute; left: 2px; top: .72em; width: 5px; height: 5px; border-radius: 999px; background: currentColor; opacity: .55; }
    .ai-welcome > .ai-message { max-width: 100%; }
    .ai-chat-body > .ai-message { width: fit-content; }
    .ai-chat-body > .ai-message.user { justify-self: end; }
    .ai-chat-body > .ai-message.bot { justify-self: start; }
    .ai-message.user {
      border-radius: 11px;
      background: linear-gradient(135deg, rgba(31,124,255,.82), rgba(141,77,255,.82));
      color: #fff;
      border: 0;
    }
    .ai-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ai-suggestions button {
      border: 1px solid rgba(37,99,235,.14);
      border-radius: 999px;
      background: var(--ac-surface);
      color: var(--ac-primary);
      font-size: 11.5px;
      font-weight: 900;
      padding: 7px 10px;
      cursor: pointer;
      box-shadow: 0 10px 26px rgba(37,99,235,.06);
    }
    .ai-chat-input {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 10px 11px;
      border-top: 1px solid var(--ac-border);
      background: color-mix(in srgb, var(--ac-surface) 78%, white);
    }
    .ai-chat-input input {
      min-width: 0;
      border: 1px solid var(--ac-border);
      border-radius: 999px;
      background: var(--ac-surface);
      color: var(--ac-text);
      padding: 10px 12px;
      outline: none;
      font-size: 12.5px;
    }
    .ai-chat-input input:focus { border-color: var(--ac-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 16%, transparent); }
    .ai-chat-input button {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: var(--ac-r-full);
      background: var(--ac-primary);
      color: #fff;
      cursor: pointer;
      box-shadow: 0 14px 36px rgba(37,99,235,.32);
    }
    .ai-chat-input input:disabled,
    .ai-chat-input button:disabled {
      cursor: wait;
      opacity: .72;
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
    @keyframes botHover {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes wave {
      from { transform: scaleY(.55); opacity: .7; }
      to { transform: scaleY(1); opacity: 1; }
    }
    @keyframes orbRing {
      0% { transform: scale(.8); opacity: .65; }
      70%, 100% { transform: scale(1.45); opacity: 0; }
    }

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
        right: 10px;
        bottom: 78px;
        width: 82px;
        min-height: 98px;
        transform: scale(.86);
        transform-origin: bottom right;
      }
      .ai-chat-panel {
        left: 10px;
        right: 10px;
        bottom: 168px;
        width: auto;
        max-height: calc(100dvh - 232px);
        border-radius: 18px;
      }
      .ai-chat-body { padding: 10px; }
      .ai-message { max-width: 92%; }
    }

    @media (max-width: 380px) {
      .tenant-name { max-width: 118px; }
      .main-content { padding-inline: 10px; }
      .nav { gap: 6px; padding-inline: 8px; }
      .nav-item { width: 43px; min-width: 43px; }
      .ai-bot-launcher { right: 6px; transform: scale(.78); }
      .ai-chat-panel { bottom: 158px; max-height: calc(100dvh - 220px); }
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
  private   readonly airaChatService = inject(AiraChatService);

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
  protected readonly showAiAssistantBot = signal<boolean>(
    localStorage.getItem('ac-aira-visible') !== 'false'
  );
  protected readonly aiMessages = signal<AiChatMessage[]>([]);
  protected readonly aiSending = signal(false);
  protected cpQuery = '';
  protected aiPrompt = '';
  protected readonly aiSuggestions = [
    'Register patient',
    'Care360 modules',
    'Hospital admin',
    'Today reports'
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

  @HostListener('window:ac-dark-preference', ['$event'])
  syncDarkPreference(event: CustomEvent<boolean>): void {
    this.dark.set(Boolean(event.detail));
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
    if (!this.showAiAssistantBot()) {
      this.showAiAssistantBot.set(true);
      localStorage.setItem('ac-aira-visible', 'true');
    }

    this.aiAssistantOpen.update(open => !open);
    this.closeDropdowns();
  }

  toggleAiAssistantBot(): void {
    const visible = !this.showAiAssistantBot();
    this.showAiAssistantBot.set(visible);
    localStorage.setItem('ac-aira-visible', String(visible));

    if (!visible) {
      this.aiAssistantOpen.set(false);
    }

    this.closeDropdowns();
  }

  askAiSuggestion(prompt: string): void {
    this.aiPrompt = prompt;
    this.sendAiMessage();
  }

  async sendAiMessage(event?: Event): Promise<void> {
    event?.preventDefault();
    const prompt = this.aiPrompt.trim();

    if (!prompt || this.aiSending()) {
      return;
    }

    this.aiPrompt = '';
    const history = this.aiMessages()
      .filter(message => !message.pending)
      .slice(-6)
      .map(message => ({ role: message.role, content: message.text }));

    this.aiMessages.update(messages => [
      ...messages,
      { role: 'user', text: prompt },
      { role: 'assistant', text: 'Checking with AIRA...', pending: true }
    ]);
    this.aiSending.set(true);

    try {
      const response = await this.airaChatService.send(prompt, history);
      const reply = response.success && response.data?.message
        ? response.data.message
        : this.aiErrorMessage(response.message);

      this.aiMessages.update(messages => [
        ...messages.filter(message => !message.pending),
        { role: 'assistant', text: reply }
      ]);
    } catch {
      this.aiMessages.update(messages => [
        ...messages.filter(message => !message.pending),
        { role: 'assistant', text: 'AIRA is busy right now. Please try again in a moment.' }
      ]);
    } finally {
      this.aiSending.set(false);
    }
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

  private aiErrorMessage(messageKey: string): string {
    if (messageKey.startsWith('Ai.Chat.Errors.ProviderUnavailable:')) {
      if (messageKey.includes('Gemini HTTP 503') || messageKey.includes('ServiceUnavailable') || messageKey.includes('high demand')) {
        return 'AIRA is experiencing high demand right now. Please retry in a few seconds.';
      }

      return 'AIRA could not complete the request right now. Please retry in a moment.';
    }

    const messages: Record<string, string> = {
      'Ai.Chat.Errors.ProviderNotConfigured': 'AIRA is not configured yet. Please set the AI provider key on the API server.',
      'Ai.Chat.Errors.ProviderUnavailable': 'AIRA could not reach the AI provider right now. Please try again in a moment.',
      'Ai.Chat.Errors.ProviderTimeout': 'AIRA took too long to respond. Please try a shorter question.',
      'Ai.Chat.Validation.MessageRequired': 'Please type a question for AIRA.',
      'Ai.Chat.Validation.MessageTooLong': 'Please shorten your question and try again.'
    };

    return messages[messageKey] ?? 'AIRA could not answer that request right now.';
  }

  protected formatAiMessage(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/(?:^|\n)[*-]\s+(.+?)(?=\n|$)/g, '<br><span class="ai-bullet">$1</span>')
      .replace(/\n/g, '<br>');
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
