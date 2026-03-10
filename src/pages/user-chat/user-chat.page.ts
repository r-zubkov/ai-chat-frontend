import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TuiButton, TuiScrollbar } from '@taiga-ui/core';
import { ChatState, ChatStore, toChatId } from '@entities/chat';
import { ChatMessageRole, ChatMessageState, MessageStore } from '@entities/message';
import { ManageChatService } from '@features/manage-chat';
import { SendMessageEvent, SendMessageEventType, SendMessageService } from '@features/send-message';
import { SelectModelService } from '@features/select-model';
import { getCssValue, remToPx } from '@shared/helpers';
import { MarkdownPipe, ModelLabelPipe } from '@shared';
import { ChatInputComponent } from '@widgets/chat-input';
import { AppUiService } from '@app/app-ui.service';

@Component({
  selector: 'app-user-chat-page',
  imports: [MarkdownPipe, TuiScrollbar, TuiButton, ChatInputComponent, ModelLabelPipe],
  templateUrl: './user-chat.page.html',
  styleUrl: './user-chat.page.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserChatPage {
  private readonly destroyRef = inject(DestroyRef);

  readonly chatStore = inject(ChatStore);
  readonly messageStore = inject(MessageStore);
  readonly sendMessage = inject(SendMessageService);
  readonly manageChat = inject(ManageChatService);

  private readonly selectModel = inject(SelectModelService);
  private readonly router = inject(Router);
  private readonly appUi = inject(AppUiService);

  @Input() set id(chatId: string) {
    const activeId = toChatId(chatId);
    this.chatStore.setActive(activeId);
    this.selectModel.syncCurrentModelForChat(activeId);
    this.appUi.closeSidebarOnMobile();
    void this.loadMessages(activeId, 'instant');
  }

  @ViewChild(TuiScrollbar, { read: ElementRef })
  private readonly scrollBar?: ElementRef<HTMLElement>;

  protected readonly ChatState = ChatState;
  protected readonly ChatMessageState = ChatMessageState;
  protected readonly ChatMessageRole = ChatMessageRole;

  private async loadMessages(
    chatId = this.chatStore.activeChatId(),
    scrollEffect: 'instant' | 'smooth' | null = null,
  ): Promise<void> {
    if (!chatId) {
      this.messageStore.clearMessages();
      return;
    }

    const messages = await this.messageStore.loadByChatId(chatId);

    if (chatId !== this.chatStore.activeChatId()) {
      return;
    }

    if (!messages.length) {
      await this.router.navigate(['/chats', 'new']);
      return;
    }

    if (scrollEffect) {
      setTimeout(() => this.scrollToBottom(scrollEffect), 50);
    }
  }

  protected retryLasRequest(): void {
    const messages = this.messageStore.messages();
    const lastUserMsg = messages.filter((msg) => msg.role === ChatMessageRole.USER).at(-1);

    if (lastUserMsg) {
      this.sendMessage
        .sendMessage(lastUserMsg.content, messages)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (event) => this.handleRequestEvent(event),
          error: (err) => console.error('Error sending message:', err),
        });
    }
  }

  protected handleRequestEvent(event: SendMessageEvent): void {
    if (event.type === SendMessageEventType.SENT) {
      setTimeout(() => this.scrollToBottom('smooth'), 50);
    }
  }

  private scrollToMessage(messageId: string, behavior: ScrollBehavior = 'smooth'): void {
    const container = this.scrollBar?.nativeElement;
    if (!container) return;

    const target = container.querySelector(`[data-id="${messageId}"]`) as HTMLElement | null;
    if (!target) return;

    const messageTopOffset = target.offsetTop;
    const messagesGap = remToPx(parseFloat(getCssValue('--chat-messages-gap')));
    const topOffset = messageTopOffset - messagesGap;

    this.scrollTo(container, topOffset, behavior);
  }

  private scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
    const container = this.scrollBar?.nativeElement;
    if (!container) return;

    this.scrollTo(container, container.scrollHeight, behavior);
  }

  private scrollTo(container: HTMLElement, top: number, behavior: ScrollBehavior = 'auto'): void {
    container.scrollTo({
      top,
      behavior,
    });
  }
}
