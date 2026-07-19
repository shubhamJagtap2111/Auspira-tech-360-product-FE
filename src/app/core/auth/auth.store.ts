import { Injectable, computed, signal } from '@angular/core';
import { AuthResponse } from './auth.models';

const storageKey = 'care360.auth';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly sessionSignal = signal<AuthResponse | null>(readSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.sessionSignal()?.accessToken);
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
    return this.sessionSignal()?.accessToken ?? null;
  }

  refreshToken(): string | null {
    return this.sessionSignal()?.refreshToken ?? null;
  }

  hasPermission(permissionCode: string): boolean {
    return this.permissions().includes(permissionCode);
  }
}

function readSession(): AuthResponse | null {
  const value = window.localStorage.getItem(storageKey);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthResponse;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}
