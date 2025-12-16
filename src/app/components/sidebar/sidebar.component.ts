import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiDataList, TuiDialogService, TuiDropdown, TuiIcon, TuiLoader, TuiScrollbar } from '@taiga-ui/core';
import { ChatService } from '../../services/chat.service';
import { TUI_CONFIRM, TuiConfirmData } from '@taiga-ui/kit';
import { ChatState } from '../../types/chat-state';
import { ModelLabelPipe } from '../../pipes/model-label.pipe';
import { TuiObscured } from '@taiga-ui/cdk/directives/obscured';
import { TuiActiveZone } from '@taiga-ui/cdk/directives/active-zone';

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
    TuiDataList,
    TuiDropdown,
    TuiActiveZone,
    TuiObscured,
    TuiIcon,
    TuiLoader,
    ModelLabelPipe
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.less'],
})
export class SidebarComponent {
  private readonly openItems = new Set<string | number>();

  protected readonly ChatState = ChatState;

  constructor(
    public readonly chatService: ChatService,
    private readonly dialogService: TuiDialogService
  ) {}

  protected createNewChat(): void  {
    this.chatService.navigateToChat(null)
  }

  protected openChat(chatId: string): void {
    this.chatService.navigateToChat(chatId)
  }

  protected handleOpenItemOptionsDropdown(event: MouseEvent, chatId: string): void {
    event.stopPropagation();
    
    this.openItemOptionsDropdown(chatId)
  }

  protected handleDeleteChat(chatId: string): void {
    this.hideItemOptionsDropdown()

    this.dialogService
      .open<boolean>(TUI_CONFIRM, {size: 's', label: 'Удалить чат?', data: TuiConfirmText})
      .subscribe((confirm) => {
        if (confirm) this.chatService.deleteChat(chatId)
      });
  }

  protected handleRenameChat(chatId: string): void {
    this.hideItemOptionsDropdown()
  }

  protected  handleOpenClearConfirmationModal(): void {
    this.dialogService
      .open<boolean>(TUI_CONFIRM, {size: 's', label: 'Очистить историю?', data: TuiConfirmText})
      .subscribe((confirm) => {
        if (confirm) this.chatService.deleteAllChats()
      });
  }

  protected onObscured(obscured: boolean): void {
    if (obscured) {
      this.hideItemOptionsDropdown()
    }
  }
 
  protected onActiveZone(active: any): void {
    if (!active) {
      this.hideItemOptionsDropdown()
    }
  }

  protected isItemOptionsDropdownOpen(chatId: string): boolean {
    return this.openItems.has(chatId)
  }

  private openItemOptionsDropdown(chatId: string): void {
    if (this.openItems.has(chatId)) return

    this.openItems.clear();
    this.openItems.add(chatId);
  }

  private hideItemOptionsDropdown(): void {
    this.openItems.clear();
  }
}
