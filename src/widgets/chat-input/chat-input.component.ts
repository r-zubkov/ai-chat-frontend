import { ChangeDetectionStrategy, Component, EventEmitter, Output, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';

@Component({
  selector: 'app-chat-input',
  imports: [ReactiveFormsModule, TuiTextarea, TuiTextfield, TuiButton],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInputComponent {
  readonly thinking = input(false);

  @Output() sendMessage = new EventEmitter<string>();
  @Output() cancelRequest = new EventEmitter<void>();

  protected readonly form = new FormGroup({
    message: new FormControl('', {
      nonNullable: true,
    }),
  });

  protected get isSendAllowed(): boolean {
    return !this.thinking() && this.form.controls.message.value.trim().length > 0;
  }

  protected send(): void {
    const text = this.form.controls.message.value.trim();

    if (!this.isSendAllowed) return;

    this.sendMessage.emit(text);
    this.form.controls.message.reset('');
  }

  protected cancel(): void {
    this.cancelRequest.emit();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
