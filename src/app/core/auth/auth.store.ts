import { Injectable, computed, signal } from '@angular/core';
import { AuthResponse, CurrentUserProfile } from './auth.models';

const tokenExpiryBufferMs = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly sessionSignal = signal<AuthResponse | null>(null);
  private readonly profileSignal = signal<CurrentUserProfile | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly isAuthenticated = computed(() => isSessionUsable(this.sessionSignal()) || this.profileSignal() !== null);
  readonly permissions = computed(() => this.sessionSignal()?.permissions ?? this.profileSignal()?.permissions ?? []);

  setSession(session: AuthResponse): void {
    this.sessionSignal.set(session);
    this.profileSignal.set(null);
  }

  setProfile(profile: CurrentUserProfile): void {
    this.profileSignal.set(profile);
    this.sessionSignal.set(null);
  }

  clearSession(): void {
    this.sessionSignal.set(null);
    this.profileSignal.set(null);
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
