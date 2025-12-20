import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {TuiAutoFocus} from '@taiga-ui/cdk';
import { TuiButton, TuiDialogContext, TuiTextfield } from '@taiga-ui/core';
//import {TuiForm} from '@taiga-ui/layout';
import {injectContext} from '@taiga-ui/polymorpheus';

@Component({
  selector: 'app-change-chat-name-modal',
  imports: [FormsModule, TuiAutoFocus, TuiButton, TuiTextfield],
  templateUrl: './change-chat-name-modal.html',
  styleUrl: './change-chat-name-modal.less',
  host: {'(submit.prevent)': 'context.completeWith(value)'},
})
export class ChangeChatNameModal {
  protected readonly context = injectContext<TuiDialogContext<string, string>>();
 
  protected value = this.context.data;
}
