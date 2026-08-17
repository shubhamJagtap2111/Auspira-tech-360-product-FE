import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../http/api-endpoints';
import { LocaleContextService } from '../i18n/locale-context.service';

export const localeInterceptor: HttpInterceptorFn = (request, next) => {
  const locale = inject(LocaleContextService);
  const apiBaseUrl = inject(API_BASE_URL);
  const isExternalRequest = /^https?:\/\//i.test(request.url) && !request.url.startsWith(apiBaseUrl);
  if (isExternalRequest) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: { 'Accept-Language': locale.cultureCode() }
  }));
};
