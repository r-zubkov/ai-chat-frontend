import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { trimRequiredValidator } from '../../validators/trim-required.validator';

@Component({
  selector: 'chat-input',
  imports: [ReactiveFormsModule, TuiTextarea, TuiTextfield, TuiButton],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInput {
  @Input() thinking = false;

  @Output() onSend = new EventEmitter<string>();
  @Output() onCancel = new EventEmitter<boolean>();

  protected readonly form = new FormGroup({
    message: new FormControl('', {
      nonNullable: true,
      validators: [trimRequiredValidator],
    }),
  });

  protected get isSendAllowed(): boolean {
    return this.form.valid && !this.thinking;
  }

  protected send(): void {
    const text = this.form.controls.message.value.trim();

    if (!this.isSendAllowed) return;

    this.onSend.emit(text);

    this.form.controls.message.reset('');
  }

  protected cancel(): void {
    this.onCancel.emit(true);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    // Если пользователь еще выбирает иероглиф — выходим
    if (event.isComposing) return;

    // Если нажат Enter без Shift — отправляем
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
