import { Injectable, computed, signal } from '@angular/core';
import { AuthResponse } from './auth.models';

const storageKey = 'care360.auth';
const tokenExpiryBufferMs = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly sessionSignal = signal<AuthResponse | null>(readSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => isSessionUsable(this.sessionSignal()));
  readonly permissions = computed(() => this.sessionSignal()?.permissions ?? []);

  setSession(session: AuthResponse): void {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  clearSession(): void {
    window.localStorage.removeItem(storageKey);
    this.sessionSignal.set(null);
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
    if (this.isAuthenticated()) {
      return true;
    }

    if (this.sessionSignal()) {
      this.clearSession();
    }

    return false;
  }
}

function readSession(): AuthResponse | null {
  const value = window.localStorage.getItem(storageKey);
  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as AuthResponse;
    if (!isSessionUsable(session)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function isSessionUsable(session: AuthResponse | null): session is AuthResponse {
  if (!session?.accessToken || !session.accessTokenExpiresAt) {
    return false;
  }

  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + tokenExpiryBufferMs;
}
