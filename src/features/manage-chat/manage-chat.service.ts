import { inject, Injectable } from '@angular/core';
import { ChatId, ChatRepository, ChatStore } from '@entities/chat';

@Injectable({ providedIn: 'root' })
export class ManageChatService {
  private readonly chatRepo = inject(ChatRepository);
  private readonly chatStore = inject(ChatStore);

  async renameChat(id: ChatId, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;

    await this.chatRepo.update(id, { title: trimmed });

    const target = this.chatStore.chats().find((chat) => chat.id === id);
    if (!target) return;

    this.chatStore.upsertChat({
      ...target,
      title: trimmed,
    });
  }

  async deleteChat(id: ChatId): Promise<void> {
    await this.chatRepo.delete(id);
    this.chatStore.removeChat(id);
  }

  async clearChat(id: ChatId): Promise<void> {
    await this.deleteChat(id);
  }

  async clearAllChats(): Promise<void> {
    await this.chatRepo.clear();
    this.chatStore.clearState();
  }
}
