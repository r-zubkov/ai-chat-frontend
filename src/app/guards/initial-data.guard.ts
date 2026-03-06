import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AppStateService } from '../services/app-state.service';

export const initialDataGuard: CanMatchFn = () => {
  const appState = inject(AppStateService);
  return appState.getInitialDataGuardResult();
};
