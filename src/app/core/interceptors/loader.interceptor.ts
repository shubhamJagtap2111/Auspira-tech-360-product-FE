import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { AppLoaderService } from '../../shared/ui/app-loader/app-loader.service';

export const SKIP_GLOBAL_LOADER = new HttpContextToken<boolean>(() => false);
const requestTimeoutMs = 30_000;

export const loaderInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_GLOBAL_LOADER)) {
    return next(request).pipe(timeout({ each: requestTimeoutMs }));
  }

  const loader = inject(AppLoaderService);
  loader.show();

  return next(request).pipe(
    timeout({ each: requestTimeoutMs }),
    finalize(() => loader.hide())
  );
};
