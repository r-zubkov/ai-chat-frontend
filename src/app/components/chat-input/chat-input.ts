import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';

@Component({
  selector: 'chat-input',
  imports: [ReactiveFormsModule, TuiTextarea, TuiTextfield, TuiButton],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInput {
  @Input() thinking = false;

  @Output() sent = new EventEmitter<string>();
  @Output() canceled = new EventEmitter<boolean>();

  protected readonly form = new FormGroup({
    message: new FormControl('', {
      nonNullable: true,
    }),
  });

  protected get isSendAllowed(): boolean {
    return !this.thinking && this.form.controls.message.value.trim().length > 0;
  }

  protected send(): void {
    const text = this.form.controls.message.value.trim();

    if (!this.isSendAllowed) return;

    this.sent.emit(text);

    this.form.controls.message.reset('');
  }

  protected cancel(): void {
    this.canceled.emit(true);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    // Ð•ÑÐ»Ð¸ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ ÐµÑ‰Ðµ Ð²Ñ‹Ð±Ð¸Ñ€Ð°ÐµÑ‚ Ð¸ÐµÑ€Ð¾Ð³Ð»Ð¸Ñ„ â€” Ð²Ñ‹Ñ…Ð¾Ð´Ð¸Ð¼
    if (event.isComposing) return;

    // Ð•ÑÐ»Ð¸ Ð½Ð°Ð¶Ð°Ñ‚ Enter Ð±ÐµÐ· Shift â€” Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
