import { Injectable, signal } from '@angular/core';
import { getCssValue } from '../helpers/get-css-value';

@Injectable({
  providedIn: 'root',
})
export class AppUiService {
  readonly sidebarOpen = signal<boolean>(true);
  readonly isMobile = signal<boolean>(false);

  updateMobileState(width: number): void {
    const mobileBP = parseFloat(getCssValue('--grid-lg'));
    this.isMobile.set(width <= mobileBP);

    if (this.isMobile()) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  openSidebar(): void {
    if (!this.sidebarOpen()) this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    if (this.sidebarOpen()) this.sidebarOpen.set(false);
  }

  closeSidebarOnMobile(): void {
    if (this.isMobile()) {
      this.closeSidebar();
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }
}
