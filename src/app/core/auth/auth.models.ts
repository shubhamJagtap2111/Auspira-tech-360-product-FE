export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  errors: { code: string; localizationKey: string; field?: string | null }[];
  correlationId: string | null;
  timestamp: string;
  traceId?: string | null;
  requestId?: string | null;
  problem?: ApiProblemDetails | null;
}

export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
  tenantCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
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
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
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
  tenantCode?: string | null;
  hospitalName?: string | null;
}

export interface CurrentUserProfile {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  tenantCode: string;
  permissions: string[];
  roleCodes: string[];
  mobileNo: string | null;
  profileImagePath: string | null;
  profileImageFileName: string | null;
  profileImageContentType: string | null;
  hospitalGuid: string | null;
  hospitalName: string | null;
  branchCode: string | null;
  branchNameKey: string | null;
  departmentCode: string | null;
  departmentNameKey: string | null;
  languageCode: string | null;
  languageName: string | null;
  timeZoneCode: string | null;
  timeZoneNameKey: string | null;
  isEmailVerified: boolean;
  emailVerifiedDate: string | null;
  lastLoginDate: string | null;
  passwordChangedDate: string | null;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  themeMode: string;
  desktopNotificationsEnabled: boolean;
  emailDigestEnabled: boolean;
  autoDetectLanguageEnabled: boolean;
  rowVersion: string;
}

export interface UpdateCurrentUserRequest {
  fullName: string;
  mobileNo: string | null;
  languageCode: string | null;
  timeZoneCode: string | null;
  rowVersion: string;
  themeMode?: string | null;
  desktopNotificationsEnabled?: boolean | null;
  emailDigestEnabled?: boolean | null;
  autoDetectLanguageEnabled?: boolean | null;
}
