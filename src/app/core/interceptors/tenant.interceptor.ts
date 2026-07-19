import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantContextService } from '../tenant/tenant-context.service';

export const tenantInterceptor: HttpInterceptorFn = (request, next) => {
  const tenant = inject(TenantContextService);

  return next(
    request.clone({
      setHeaders: {
        'X-Tenant-Id': tenant.tenantId(),
        'Accept-Language': tenant.cultureCode()
      }
    })
  );
};
