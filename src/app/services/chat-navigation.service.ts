import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ChatModelService } from './chat-model.service';
import { ChatsStore } from './chats/chats.store';

@Injectable({ providedIn: 'root' })
export class ChatNavigationService {
  private readonly router = inject(Router);
  private readonly chatsStore = inject(ChatsStore);
  private readonly chatModelService = inject(ChatModelService);

  async setupActiveChat(chatId: string | null): Promise<void> {
    this.chatsStore.setActiveChatId(chatId);
    await this.chatModelService.syncCurrentModelForChat(chatId);
  }

  navigateToChat(chatId: string | null): void {
    this.router.navigate(['/chats', chatId || 'new']);
  }
}
