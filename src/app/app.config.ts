import { ApplicationConfig, provideAppInitializer, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { tenantInterceptor } from './core/interceptors/tenant.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { I18nService } from './core/i18n/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([tenantInterceptor, authInterceptor])),
    provideAppInitializer(() => {
      void inject(I18nService).loadCatalog();
    })
  ]
};
