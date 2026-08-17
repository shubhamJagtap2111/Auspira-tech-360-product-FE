import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (auth.ensureValidSession()) {
    return true;
  }

  try {
    auth.setProfile(await authService.getCurrentUser());
    return true;
  } catch {
    auth.clearSession();
    return router.createUrlTree(['/auth/login']);
  }
};
