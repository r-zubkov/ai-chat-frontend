import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AppStateService {
  private initialDataPromise: Promise<boolean> | null = null;

  registerInitialDataLoad(promise: Promise<void>): void {
    if (this.initialDataPromise) {
      return;
    }

    this.initialDataPromise = promise.then(() => true);
  }

  getInitialDataGuardResult(): boolean | Promise<boolean> {
    return this.initialDataPromise ?? true;
  }
}
