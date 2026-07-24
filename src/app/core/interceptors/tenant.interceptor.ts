import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantContextService } from '../tenant/tenant-context.service';

export const tenantInterceptor: HttpInterceptorFn = (request, next) => {
  const tenant = inject(TenantContextService);
  const isAuspiraSuperAdminLogin = request.url.includes('/auth/auspira-super-admin/login');

  if (isAuspiraSuperAdminLogin) {
    return next(
      request.clone({
        setHeaders: {
          'Accept-Language': tenant.cultureCode()
        }
      })
    );
  }

  return next(
    request.clone({
      setHeaders: {
        'X-Tenant': tenant.tenantCode(),
        'Accept-Language': tenant.cultureCode()
      }
    })
  );
};
