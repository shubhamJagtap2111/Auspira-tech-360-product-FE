import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { AuthService } from '../auth/auth.service';
import { AppLoaderService } from '../../shared/ui/app-loader/app-loader.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const authService = inject(AuthService);
  const router = inject(Router);
  const loader = inject(AppLoaderService);

  if (auth.ensureValidSession()) {
    loader.reset();
    return true;
  }

  try {
    auth.setProfile(await authService.getCurrentUser());
    return true;
  } catch {
    auth.clearSession();
    return router.createUrlTree(['/auth/login']);
  } finally {
    loader.reset();
  }
};
