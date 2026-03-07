import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { ChatState, ChatStore } from '@entities/chat';
import { ChatMessage } from '@entities/message';
import { SendMessageEvent, SendMessageService } from '@features/send-message';

@Component({
  selector: 'app-chat-input',
  imports: [ReactiveFormsModule, TuiTextarea, TuiTextfield, TuiButton],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInputComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly sendMessage = inject(SendMessageService);
  readonly chatStore = inject(ChatStore);

  @Input() messageHistory: ChatMessage[] = [];

  @Output() requestEvent = new EventEmitter<SendMessageEvent>();

  protected readonly form = new FormGroup({
    message: new FormControl('', {
      nonNullable: true,
    }),
  });

  protected get thinking(): boolean {
    return this.chatStore.activeChat()?.state === ChatState.THINKING;
  }

  protected get isSendAllowed(): boolean {
    return !this.thinking && this.form.controls.message.value.trim().length > 0;
  }

  protected send(): void {
    const text = this.form.controls.message.value.trim();

    if (!this.isSendAllowed) return;

    this.sendMessage
      .sendMessage(text, this.messageHistory)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.requestEvent.emit(event),
        error: (err) => console.error('Error sending message:', err),
      });

    this.form.controls.message.reset('');
  }

  protected cancel(): void {
    const requestId = this.chatStore.activeChat()?.currentRequestId;
    if (!requestId) return;

    this.sendMessage.stopRequest(requestId);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
