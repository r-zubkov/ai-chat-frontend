import { inject, Injectable } from '@angular/core';
import { ChatId, ChatRepository, ChatStore } from '@entities/chat';

@Injectable({ providedIn: 'root' })
export class ManageChatService {
  private readonly chatRepository = inject(ChatRepository);
  private readonly chatStore = inject(ChatStore);

  async renameChat(id: ChatId, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;

    await this.chatRepository.update(id, { title: trimmed });

    const target = this.chatStore.chats().find((chat) => chat.id === id);
    if (!target) return;

    this.chatStore.upsertChat({
      ...target,
      title: trimmed,
    });
  }

  async deleteChat(id: ChatId): Promise<void> {
    await this.chatRepository.delete(id);
    this.chatStore.removeChat(id);
  }

  async deleteAllChats(): Promise<void> {
    await this.chatRepository.clear();
    this.chatStore.clearState();
  }
}
