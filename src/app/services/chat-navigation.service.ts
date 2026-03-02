import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from './app.service';
import { ChatModelService } from './chat-model.service';
import { ChatStore } from './chat.store';

@Injectable({ providedIn: 'root' })
export class ChatNavigationService {
  private readonly chatStore = inject(ChatStore);
  private readonly chatModelService = inject(ChatModelService);
  private readonly appService = inject(AppService);
  private readonly router = inject(Router);

  initializeChat(chatId: string | null): void {
    this.chatStore.setActiveChatId(chatId);
    void this.chatModelService.syncCurrentModelForChat(chatId);

    if (this.appService.isMobile()) {
      this.appService.sidebarOpen.set(false);
    }
  }

  navigateToChat(chatId: string | null): void {
    this.router.navigate(['/chats', chatId || 'new']);
  }
}
