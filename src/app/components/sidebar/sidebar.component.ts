import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiDialogService, TuiIcon, TuiLoader, TuiScrollbar } from '@taiga-ui/core';
import { ChatService } from '../../services/chat.service';
import { ModelType } from '../../types/model-type';
import { getModelLabelByKey } from '../../helpers/get-model-label-by-key';
import { formatTimestamp } from '../../helpers/format-timestamp';
import { ChatMessage } from '../../models/chat.model';
import { TUI_CONFIRM, TuiConfirmData } from '@taiga-ui/kit';
import { ChatState } from '../../types/chat-state';

const TuiConfirmText: TuiConfirmData = {
  content: 'Это действие нельзя будет отменить',
  yes: 'Да',
  no: 'Нет',
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, TuiScrollbar, TuiIcon, TuiLoader],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.less'],
})
export class SidebarComponent {
  protected readonly ChatState = ChatState;
  
  constructor(
    public readonly chatService: ChatService,
    private readonly dialogService: TuiDialogService
  ) {}

  createNewChat(): void  {
    this.chatService.navigateToChat(null)
  }

  openChat(chatId: string): void {
    this.chatService.navigateToChat(chatId)
  }

  deleteChat(event: MouseEvent, chatId: string): void {
    event.stopPropagation();

    this.dialogService
      .open<boolean>(TUI_CONFIRM, {size: 's', label: 'Удалить чат?', data: TuiConfirmText})
      .subscribe((confirm) => {
        if (confirm) this.chatService.deleteChat(chatId)
      });
  }

  openClearConfirmationModal(): void {
    this.dialogService
      .open<boolean>(TUI_CONFIRM, {size: 's', label: 'Очистить историю?', data: TuiConfirmText})
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
