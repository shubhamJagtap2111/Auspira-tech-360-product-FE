import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';

export const permissionGuard: CanActivateFn = (route) => {
  const permissionCode = route.data['permission'] as string | undefined;
  const auth = inject(AuthStore);
  const router = inject(Router);

  return !permissionCode || auth.hasPermission(permissionCode) ? true : router.createUrlTree(['/']);
};
