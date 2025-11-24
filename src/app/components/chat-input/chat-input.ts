import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiButtonLoading, TuiTextarea } from '@taiga-ui/kit';

@Component({
  selector: 'chat-input',
  imports: [
    FormsModule,
    TuiTextarea,
    TuiTextfield,
    TuiButton,
    TuiButtonLoading
  ],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.less',
})
export class ChatInput {
  @Input() thinking!: boolean;
  
  @Output() onSend = new EventEmitter<string>();

  protected input = signal<string>('');

  protected send(): void {
    const text = this.input().trim();

    if (!text || this.thinking) return;

    this.onSend.emit(text)

    this.input.set('');
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send()
    }
  }
}
