import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';

@Component({
  selector: 'chat-input',
  imports: [
    FormsModule,
    TuiTextarea,
    TuiTextfield,
    TuiButton,
  ],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.less',
})
export class ChatInput {
  @Input() thinking = false;
  
  @Output() onSend = new EventEmitter<string>();
  @Output() onCancel = new EventEmitter<boolean>();

  protected input = signal<string>('');
  protected readonly minInputLength = 1;

  protected get isSendAllowed(): boolean {
    return this.input().trim().length >= this.minInputLength && !this.thinking;
  }

  protected send(): void {
    const text = this.input().trim();

    if (!this.isSendAllowed) return;

    this.onSend.emit(text)

    this.input.set('');
  }

  protected cancel(): void {
    this.onCancel.emit(true)
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send()
    }
  }
}
