import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiDialogService, TuiIcon, TuiLoader, TuiScrollbar } from '@taiga-ui/core';
import { ChatService } from '../../services/chat.service';
import { TUI_CONFIRM, TuiConfirmData } from '@taiga-ui/kit';
import { ChatState } from '../../types/chat-state';
import { ModelLabelPipe } from '../../pipes/model-label.pipe';

const TuiConfirmText: TuiConfirmData = {
  content: 'Это действие нельзя будет отменить',
  yes: 'Да',
  no: 'Нет',
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    TuiScrollbar,
    TuiIcon,
    TuiLoader,
    ModelLabelPipe
  ],
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
}
