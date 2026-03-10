import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ChatState, ChatStore } from '@entities/chat';
import { MessageStore } from '@entities/message';
import { SettingsStore } from '@entities/settings';
import { SendMessageEventType, SendMessageService } from '@features/send-message';
import { ChatInputComponent } from '@widgets/chat-input';
import { AppUiService } from '@app/app-ui.service';

@Component({
  selector: 'app-new-chat-page',
  imports: [ChatInputComponent],
  templateUrl: './new-chat.page.html',
  styleUrl: './new-chat.page.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewChatPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly chatStore = inject(ChatStore);
  readonly messageStore = inject(MessageStore);
  readonly settings = inject(SettingsStore);

  private readonly sendMessageService = inject(SendMessageService);
  private readonly router = inject(Router);
  private readonly appUi = inject(AppUiService);

  ngOnInit(): void {
    this.chatStore.setActive(null);
    this.messageStore.clearState();
    this.settings.setCurrentModel(this.settings.globalCurrentModel());
    this.appUi.closeSidebarOnMobile();
  }

  protected onSendMessage(text: string): void {
    this.sendMessageService
      .sendMessage(text, [])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === SendMessageEventType.SENT) {
            void this.router.navigate(['/chats', event.chatId]);
          }
        },
        error: (err) => console.error('Error sending message:', err),
      });
  }

  protected onCancelRequest(): void {
    const requestId = this.chatStore.activeChat()?.currentRequestId;
    if (!requestId) return;

    this.sendMessageService.stopRequest(requestId);
  }

  protected get thinking(): boolean {
    return this.chatStore.activeChat()?.state === ChatState.THINKING;
  }
}
