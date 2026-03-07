import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ChatStore } from '@entities/chat';
import { SettingsStore } from '@entities/settings';
import { SendMessageEvent, SendMessageEventType } from '@features/send-message';
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
  readonly chatStore = inject(ChatStore);
  readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly appUi = inject(AppUiService);

  ngOnInit(): void {
    this.chatStore.setActive(null);
    this.settings.setCurrentModel(this.settings.globalCurrentModel());
    this.appUi.closeSidebarOnMobile();
  }

  protected handleRequestEvent(event: SendMessageEvent): void {
    if (event.type === SendMessageEventType.SENT) {
      void this.router.navigate(['/chats', event.chatId]);
    }
  }
}
