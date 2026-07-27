import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantContextService } from '../tenant/tenant-context.service';

export const tenantInterceptor: HttpInterceptorFn = (request, next) => {
  const tenant = inject(TenantContextService);
  const isAuspiraSuperAdminLogin = request.url.includes('/auth/auspira-super-admin/login');
  const headers: Record<string, string> = {
    'Accept-Language': tenant.cultureCode()
  };

  if (isAuspiraSuperAdminLogin) {
    return next(request.clone({ setHeaders: headers }));
  }

  const tenantCode = tenant.tenantCode().trim();
  if (tenantCode) {
    headers['X-Tenant'] = tenantCode;
  }

  return next(request.clone({ setHeaders: headers }));
};
