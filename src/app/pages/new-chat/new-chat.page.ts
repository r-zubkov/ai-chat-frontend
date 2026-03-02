import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ChatInput } from '../../components/chat-input/chat-input';
import { ChatService } from '../../services/chat.service';
import { SendMessageEventType } from '../../types/send-message-event';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-new-chat.page',
  imports: [ChatInput],
  templateUrl: './new-chat.page.html',
  styleUrl: './new-chat.page.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewChatPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly chatService = inject(ChatService);

  ngOnInit(): void {
    this.chatService.initializeChat(null);
  }

  protected sendRequest(text: string): void {
    this.chatService
      .sendMessage(text, [])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === SendMessageEventType.SENT) {
            this.chatService.navigateToChat(event.userMessage.chatId);
          }
        },
        error: (err) => console.error('Error sending message:', err),
      });
  }
}
