import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  requiredPermission?: string;
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  requiredPermissionPrefix?: string;
  items: NavItem[];
}

@Component({
  selector: 'ac-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FormsModule],
  template: `
    @if (isAuthPage()) {
      <router-outlet />
    } @else {
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
                <span class="tenant-name">City General Hospital</span>
              </div>
              <button class="branch-btn">
                <span class="material-symbols-rounded" style="font-size:16px">account_tree</span>
                <span>Main Branch</span>
                <span class="material-symbols-rounded" style="font-size:16px">expand_more</span>
              </button>
            </div>

            <!-- Actions -->
            <div class="header-right">
              <button class="hdr-btn notif-btn" (click)="notifOpen.set(!notifOpen())" title="Notifications">
                <span class="material-symbols-rounded">notifications</span>
                <span class="notif-dot">3</span>
              </button>
              <button class="hdr-btn" title="Messages">
                <span class="material-symbols-rounded">chat_bubble</span>
              </button>
              <button class="hdr-btn" (click)="toggleDark()" [title]="dark() ? 'Light mode' : 'Dark mode'">
                <span class="material-symbols-rounded">{{ dark() ? 'light_mode' : 'dark_mode' }}</span>
              </button>
              <button class="hdr-btn lang-btn" title="Language">
                <span class="material-symbols-rounded">language</span>
                <span class="lang-code">{{ activeLang() }}</span>
              </button>
              <div class="hdr-sep"></div>
              <button class="profile-btn" (click)="profileOpen.set(!profileOpen())">
                <div class="avatar">
                  <span>DJ</span>
                </div>
                <div class="profile-meta">
                  <span class="profile-name">Dr. John</span>
                  <span class="profile-role">Administrator</span>
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

          <!-- Profile Dropdown -->
          @if (profileOpen()) {
            <div class="profile-drop">
              <div class="pd-user">
                <div class="pd-avatar">DJ</div>
                <div class="pd-info">
                  <p class="pd-name">Dr. John Smith</p>
                  <p class="pd-role">Administrator</p>
                  <p class="pd-org">City General Hospital</p>
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
          @if (notifOpen() || profileOpen()) {
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
    }
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
  protected cpQuery = '';

  /* ── Route detection ── */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );
  protected readonly isAuthPage = computed(() =>
    this.currentUrl().startsWith('/auth')
  );

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

  /* ── Navigation Groups ── */
  protected readonly navGroups: NavGroup[] = [
    {
      label: 'Dashboard',
      items: [
        { path: '/', label: 'Dashboard', icon: 'dashboard' }
      ]
    },
    {
      label: 'Super Admin',
      requiredPermissionPrefix: 'SuperAdmin.',
      items: [
        {
          path: '/super-admin',
          label: 'Platform',
          icon: 'admin_panel_settings',
          children: [
            { path: '/super-admin', label: 'Overview', icon: 'dashboard' },
            { path: '/super-admin/announcements', label: 'Announcements', icon: 'campaign' },
            { path: '/super-admin/settings', label: 'Global Settings', icon: 'settings' }
          ]
        },
        {
          path: '/super-admin/tenants',
          label: 'Tenant Management',
          icon: 'corporate_fare',
          children: [
            { path: '/super-admin/tenants', label: 'Hospitals', icon: 'local_hospital' },
            { path: '/super-admin/provisioning', label: 'Provisioning', icon: 'deployed_code' },
            { path: '/super-admin/domains', label: 'Domains', icon: 'dns' },
            { path: '/super-admin/database-servers', label: 'Database Servers', icon: 'database' },
            { path: '/super-admin/database-versions', label: 'Database Versions', icon: 'history' }
          ]
        },
        {
          path: '/super-admin/plans',
          label: 'Plans',
          icon: 'workspace_premium',
          children: [
            { path: '/super-admin/plans', label: 'Plans', icon: 'workspace_premium' },
            { path: '/super-admin/features', label: 'Features', icon: 'toggle_on' },
            { path: '/super-admin/plans', label: 'Limits', icon: 'speed' },
            { path: '/super-admin/plans', label: 'Pricing', icon: 'sell' }
          ]
        },
        {
          path: '/super-admin/subscriptions',
          label: 'Subscriptions',
          icon: 'autorenew',
          children: [
            { path: '/super-admin/subscriptions', label: 'Active', icon: 'check_circle' },
            { path: '/super-admin/subscriptions', label: 'Trial', icon: 'hourglass_top' },
            { path: '/super-admin/subscriptions', label: 'Expired', icon: 'event_busy' },
            { path: '/super-admin/subscriptions', label: 'Renewals', icon: 'published_with_changes' }
          ]
        },
        {
          path: '/super-admin/billing',
          label: 'Billing',
          icon: 'receipt_long',
          children: [
            { path: '/super-admin/billing', label: 'Payments', icon: 'payments' },
            { path: '/super-admin/billing', label: 'Invoices', icon: 'request_quote' },
            { path: '/super-admin/billing', label: 'GST', icon: 'percent' },
            { path: '/super-admin/billing', label: 'Coupons', icon: 'confirmation_number' }
          ]
        },
        {
          path: '/super-admin/databases',
          label: 'Database',
          icon: 'database',
          children: [
            { path: '/super-admin/databases', label: 'Databases', icon: 'database' },
            { path: '/super-admin/databases', label: 'Backups', icon: 'backup' },
            { path: '/super-admin/databases', label: 'Restores', icon: 'restore' },
            { path: '/super-admin/databases', label: 'Migrations', icon: 'schema' }
          ]
        },
        {
          path: '/super-admin/deployments/releases',
          label: 'Deployments',
          icon: 'rocket_launch',
          children: [
            { path: '/super-admin/deployments/releases', label: 'Releases', icon: 'new_releases' },
            { path: '/super-admin/deployments/rollouts', label: 'Rollouts', icon: 'conversion_path' },
            { path: '/super-admin/deployments/rollbacks', label: 'Rollbacks', icon: 'settings_backup_restore' }
          ]
        },
        {
          path: '/super-admin/monitoring',
          label: 'Monitoring',
          icon: 'monitoring',
          children: [
            { path: '/super-admin/monitoring', label: 'Health', icon: 'health_and_safety' },
            { path: '/super-admin/monitoring', label: 'Logs', icon: 'receipt_long' },
            { path: '/super-admin/monitoring', label: 'Performance', icon: 'speed' }
          ]
        },
        {
          path: '/administration/users',
          label: 'Security',
          icon: 'security',
          children: [
            { path: '/administration/users', label: 'Users', icon: 'manage_accounts' },
            { path: '/administration/roles', label: 'Roles', icon: 'admin_panel_settings' },
            { path: '/administration/permissions', label: 'Permissions', icon: 'rule' },
            { path: '/super-admin/security/api-keys', label: 'API Keys', icon: 'key' },
            { path: '/super-admin/security/sessions', label: 'Sessions', icon: 'devices' },
            { path: '/super-admin/security/audit-logs', label: 'Audit Logs', icon: 'history_edu' }
          ]
        },
        {
          path: '/super-admin/support',
          label: 'Support',
          icon: 'support_agent',
          children: [
            { path: '/super-admin/support', label: 'Tickets', icon: 'confirmation_number' },
            { path: '/super-admin/support/feedback', label: 'Feedback', icon: 'reviews' },
            { path: '/super-admin/announcements', label: 'Announcements', icon: 'campaign' }
          ]
        },
        {
          path: '/super-admin/reports/revenue',
          label: 'Reports',
          icon: 'analytics',
          children: [
            { path: '/super-admin/reports/revenue', label: 'Revenue', icon: 'trending_up' },
            { path: '/super-admin/reports/hospitals', label: 'Hospitals', icon: 'local_hospital' },
            { path: '/super-admin/reports/growth', label: 'Growth', icon: 'show_chart' },
            { path: '/super-admin/reports/usage', label: 'Usage', icon: 'query_stats' },
            { path: '/super-admin/reports/ai-consumption', label: 'AI Consumption', icon: 'psychology' }
          ]
        },
        {
          path: '/super-admin/settings',
          label: 'Settings',
          icon: 'settings',
          children: [
            { path: '/super-admin/settings', label: 'SMTP', icon: 'outgoing_mail' },
            { path: '/super-admin/settings', label: 'Storage', icon: 'storage' },
            { path: '/super-admin/settings', label: 'Integrations', icon: 'hub' },
            { path: '/super-admin/settings', label: 'Branding', icon: 'palette' },
            { path: '/super-admin/settings', label: 'Localization', icon: 'language' }
          ]
        }
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

    const canShowItem = !item.requiredPermission || this.authStore.hasPermission(item.requiredPermission);
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
    { icon: 'settings',          label: 'Account Settings',  path: '/profile' },
    { icon: 'security',          label: 'Security Settings', path: '/profile' },
    { icon: 'history',           label: 'Activity Logs',     path: '/profile' },
    { icon: 'lock_reset',        label: 'Change Password',   path: '/profile' }
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

  closeDropdowns(): void {
    this.notifOpen.set(false);
    this.profileOpen.set(false);
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
    }
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
