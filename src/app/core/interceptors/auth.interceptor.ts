import { HttpInterceptorFn } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiResponse, AuthResponse } from '../auth/auth.models';
import { AuthStore } from '../auth/auth.store';
import { API_BASE_URL } from '../http/api-endpoints';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const http = inject(HttpClient);
  const apiBaseUrl = inject(API_BASE_URL);
  const token = authStore.accessToken();
  const isExternalRequest = /^https?:\/\//i.test(request.url) && !request.url.startsWith(apiBaseUrl);

  if (isExternalRequest || isAnonymousAuthRequest(request.url) || request.url.includes('/auth/refresh')) {
    return next(request);
  }

  const authorizedRequest = token
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        },
        withCredentials: true
      })
    : request.clone({ withCredentials: true });

  return next(authorizedRequest).pipe(
    catchError(error => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      return http.post<ApiResponse<AuthResponse>>(`${apiBaseUrl}/auth/refresh`, { refreshToken: authStore.refreshToken() ?? '' }, { withCredentials: true }).pipe(
        switchMap(response => {
          if (!response.success || !response.data) {
            authStore.clearSession();
            return throwError(() => error);
          }

          authStore.setSession(response.data);
          return next(response.data.accessToken
            ? request.clone({
                setHeaders: {
                  Authorization: `Bearer ${response.data.accessToken}`
                },
                withCredentials: true
              })
            : request.clone({ withCredentials: true }));
        }),
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
