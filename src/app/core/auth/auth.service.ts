import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import {
  ApiResponse,
  AuthenticationSession,
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
  VerifyEmailRequest
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);

  login(request: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return firstValueFrom(this.api.post<ApiResponse<AuthResponse>>('/auth/login', request));
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
}
