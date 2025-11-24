import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiDialogService, TuiIcon, TuiScrollbar } from '@taiga-ui/core';
import { ChatService } from '../../services/chat.service';
import { ModelType } from '../../types/model-type';
import { getModelLabelByKey } from '../../helpers/get-model-label-by-key';
import { formatTimestamp } from '../../helpers/format-timestamp';
import { ChatMessage } from '../../models/chat.model';
import { AppService } from '../../services/app.service';
import { TUI_CONFIRM, TuiConfirmData } from '@taiga-ui/kit';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, TuiScrollbar, TuiIcon],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.less'],
})
export class SidebarComponent {
  constructor(
    private readonly appServbice: AppService,
    public readonly chatService: ChatService,
    private readonly dialogService: TuiDialogService
  ) {}

  createNewChat(): void  {
    this.chatService.activeChatId.set(null)
    if (this.appServbice.isMobile()) this.appServbice.sidebarOpen.set(false)
  }

  openChat(chatId: string): void {
    this.chatService.activeChatId.set(chatId)
    if (this.appServbice.isMobile()) this.appServbice.sidebarOpen.set(false)
  }

  openClearConfirmationModal(): void {
    const data: TuiConfirmData = {
      content: 'Это действие нельзя будет отменить',
      yes: 'Да',
      no: 'Нет',
    };

    this.dialogService
      .open<boolean>(TUI_CONFIRM, {size: 's', label: 'Вы уверены?', data})
      .subscribe((confirm) => {
        if (confirm) this.chatService.deleteAllChats()
      });
  }

  getModelLabelByKey(key: ModelType): string {
    return getModelLabelByKey(key)
  }

  getLastMsgTime(messages: ChatMessage[]): string {
    return formatTimestamp((messages.at(-1))?.timestamp || 0)
  }
}
