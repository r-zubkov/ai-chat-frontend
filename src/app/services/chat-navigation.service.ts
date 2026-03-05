import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ChatsFacadeService } from './chats/facade.service';
import { SettingsFacadeService } from './settings/facade.service';

@Injectable({ providedIn: 'root' })
export class ChatNavigationService {
  private readonly router = inject(Router);
  private readonly chatsDomain = inject(ChatsFacadeService);
  private readonly settingsDomain = inject(SettingsFacadeService);

  async setupActiveChat(chatId: string | null): Promise<void> {
    this.chatsDomain.setActiveChatId(chatId);
    await this.settingsDomain.syncCurrentModelForChat(chatId);
  }

  navigateToChat(chatId: string | null): void {
    this.router.navigate(['/chats', chatId || 'new']);
  }
}
