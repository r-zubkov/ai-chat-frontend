import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  signal,
  ViewChild,
} from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { ChatMessage, ChatMessageRole, ChatMessageState } from '../../types/chat-message';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiButton, TuiScrollbar } from '@taiga-ui/core';
import { ChatState } from '../../types/chat';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { ChatInput } from '../../components/chat-input/chat-input';
import { ModelLabelPipe } from '../../pipes/model-label.pipe';
import { remToPx } from '../../helpers/rem-to-px';
import { getCssValue } from '../../helpers/get-css-value';
import { RepositoryEventType } from '../../services/chat-repository.service';
import { StreamingStore } from '../../services/streaming.store';
import { ChatNavigationService } from '../../services/chat-navigation.service';

@Component({
  selector: 'app-user-chat.page',
  imports: [MarkdownPipe, TuiScrollbar, TuiButton, ChatInput, ModelLabelPipe],
  templateUrl: './user-chat.page.html',
  styleUrl: './user-chat.page.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserChatPage {
  private readonly destroyRef = inject(DestroyRef);

  readonly chatService = inject(ChatService);
  readonly streamingStore = inject(StreamingStore);
  private readonly chatNavigationService = inject(ChatNavigationService);

  @Input() set id(chatId: string) {
    this.chatNavigationService.initializeChat(chatId);
    this.loadMessages('instant');
  }

  @ViewChild(TuiScrollbar, { read: ElementRef })
  private readonly scrollBar?: ElementRef<HTMLElement>;

  protected readonly ChatState = ChatState;
  protected readonly ChatMessageState = ChatMessageState;
  protected readonly ChatMessageRole = ChatMessageRole;

  protected readonly messages = signal<ChatMessage[]>([]);

  constructor() {
    this.watchMessagesUpdate();
  }

  private async loadMessages(scrollEffect: 'instant' | 'smooth' | null = null): Promise<void> {
    const messages = await this.chatService.getActiveChatMessages();

    // редирект на новый чат если нет сообщений
    if (!messages.length) {
      this.chatNavigationService.navigateToChat(null);
      return;
    }

    this.messages.set(messages);

    // Удаляем временный стрим только после загрузки сообщений из БД,
    // чтобы не было пустого кадра и дергания скролла.
    for (const msg of messages) {
      if (
        msg.role === ChatMessageRole.ASSISTANT &&
        msg.state !== ChatMessageState.STREAMING &&
        this.streamingStore.get(msg.id)
      ) {
        this.streamingStore.remove(msg.id);
      }
    }

    if (scrollEffect) setTimeout(() => this.scrollToBottom(scrollEffect), 50);
  }

  private watchMessagesUpdate(): void {
    this.chatService.messagesUpdated$.pipe(takeUntilDestroyed()).subscribe((event) => {
      const scrollEffect = event === RepositoryEventType.UPDATING ? null : 'smooth';
      this.loadMessages(scrollEffect);
    });
  }

  protected sendRequest(text: string): void {
    this.chatService
      .sendMessage(text, this.messages())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err) => console.error('Error sending message:', err),
      });
  }

  protected retryLasRequest(): void {
    const lastUserMsg = this.messages()
      .filter((msg) => msg.role === ChatMessageRole.USER)
      .at(-1);

    if (lastUserMsg) this.sendRequest(lastUserMsg.content);
  }

  protected cancelRequest(): void {
    this.chatService.stopRequest(this.chatService.activeChat()?.currentRequestId || '');
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
      top: top,
      behavior,
    });
  }
}
