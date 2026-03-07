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
import { TUI_CONFIRM, TuiConfirmData } from '@taiga-ui/kit';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiObscured } from '@taiga-ui/cdk/directives/obscured';
import { TuiActiveZone } from '@taiga-ui/cdk/directives/active-zone';
import { Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { Chat, ChatState, ChatStore } from '@entities/chat';
import { ManageChatService, ChangeChatNameModalComponent } from '@features/manage-chat';
import { ModelLabelPipe } from '@shared/ui';

const TuiConfirmText: TuiConfirmData = {
  content: 'Это действие нельзя будет отменить',
  yes: 'Да',
  no: 'Нет',
};

@Component({
  selector: 'app-chat-sidebar',
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
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSidebarComponent {
  private readonly openItems = new Set<string | number>();

  private readonly alerts = inject(TuiAlertService);
  private readonly dialogs = inject(TuiDialogService);
  readonly chatStore = inject(ChatStore);
  readonly manageChat = inject(ManageChatService);
  private readonly router = inject(Router);

  protected readonly ChatState = ChatState;

  protected handleOpenItemOptionsDropdown(chatId: string): void {
    this.openItemOptionsDropdown(chatId);
  }

  protected handleRenameChat(chat: Chat): void {
    this.hideItemOptionsDropdown();

    this.dialogs
      .open<string>(new PolymorpheusComponent(ChangeChatNameModalComponent), {
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

        void this.manageChat.renameChat(chat.id, title);
      });
  }

  protected handleDeleteChat(chat: Chat): void {
    this.hideItemOptionsDropdown();

    this.dialogs
      .open<boolean>(TUI_CONFIRM, { size: 's', label: 'Удалить чат?', data: TuiConfirmText })
      .subscribe((confirm) => {
        if (confirm) {
          void this.manageChat.deleteChat(chat.id).finally(() => {
            void this.router.navigate(['/chats', 'new']);
          });
        }
      });
  }

  protected handleOpenClearConfirmationModal(): void {
    this.dialogs
      .open<boolean>(TUI_CONFIRM, { size: 's', label: 'Очистить историю?', data: TuiConfirmText })
      .subscribe((confirm) => {
        if (confirm) {
          void this.manageChat.clearAllChats().finally(() => {
            void this.router.navigate(['/chats', 'new']);
          });
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
