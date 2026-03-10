import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ChatNavigationService {
  private readonly router = inject(Router);

  navigateToChat(chatId: string): Promise<boolean> {
    return this.router.navigate(['/chats', chatId]);
  }

  navigateToNewChat(): Promise<boolean> {
    return this.router.navigate(['/chats', 'new']);
  }
}
