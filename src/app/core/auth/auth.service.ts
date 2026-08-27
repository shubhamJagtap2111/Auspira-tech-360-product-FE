import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { API_BASE_URL } from '../http/api-endpoints';
import { REQUEST_TIMEOUT_MS, SKIP_GLOBAL_LOADER } from '../interceptors/loader.interceptor';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  ApiResponse,
  AuthenticationSession,
  AuthResponse,
  ChangePasswordRequest,
  CurrentUserProfile,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
  UpdateCurrentUserRequest,
  VerifyEmailRequest
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly tenantContext = inject(TenantContextService);

  async login(request: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const location = await getBrowserLocation(900);
    return firstValueFrom(this.api.post<ApiResponse<AuthResponse>>('/auth/login', {
      ...request,
      ...location,
      tenantCode: request.tenantCode ?? (this.tenantContext.tenantCode() || null)
    }, {
      context: authLoginContext()
    }));
  }

  async warmUpApi(): Promise<void> {
    await firstValueFrom(this.api.get<ApiResponse<unknown>>('/health', {
      context: authWarmupContext()
    })).catch(() => undefined);
  }

  startGoogleLogin(rememberMe = true): void {
    const params = new URLSearchParams({
      rememberMe: String(rememberMe),
      redirectUri: `${window.location.origin}/auth/google-callback`
    });
    const tenantCode = this.tenantContext.tenantCode();
    if (tenantCode) {
      params.set('tenantCode', tenantCode);
    }
    window.location.href = `${this.apiBaseUrl}/auth/external/google/login?${params.toString()}`;
  }

  refresh(request: RefreshTokenRequest): Promise<ApiResponse<AuthResponse>> {
    return firstValueFrom(this.api.post<ApiResponse<AuthResponse>>('/auth/refresh', request));
  }

  logout(refreshToken: string): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.post<ApiResponse<{ accepted: boolean }>>('/auth/logout', { refreshToken }));
  }

  forgotPassword(request: ForgotPasswordRequest): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.post<ApiResponse<{ accepted: boolean }>>('/auth/forgot-password', request));
  }

  resetPassword(request: ResetPasswordRequest): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.post<ApiResponse<{ accepted: boolean }>>('/auth/reset-password', request));
  }

  verifyEmail(request: VerifyEmailRequest): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.post<ApiResponse<{ accepted: boolean }>>('/auth/verify-email', request));
  }

  changePassword(request: ChangePasswordRequest): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.post<ApiResponse<{ accepted: boolean }>>('/auth/change-password', request));
  }

  getSessions(): Promise<ApiResponse<AuthenticationSession[]>> {
    return firstValueFrom(this.api.get<ApiResponse<AuthenticationSession[]>>('/auth/sessions'));
  }

  revokeSession(sessionId: string): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.delete<ApiResponse<{ accepted: boolean }>>(`/auth/sessions/${sessionId}`));
  }

  forceLogout(userId: string): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.post<ApiResponse<{ accepted: boolean }>>(`/auth/users/${userId}/force-logout`, {}));
  }

  unlockAccount(userId: string): Promise<ApiResponse<{ accepted: boolean }>> {
    return firstValueFrom(this.api.post<ApiResponse<{ accepted: boolean }>>(`/auth/users/${userId}/unlock`, {}));
  }

  async getCurrentUser(): Promise<CurrentUserProfile> {
    const response = await firstValueFrom(this.api.get<ApiResponse<CurrentUserProfile> | CurrentUserProfile>('/auth/me', {
      context: authBootstrapContext()
    }));
    if (isCurrentUserProfile(response)) {
      return response;
    }

    if (!isApiResponse<CurrentUserProfile>(response) || !response.success || !isCurrentUserProfile(response.data)) {
      throw new Error(response.message || 'Auth.Errors.CurrentUserUnavailable');
    }

    return response.data;
  }

  updateCurrentUser(request: UpdateCurrentUserRequest): Promise<ApiResponse<CurrentUserProfile>> {
    return firstValueFrom(this.api.put<ApiResponse<CurrentUserProfile>>('/auth/me', request));
  }

  uploadCurrentUserProfileImage(fileName: string, contentType: string, base64Content: string): Promise<ApiResponse<CurrentUserProfile>> {
    return firstValueFrom(this.api.put<ApiResponse<CurrentUserProfile>>('/auth/me/profile-image', { fileName, contentType, base64Content }));
  }
}

function authBootstrapContext(): HttpContext {
  return new HttpContext()
    .set(SKIP_GLOBAL_LOADER, true)
    .set(REQUEST_TIMEOUT_MS, 10_000);
}

function authLoginContext(): HttpContext {
  return new HttpContext()
    .set(SKIP_GLOBAL_LOADER, true)
    .set(REQUEST_TIMEOUT_MS, 90_000);
}

function authWarmupContext(): HttpContext {
  return new HttpContext()
    .set(SKIP_GLOBAL_LOADER, true)
    .set(REQUEST_TIMEOUT_MS, 8_000);
}

function isCurrentUserProfile(value: unknown): value is CurrentUserProfile {
  const profile = value as Partial<CurrentUserProfile> | null;
  return Boolean(
    profile &&
    typeof profile.userId === 'string' &&
    typeof profile.email === 'string' &&
    typeof profile.fullName === 'string' &&
    Array.isArray(profile.permissions));
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'success' in value &&
    'data' in value &&
    'message' in value);
}

function getBrowserLocation(timeoutMs: number): Promise<Pick<LoginRequest, 'latitude' | 'longitude' | 'locationName'>> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({});
  }

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: Number(position.coords.latitude.toFixed(7)),
        longitude: Number(position.coords.longitude.toFixed(7)),
        locationName: null
      }),
      () => resolve({}),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: timeoutMs }
    );
  });
}
