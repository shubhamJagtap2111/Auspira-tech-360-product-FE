import { Injectable, computed, signal } from '@angular/core';
import { AuthResponse, CurrentUserProfile } from './auth.models';

const sessionStorageKey = 'care360.auth.session';
const tokenExpiryBufferMs = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly sessionSignal = signal<AuthResponse | null>(readStoredSession());
  private readonly profileSignal = signal<CurrentUserProfile | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly isAuthenticated = computed(() => isSessionUsable(this.sessionSignal()) || this.profileSignal() !== null);
  readonly permissions = computed(() => this.sessionSignal()?.permissions ?? this.profileSignal()?.permissions ?? []);

  setSession(session: AuthResponse): void {
    this.sessionSignal.set(session);
    this.profileSignal.set(null);
    writeStoredSession(session);
  }

  setProfile(profile: CurrentUserProfile): void {
    if (!isProfileUsable(profile)) {
      this.clearSession();
      return;
    }

    this.profileSignal.set(profile);
    const session = this.sessionSignal();
    if (session) {
      this.sessionSignal.set({
        ...session,
        userId: profile.userId,
        email: profile.email,
        fullName: profile.fullName,
        permissions: profile.permissions.length > 0 ? profile.permissions : session.permissions,
        roleCodes: profile.roleCodes.length > 0 ? profile.roleCodes : session.roleCodes,
        tenantCode: profile.tenantCode || session.tenantCode,
        hospitalName: profile.hospitalName || session.hospitalName
      });
      writeStoredSession(this.sessionSignal());
    }
  }

  clearSession(): void {
    this.sessionSignal.set(null);
    this.profileSignal.set(null);
    removeStoredSession();
  }

  accessToken(): string | null {
    const session = this.sessionSignal();
    return isSessionUsable(session) ? session.accessToken : null;
  }

  refreshToken(): string | null {
    return this.sessionSignal()?.refreshToken ?? null;
  }

  hasPermission(permissionCode: string): boolean {
    return this.permissions().includes(permissionCode);
  }

  ensureValidSession(): boolean {
    return this.isAuthenticated();
  }
}

function isSessionUsable(session: AuthResponse | null): session is AuthResponse {
  if (!session?.accessToken || !session.accessTokenExpiresAt) {
    return false;
  }

  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + tokenExpiryBufferMs;
}

function isProfileUsable(profile: CurrentUserProfile | null): profile is CurrentUserProfile {
  return Boolean(
    profile?.userId &&
    profile.email &&
    profile.fullName &&
    Array.isArray(profile.permissions));
}

function readStoredSession(): AuthResponse | null {
  const storage = getBrowserStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawSession = storage.getItem(sessionStorageKey);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as AuthResponse;
    return isStoredSessionShapeValid(session) ? session : null;
  } catch {
    removeStoredSession();
    return null;
  }
}

function writeStoredSession(session: AuthResponse | null): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  if (!session) {
    removeStoredSession();
    return;
  }

  try {
    storage.setItem(sessionStorageKey, JSON.stringify(session));
  } catch {
    // Keep the in-memory session usable even when browser storage is unavailable.
  }
}

function removeStoredSession(): void {
  try {
    getBrowserStorage()?.removeItem(sessionStorageKey);
  } catch {
    // Storage cleanup is best-effort.
  }
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isStoredSessionShapeValid(session: AuthResponse | null): session is AuthResponse {
  return Boolean(
    session?.userId &&
    session.email &&
    session.fullName &&
    session.refreshToken &&
    session.accessTokenExpiresAt &&
    Array.isArray(session.permissions) &&
    Array.isArray(session.menuItems));
}
