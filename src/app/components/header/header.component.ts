import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { TuiSelect, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TuiTextfield, TuiIcon } from '@taiga-ui/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ChatService } from '../../services/chat.service';
import { ModelOption } from '../../types/model-option';
import { ModelType } from '../../types/model-type';
import { AppService } from '../../services/app.service';

@Component({
  selector: 'app-header',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TuiChevron,
    TuiDataListWrapper,
    TuiIcon,
    TuiSelect,
    TuiTextfield,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
})
export class HeaderComponent {
  protected readonly modelControl = new FormControl<ModelOption | null>(null);

  constructor(
    public readonly appService: AppService,
    public readonly chatService: ChatService
  ) {
    this.subscribeToModelValueChanges()
    this.subscribeToCurrentModel()
  }

  private subscribeToCurrentModel(): void {
    toObservable(this.chatService.currentModel)
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        const found = this.chatService.models.find(model => model.id === value) ?? null;
        this.modelControl.setValue(found, { emitEvent: false });
      });
  }

  private subscribeToModelValueChanges(): void {
    this.modelControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        if (value) this.chatService.updateCurrentModel(value.id as ModelType)
      });
  }

  toggleMenu(): void {
    this.appService.toggleSidebar()
  }
}
