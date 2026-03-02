import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ChatModelService } from './chat-model.service';
import { ChatStore } from './chat.store';

@Injectable({ providedIn: 'root' })
export class ChatNavigationService {
  private readonly chatStore = inject(ChatStore);
  private readonly chatModelService = inject(ChatModelService);
  private readonly router = inject(Router);

  async initializeChat(chatId: string | null): Promise<void> {
    this.chatStore.setActiveChatId(chatId);
    await this.chatModelService.syncCurrentModelForChat(chatId);
  }

  navigateToChat(chatId: string | null): void {
    this.router.navigate(['/chats', chatId || 'new']);
  }
}
