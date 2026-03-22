import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiDataList, TuiDropdown, TuiIcon, TuiLink } from '@taiga-ui/core';
import { TuiChevron } from '@taiga-ui/kit';
import { ChatStore } from '@entities/chat';
import { ModelType, SettingsStore } from '@entities/settings';
import { SelectModelService } from '@features/select-model';
import { AppUiService } from '@app/app-ui.service';

@Component({
  selector: 'app-chat-header',
  imports: [TuiChevron, TuiIcon, TuiLink, TuiDropdown, TuiDataList, RouterLink],
  templateUrl: './chat-header.component.html',
  styleUrl: './chat-header.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatHeaderComponent {
  protected modelSelectionOpen: boolean = false;

  readonly settingsStore = inject(SettingsStore);
  readonly appUi = inject(AppUiService);
  readonly selectModel = inject(SelectModelService);
  readonly chatStore = inject(ChatStore);

  protected readonly selectedModel = computed(() => {
    const currentModel = this.settingsStore.currentModel();
    return this.selectModel.models.find((model) => model.id === currentModel)?.label ?? null;
  });

  protected onClick(model: ModelType): void {
    void this.selectModel.selectModel(model);
    this.modelSelectionOpen = false;
  }

  protected itemIsActive(model: ModelType): boolean {
    return model === this.settingsStore.currentModel();
  }

  protected toggleMenu(): void {
    this.appUi.toggleSidebar();
  }
}
