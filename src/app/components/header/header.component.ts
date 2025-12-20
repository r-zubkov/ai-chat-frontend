import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { TuiSelect, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TuiTextfield, TuiIcon, TuiDropdown, TuiDataList, TuiLink } from '@taiga-ui/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ChatService } from '../../services/chat.service';
import { ModelOption } from '../../types/model-option';
import { ModelType } from '../../types/model-type';
import { AppService } from '../../services/app.service';

@Component({
  selector: 'app-header',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TuiChevron,
    TuiDataListWrapper,
    TuiIcon,
    TuiLink,
    TuiSelect,
    TuiTextfield,
    TuiDropdown,
    TuiDataList
],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
})
export class HeaderComponent {
  protected readonly modelControl = new FormControl<ModelOption | null>(null);

  protected modelSelectionOpen: boolean = false;

  protected selectedModel: string | null = null;

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
        if (found) this.selectedModel = found.label


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

  protected onClick(model: string): void {
    if (model) {
      this.chatService.updateCurrentModel(model as ModelType)
    }

    this.modelSelectionOpen = false;
  }

  protected itemIsActive(model: string): boolean {
    return model === this.chatService.currentModel();
  }

  protected toggleMenu(): void {
    this.appService.toggleSidebar()
  }

  protected newChat(): void {
    this.chatService.navigateToChat(null)
  }
}
