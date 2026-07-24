export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  errors: { code: string; localizationKey: string; field?: string | null }[];
  correlationId: string;
  timestamp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterTenantRequest {
  hospitalName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantCode?: string | null;
  mobileNo?: string | null;
  timeZone?: string | null;
}

export interface TenantRegistrationResponse {
  tenantId: string;
  hospitalId: string;
  tenantCode: string;
  hospitalName: string;
  databaseName: string;
  adminEmail: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  email: string;
  token: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthenticationSession {
  sessionId: string;
  expiresAt: string;
  createdDate: string;
  lastUsedDate: string | null;
  ipAddress: string | null;
  machineName: string | null;
  userAgent: string | null;
}

export interface AuthMenuItem {
  menuCode: string;
  menuNameKey: string;
  routePath: string | null;
  permissions: string[];
}

export interface AuthResponse {
  userId: string;
  email: string;
  fullName: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  permissions: string[];
  roleCodes?: string[];
  menuItems: AuthMenuItem[];
}
