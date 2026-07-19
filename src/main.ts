import { bootstrapApplication } from '@angular/platform-browser';
import { AppShellComponent } from './app/layout/shell/app-shell.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppShellComponent, appConfig).catch((error: unknown) => {
  console.error(error);
});
