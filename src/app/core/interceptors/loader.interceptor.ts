import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { AppLoaderService } from '../../shared/ui/app-loader/app-loader.service';

export const SKIP_GLOBAL_LOADER = new HttpContextToken<boolean>(() => false);
export const REQUEST_TIMEOUT_MS = new HttpContextToken<number>(() => 30_000);
const requestTimeoutMs = 30_000;

export const loaderInterceptor: HttpInterceptorFn = (request, next) => {
  const timeoutMs = request.context.get(REQUEST_TIMEOUT_MS) || requestTimeoutMs;

  if (request.context.get(SKIP_GLOBAL_LOADER)) {
    return next(request).pipe(timeout({ each: timeoutMs }));
  }

  const loader = inject(AppLoaderService);
  loader.show();

  return next(request).pipe(
    timeout({ each: timeoutMs }),
    finalize(() => loader.hide())
  );
};
