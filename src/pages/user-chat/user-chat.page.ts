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
import { TuiButton, TuiScrollbar } from '@taiga-ui/core';
import { ChatState, ChatStore, toChatId } from '@entities/chat';
import { ChatMessage, ChatMessageRole, MessageStore } from '@entities/message';
import { ManageChatService } from '@features/manage-chat';
import { SendMessageEvent, SendMessageEventType, SendMessageService } from '@features/send-message';
import { SelectModelService } from '@features/select-model';
import {
  ChatNavigationService,
  getCssValue,
  handleCodeBlockCopyClick,
  handleCodeBlockCopyKeydown,
  remToPx,
} from '@shared/helpers';
import { CopyTextButtonComponent, MarkdownPipe, ModelLabelPipe } from '@shared';
import { ChatInputComponent } from '@widgets/chat-input';
import { AppUiService } from '@app/app-ui.service';

@Component({
  selector: 'app-user-chat-page',
  imports: [
    MarkdownPipe,
    TuiScrollbar,
    TuiButton,
    CopyTextButtonComponent,
    ChatInputComponent,
    ModelLabelPipe,
  ],
  templateUrl: './user-chat.page.html',
  styleUrl: './user-chat.page.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserChatPage {
  private readonly destroyRef = inject(DestroyRef);

  readonly chatStore = inject(ChatStore);
  readonly messageStore = inject(MessageStore);
  readonly manageChat = inject(ManageChatService);

  private readonly sendMessageService = inject(SendMessageService);
  private readonly selectModel = inject(SelectModelService);
  private readonly chatNavigation = inject(ChatNavigationService);
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
  protected readonly ChatMessageRole = ChatMessageRole;

  protected onSendMessage(text: string): void {
    this.send(text, this.messageStore.messages());
  }

  protected onCancelRequest(): void {
    const requestId = this.chatStore.activeChat()?.currentRequestId;
    if (!requestId) return;

    this.sendMessageService.stopRequest(requestId);
  }

  protected retryLasRequest(): void {
    const messages = this.messageStore.messages();
    const lastUserMsg = messages.filter((msg) => msg.role === ChatMessageRole.USER).at(-1);

    if (!lastUserMsg) return;

    this.send(lastUserMsg.content, messages);
  }

  protected handleRequestEvent(event: SendMessageEvent): void {
    if (event.type === SendMessageEventType.SENT) {
      setTimeout(() => this.scrollToBottom('smooth'), 50);
    }
  }

  protected onCodeBlockCopyClick(event: MouseEvent): void {
    handleCodeBlockCopyClick(event);
  }

  protected onCodeBlockCopyKeydown(event: KeyboardEvent): void {
    handleCodeBlockCopyKeydown(event);
  }

  private send(text: string, messageHistory: ChatMessage[]): void {
    this.sendMessageService
      .sendMessage(text, messageHistory)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.handleRequestEvent(event),
        error: (err) => console.error('Error sending message:', err),
      });
  }

  private async loadMessages(
    chatId = this.chatStore.activeChatId(),
    scrollEffect: 'instant' | 'smooth' | null = null,
  ): Promise<void> {
    if (!chatId) {
      this.messageStore.clearMessages();
      return;
    }

    const hasChat = await this.chatStore.ensureChatLoaded(chatId);

    if (chatId !== this.chatStore.activeChatId()) {
      return;
    }

    if (!hasChat) {
      await this.chatNavigation.navigateToNewChat();
      return;
    }

    this.selectModel.syncCurrentModelForChat(chatId);

    await this.messageStore.loadByChatId(chatId);

    if (chatId !== this.chatStore.activeChatId()) {
      return;
    }

    if (scrollEffect) {
      setTimeout(() => this.scrollToBottom(scrollEffect), 50);
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
