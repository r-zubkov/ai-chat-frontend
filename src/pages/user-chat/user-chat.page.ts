import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiButton, TuiHint, TuiIcon, TuiScrollbar } from '@taiga-ui/core';
import { ChatState, ChatStore, toChatId } from '@entities/chat';
import { ChatMessage, ChatMessageRole, ChatMessageState, MessageStore } from '@entities/message';
import { ManageChatService } from '@features/manage-chat';
import { SendMessageEvent, SendMessageEventType, SendMessageService } from '@features/send-message';
import { SelectModelService } from '@features/select-model';
import { ChatNavigationService, getCssValue, remToPx } from '@shared/helpers';
import { MarkdownPipe, MarkdownService, ModelLabelPipe } from '@shared';
import { ChatInputComponent } from '@widgets/chat-input';
import { AppUiService } from '@app/app-ui.service';

@Component({
  selector: 'app-user-chat-page',
  imports: [
    MarkdownPipe,
    TuiScrollbar,
    TuiButton,
    TuiIcon,
    TuiHint,
    ChatInputComponent,
    ModelLabelPipe,
  ],
  templateUrl: './user-chat.page.html',
  styleUrl: './user-chat.page.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserChatPage {
  private readonly copySuccessDurationMs = 1500;
  private readonly copiedMessageIds = signal<Set<ChatMessage['id']>>(new Set());
  private readonly copyResetTimers = new Map<ChatMessage['id'], ReturnType<typeof setTimeout>>();

  private readonly destroyRef = inject(DestroyRef);

  readonly chatStore = inject(ChatStore);
  readonly messageStore = inject(MessageStore);
  readonly manageChat = inject(ManageChatService);

  private readonly sendMessageService = inject(SendMessageService);
  private readonly selectModel = inject(SelectModelService);
  private readonly chatNavigation = inject(ChatNavigationService);
  private readonly appUi = inject(AppUiService);
  private readonly markdown = inject(MarkdownService);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearCopyTimers());
  }

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

  protected canShowAssistantActions(message: ChatMessage): boolean {
    return (
      message.role === ChatMessageRole.ASSISTANT &&
      (message.state === ChatMessageState.COMPLETED || message.state === ChatMessageState.ERROR)
    );
  }

  protected isMessageCopied(messageId: ChatMessage['id']): boolean {
    return this.copiedMessageIds().has(messageId);
  }

  protected getCopyHint(messageId: ChatMessage['id']): string | null {
    if (this.appUi.isMobile()) {
      return null;
    }

    return this.isMessageCopied(messageId) ? 'Скопировано' : 'Скопировать';
  }

  protected async copyMessage(message: ChatMessage): Promise<void> {
    let copied = false;

    if (message.role === ChatMessageRole.USER) {
      copied = await this.copyTextToClipboard(message.content);
    } else {
      if (!this.canShowAssistantActions(message)) {
        return;
      }

      const content = this.getAssistantMessageContent(message);
      const html = this.markdown.render(content);
      const plainText = this.extractPlainTextFromHtml(html);

      copied = await this.copyAssistantMessage(html, plainText);
    }

    if (copied) {
      this.markMessageCopied(message.id);
    }
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

  private getAssistantMessageContent(message: ChatMessage): string {
    return this.messageStore.get(message.id) || message.content;
  }

  private extractPlainTextFromHtml(html: string): string {
    if (typeof document === 'undefined') {
      return '';
    }

    const parser = document.createElement('div');
    parser.innerHTML = html;

    return parser.innerText || parser.textContent || '';
  }

  private async copyAssistantMessage(html: string, plainText: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return false;
    }

    const safePlainText = plainText ?? '';
    const canWriteHtml =
      typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard.write === 'function';

    if (canWriteHtml) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([safePlainText], { type: 'text/plain' }),
          }),
        ]);
        return true;
      } catch (error) {
        console.error('Error copying rich message:', error);
      }
    }

    return this.copyTextToClipboard(safePlainText);
  }

  private async copyTextToClipboard(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Error copying message:', error);
      return false;
    }
  }

  private markMessageCopied(messageId: ChatMessage['id']): void {
    const nextCopiedIds = new Set(this.copiedMessageIds());
    nextCopiedIds.add(messageId);
    this.copiedMessageIds.set(nextCopiedIds);

    const prevTimer = this.copyResetTimers.get(messageId);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    const timer = setTimeout(() => {
      const ids = new Set(this.copiedMessageIds());
      ids.delete(messageId);
      this.copiedMessageIds.set(ids);
      this.copyResetTimers.delete(messageId);
    }, this.copySuccessDurationMs);

    this.copyResetTimers.set(messageId, timer);
  }

  private clearCopyTimers(): void {
    for (const timer of this.copyResetTimers.values()) {
      clearTimeout(timer);
    }

    this.copyResetTimers.clear();
  }
}
