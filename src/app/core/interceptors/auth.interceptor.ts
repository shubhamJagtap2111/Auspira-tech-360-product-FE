import { HttpInterceptorFn } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiResponse, AuthResponse } from '../auth/auth.models';
import { AuthStore } from '../auth/auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const http = inject(HttpClient);
  const token = authStore.accessToken();

  if (!token || request.url.includes('/auth/refresh')) {
    return next(request);
  }

  const authorizedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authorizedRequest).pipe(
    catchError(error => {
      const refreshToken = authStore.refreshToken();

      if (error.status !== 401 || !refreshToken) {
        return throwError(() => error);
      }

      return http.post<ApiResponse<AuthResponse>>('/api/v1/auth/refresh', { refreshToken }).pipe(
        switchMap(response => {
          if (!response.success || !response.data) {
            authStore.clearSession();
            return throwError(() => error);
          }

          authStore.setSession(response.data);
          return next(request.clone({
            setHeaders: {
              Authorization: `Bearer ${response.data.accessToken}`
            }
          }));
        }),
        catchError(refreshError => {
          authStore.clearSession();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
