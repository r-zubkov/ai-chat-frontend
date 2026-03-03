import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { LocalStorageMigrationService } from './services/local-storage-migration.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAppInitializer(() => {
      const localStorageMigrationService = inject(LocalStorageMigrationService);
      return localStorageMigrationService.migrateIfNeeded();
    }),
  ],
};
