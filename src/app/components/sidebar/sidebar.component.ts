import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TuiAlertService,
  TuiDataList,
  TuiDialogService,
  TuiDropdown,
  TuiIcon,
  TuiLoader,
  TuiScrollbar,
} from '@taiga-ui/core';
import { ChatService } from '../../services/chat.service';
import { TUI_CONFIRM, TuiConfirmData } from '@taiga-ui/kit';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { ModelLabelPipe } from '../../pipes/model-label.pipe';
import { TuiObscured } from '@taiga-ui/cdk/directives/obscured';
import { TuiActiveZone } from '@taiga-ui/cdk/directives/active-zone';
import { ChangeChatNameModal } from '../change-chat-name-modal/change-chat-name-modal';
import { Chat, ChatState } from '../../types/chat';
import { take } from 'rxjs';
import { RouterLink } from '@angular/router';

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
    RouterLink,
    TuiScrollbar,
    TuiDataList,
    TuiDropdown,
    TuiActiveZone,
    TuiObscured,
    TuiIcon,
    TuiLoader,
    ModelLabelPipe,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly openItems = new Set<string | number>();

  private readonly alerts = inject(TuiAlertService);
  private readonly dialogs = inject(TuiDialogService);

  protected readonly ChatState = ChatState;

  constructor(
    public readonly chatService: ChatService,
    private readonly dialogService: TuiDialogService,
  ) {}

  protected createNewChat(): void {
    this.chatService.navigateToChat(null);
  }

  protected handleOpenItemOptionsDropdown(chatId: string): void {
    this.openItemOptionsDropdown(chatId);
  }

  protected handleRenameChat(chat: Chat): void {
    this.hideItemOptionsDropdown();

    this.dialogs
      .open<string>(new PolymorpheusComponent(ChangeChatNameModal), {
        appearance: 'chatModal',
        label: 'Переименовать чат',
        size: 'm',
        data: chat.title,
      })
      .subscribe((title: string) => {
        if (!title.trim()) {
          this.alerts
            .open('Название не может быть короче 1 символа', { appearance: 'negative' })
            .pipe(take(1))
            .subscribe();
          return;
        }
        this.chatService.updateChat(chat.id, { title }, false);
      });
  }

  protected handleDeleteChat(chat: Chat): void {
    this.hideItemOptionsDropdown();

    this.dialogService
      .open<boolean>(TUI_CONFIRM, { size: 's', label: 'Удалить чат?', data: TuiConfirmText })
      .subscribe((confirm) => {
        if (confirm) {
          this.chatService.deleteChat(chat.id);
          this.chatService.navigateToChat(null);
        }
      });
  }

  protected handleOpenClearConfirmationModal(): void {
    this.dialogService
      .open<boolean>(TUI_CONFIRM, { size: 's', label: 'Очистить историю?', data: TuiConfirmText })
      .subscribe((confirm) => {
        if (confirm) {
          this.chatService.deleteAllChats();
          this.chatService.navigateToChat(null);
        }
      });
  }

  protected onObscured(obscured: boolean): void {
    if (obscured) {
      this.hideItemOptionsDropdown();
    }
  }

  protected onActiveZone(active: boolean): void {
    if (!active) {
      this.hideItemOptionsDropdown();
    }
  }

  protected isItemOptionsDropdownOpen(chatId: string): boolean {
    return this.openItems.has(chatId);
  }

  private openItemOptionsDropdown(chatId: string): void {
    if (this.openItems.has(chatId)) return;

    this.openItems.clear();
    this.openItems.add(chatId);
  }

  private hideItemOptionsDropdown(): void {
    this.openItems.clear();
  }
}
