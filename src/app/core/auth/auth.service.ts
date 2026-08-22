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

  login(request: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return firstValueFrom(this.api.post<ApiResponse<AuthResponse>>('/auth/login', {
      ...request,
      tenantCode: request.tenantCode ?? (this.tenantContext.tenantCode() || null)
    }));
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

  getCurrentUser(): Promise<CurrentUserProfile> {
    return firstValueFrom(this.api.get<CurrentUserProfile>('/auth/me', {
      context: authBootstrapContext()
    }));
  }

  updateCurrentUser(request: UpdateCurrentUserRequest): Promise<ApiResponse<CurrentUserProfile>> {
    return firstValueFrom(this.api.put<ApiResponse<CurrentUserProfile>>('/auth/me', request));
  }
}

function authBootstrapContext(): HttpContext {
  return new HttpContext()
    .set(SKIP_GLOBAL_LOADER, true)
    .set(REQUEST_TIMEOUT_MS, 10_000);
}
