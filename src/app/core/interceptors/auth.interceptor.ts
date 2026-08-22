import { HttpClient, HttpContext, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { ApiResponse, AuthResponse } from '../auth/auth.models';
import { AuthStore } from '../auth/auth.store';
import { selectedBranchStorageKey } from '../context/branch-context.service';
import { API_BASE_URL } from '../http/api-endpoints';
import { REQUEST_TIMEOUT_MS, SKIP_GLOBAL_LOADER } from './loader.interceptor';

let activeRefreshRequest: Observable<AuthResponse> | null = null;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const http = inject(HttpClient);
  const apiBaseUrl = inject(API_BASE_URL);
  const token = authStore.accessToken();
  const isExternalRequest = /^https?:\/\//i.test(request.url) && !request.url.startsWith(apiBaseUrl);

  if (isExternalRequest || isAnonymousAuthRequest(request.url) || request.url.includes('/auth/refresh')) {
    return next(request);
  }

  const authorizedRequest = withAuthentication(request, token);

  return next(authorizedRequest).pipe(
    catchError(error => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      const refreshToken = authStore.refreshToken();
      if (!refreshToken) {
        authStore.clearSession();
        return throwError(() => error);
      }

      activeRefreshRequest ??= http.post<ApiResponse<AuthResponse>>(
          `${apiBaseUrl}/auth/refresh`,
          { refreshToken },
          {
            withCredentials: true,
            context: new HttpContext()
              .set(SKIP_GLOBAL_LOADER, true)
              .set(REQUEST_TIMEOUT_MS, 10_000)
          }).pipe(
          map(response => {
            if (!response.success || !response.data) {
              throw error;
            }

            authStore.setSession(response.data);
            return response.data;
          }),
          finalize(() => {
            activeRefreshRequest = null;
          }),
          shareReplay({ bufferSize: 1, refCount: false })
        );

      return activeRefreshRequest.pipe(
        switchMap(session => next(withAuthentication(request, session.accessToken))),
        catchError(refreshError => {
          authStore.clearSession();
          return throwError(() => refreshError);
        })
      );
    })
  );
};

function isAnonymousAuthRequest(url: string): boolean {
  return [
    '/auth/login',
    '/auth/external/google',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email'
  ].some(path => url.includes(path));
}

function withAuthentication(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  const headers: Record<string, string> = {};
  const branchCode = readSelectedBranchCode();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (branchCode) {
    headers['X-Branch-Code'] = branchCode;
  }

  return request.clone({ setHeaders: headers, withCredentials: true });
}

function readSelectedBranchCode(): string | null {
  try {
    const value = typeof window === 'undefined' ? null : window.localStorage.getItem(selectedBranchStorageKey);
    const trimmed = value?.trim();
    return trimmed ? trimmed.toUpperCase() : null;
  } catch {
    return null;
  }
}
