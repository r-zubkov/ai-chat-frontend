import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TuiAutoFocus } from '@taiga-ui/cdk';
import { TuiButton, TuiDialogContext, TuiError, TuiTextfield } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { trimRequiredValidator } from '../../validators/trim-required.validator';

@Component({
  selector: 'app-change-chat-name-modal',
  imports: [ReactiveFormsModule, TuiAutoFocus, TuiButton, TuiError, TuiTextfield],
  templateUrl: './change-chat-name-modal.html',
  styleUrl: './change-chat-name-modal.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeChatNameModal {
  protected readonly context = injectContext<TuiDialogContext<string, string>>();

  protected readonly form = new FormGroup({
    name: new FormControl(this.context.data, {
      nonNullable: true,
      validators: [trimRequiredValidator],
    }),
  });

  protected get nameControl(): FormControl<string> {
    return this.form.controls.name;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.context.completeWith(this.nameControl.value);
  }
}
