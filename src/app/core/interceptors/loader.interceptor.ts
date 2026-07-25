import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { AppLoaderService } from '../../shared/ui/app-loader/app-loader.service';

export const SKIP_GLOBAL_LOADER = new HttpContextToken<boolean>(() => false);

export const loaderInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_GLOBAL_LOADER)) {
    return next(request);
  }

  const loader = inject(AppLoaderService);
  loader.show();

  return next(request).pipe(finalize(() => loader.hide()));
};
