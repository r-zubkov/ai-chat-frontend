import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, signal, ViewChild } from '@angular/core';
import { TuiButton, TuiScrollbar } from '@taiga-ui/core';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { ChatInput } from '../chat-input/chat-input';
import { distinctUntilChanged, tap } from 'rxjs';
import { ChatMessageRole } from '../../types/chat-message-role';
import { ChatService } from '../../services/chat.service';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { getCssValue } from '../../helpers/get-css-value';
import { remToPx } from '../../helpers/rem-to-px';
import { ChatState } from '../../types/chat-state';
import { ModelLabelPipe } from '../../pipes/model-label.pipe';

@Component({
  selector: 'app-chat',
  imports: [
    CommonModule,
    MarkdownPipe,
    TuiScrollbar,
    TuiButton,
    ChatInput,
    ModelLabelPipe
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.less'],
})
export class ChatComponent implements AfterViewInit {
  @ViewChild(TuiScrollbar, {read: ElementRef})
  private readonly scrollBar?: ElementRef<HTMLElement>;

  protected readonly ChatState = ChatState;
  protected readonly ChatMessageRole = ChatMessageRole;

  protected readonly thinking = signal<boolean>(false);

  constructor(public readonly chatService: ChatService) {
    this.subscribeToActiveChat()
  }

  ngAfterViewInit(): void {
    if (this.hasMessages) {
      setTimeout(() => this.scrollToBottom('instant')) 
    }
  }

  private subscribeToActiveChat(): void {
    toObservable(this.chatService.activeChat)
      .pipe(
        takeUntilDestroyed(),
        tap(value => {this.thinking.set(value?.state === ChatState.THINKING)}),
        distinctUntilChanged((a, b) => a?.id === b?.id),
        tap(value => {
          if (value) setTimeout(() => this.scrollToBottom('instant')) 
        })
      )
      .subscribe();
  }

  get hasMessages(): boolean {
    return !!this.chatService.activeChat()?.messages?.length;
  }

  sendRequest(text: string): void {
    this.chatService.sendMessage(
      text,
      (msg) => {
        setTimeout(() => this.scrollToBottom('smooth'))
      },
      (msg) => {
        //setTimeout(() => this.scrollToMessage(msg.id, 'smooth'))
      },
      (err) => {
        console.error('Error sending message:', err)
      }
    )
  }

  cancelRequest(): void {
    this.chatService.stopRequest(this.chatService.activeChat()?.currentRequestId || '')
  }

  retryLasRequest(): void {
    const lastUserMsg = this.chatService.activeChat()?.messages
    .filter(msg => msg.role === ChatMessageRole.USER)
    .at(-1);

    if (lastUserMsg) this.sendRequest(lastUserMsg.content);
  }

  private scrollToMessage(messageId: string, behavior: ScrollBehavior = 'smooth'): void {
    const container = this.scrollBar?.nativeElement;
    if (!container) return;

    const target = container.querySelector(`[data-id="${messageId}"]`) as HTMLElement | null;
    if (!target) return;

    const messageTopOffset = target.offsetTop;
    const messagesGap = remToPx(parseFloat(getCssValue('--chat-messages-gap')));
    const topOffset = messageTopOffset - messagesGap

    this.scrollTo(container,topOffset, behavior)
  }

  private scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
    const container = this.scrollBar?.nativeElement;
    if (!container) return;

    this.scrollTo(container, container.scrollHeight, behavior)
  }

  private scrollTo(container: HTMLElement, top: number, behavior: ScrollBehavior = 'auto'): void {
    container.scrollTo({
      top: top,
      behavior,
    })
  }
}
