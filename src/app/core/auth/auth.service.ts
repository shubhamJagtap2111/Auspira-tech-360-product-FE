import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { API_BASE_URL } from '../http/api-endpoints';
import {
  ApiResponse,
  AuthenticationSession,
  AuthResponse,
  ChangePasswordRequest,
  CurrentUserProfile,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterTenantRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
  TenantRegistrationResponse,
  UpdateCurrentUserRequest,
  VerifyEmailRequest
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  login(request: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return firstValueFrom(this.api.post<ApiResponse<AuthResponse>>('/auth/login', request));
  }

  auspiraSuperAdminLogin(request: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return firstValueFrom(this.api.post<ApiResponse<AuthResponse>>('/auth/auspira-super-admin/login', request));
  }

  register(request: RegisterTenantRequest): Promise<ApiResponse<TenantRegistrationResponse>> {
    return firstValueFrom(this.api.post<ApiResponse<TenantRegistrationResponse>>('/auth/register', request));
  }

  startGoogleLogin(rememberMe = true, tenantCode?: string | null): void {
    const params = new URLSearchParams({
      rememberMe: String(rememberMe),
      redirectUri: `${window.location.origin}/auth/google-callback`
    });
    if (tenantCode?.trim()) {
      params.set('tenantCode', tenantCode.trim());
    }

    window.location.href = `${this.apiBaseUrl}/auth/external/google/login?${params.toString()}`;
  }

  startGoogleRegistration(request: Pick<RegisterTenantRequest, 'hospitalName' | 'timeZone'>): void {
    const params = new URLSearchParams({
      hospitalName: request.hospitalName,
      timeZone: request.timeZone ?? 'Asia/Kolkata',
      redirectUri: `${window.location.origin}/auth/google-callback`
    });
    window.location.href = `${this.apiBaseUrl}/auth/external/google/register?${params.toString()}`;
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
    return firstValueFrom(this.api.get<CurrentUserProfile>('/auth/me'));
  }

  updateCurrentUser(request: UpdateCurrentUserRequest): Promise<ApiResponse<CurrentUserProfile>> {
    return firstValueFrom(this.api.put<ApiResponse<CurrentUserProfile>>('/auth/me', request));
  }
}
