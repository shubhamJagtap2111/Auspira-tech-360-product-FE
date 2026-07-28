import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../http/api-endpoints';
import { TenantContextService } from '../tenant/tenant-context.service';

export const tenantInterceptor: HttpInterceptorFn = (request, next) => {
  const tenant = inject(TenantContextService);
  const apiBaseUrl = inject(API_BASE_URL);
  const isExternalRequest = /^https?:\/\//i.test(request.url) && !request.url.startsWith(apiBaseUrl);
  if (isExternalRequest) {
    return next(request);
  }

  const headers: Record<string, string> = {
    'Accept-Language': tenant.cultureCode()
  };

  if (isAnonymousAuthRequest(request.url)) {
    return next(request.clone({ setHeaders: headers }));
  }

  const tenantCode = tenant.tenantCode().trim();
  if (tenantCode) {
    headers['X-Tenant'] = tenantCode;
  }

  return next(request.clone({ setHeaders: headers }));
};

function isAnonymousAuthRequest(url: string): boolean {
  return [
    '/auth/login',
    '/auth/register',
    '/auth/auspira-super-admin/login',
    '/auth/external/google',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email'
  ].some(path => url.includes(path));
}
