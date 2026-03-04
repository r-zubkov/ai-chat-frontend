import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ChatInput } from '../../components/chat-input/chat-input';
import { ChatFacadeService } from '../../services/chat-facade.service';
import { SendMessageEventType } from '../../types/send-message-event';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatNavigationService } from '../../services/chat-navigation.service';
import { AppUiService } from '../../services/app-ui.service';

@Component({
  selector: 'app-new-chat.page',
  imports: [ChatInput],
  templateUrl: './new-chat.page.html',
  styleUrl: './new-chat.page.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewChatPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly chatService = inject(ChatFacadeService);
  private readonly chatNavigationService = inject(ChatNavigationService);
  private readonly appUiService = inject(AppUiService);

  ngOnInit(): void {
    void this.chatNavigationService
      .setupActiveChat(null)
      .finally(() => this.appUiService.closeSidebarOnMobile());
  }

  protected sendRequest(text: string): void {
    this.chatService
      .sendMessage(text, [])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === SendMessageEventType.SENT) {
            this.chatNavigationService.navigateToChat(event.userMessage.chatId);
          }
        },
        error: (err) => console.error('Error sending message:', err),
      });
  }
}
