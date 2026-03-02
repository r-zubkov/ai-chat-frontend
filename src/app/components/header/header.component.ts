import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TuiChevron } from '@taiga-ui/kit';
import { TuiDataList, TuiDropdown, TuiIcon, TuiLink } from '@taiga-ui/core';
import { ChatService } from '../../services/chat.service';
import { ModelType } from '../../types/model-type';
import { AppService } from '../../services/app.service';

@Component({
  selector: 'app-header',
  imports: [TuiChevron, TuiIcon, TuiLink, TuiDropdown, TuiDataList],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected modelSelectionOpen: boolean = false;

  protected readonly selectedModel = computed(() => {
    const currentModel = this.chatService.currentModel();
    return this.chatService.models.find((model) => model.id === currentModel)?.label ?? null;
  });

  constructor(
    public readonly appService: AppService,
    public readonly chatService: ChatService,
  ) {}

  protected onClick(model: string): void {
    if (model) {
      this.chatService.updateCurrentModel(model as ModelType);
    }

    this.modelSelectionOpen = false;
  }

  protected itemIsActive(model: string): boolean {
    return model === this.chatService.currentModel();
  }

  protected toggleMenu(): void {
    this.appService.toggleSidebar();
  }

  protected newChat(): void {
    this.chatService.navigateToChat(null);
  }
}
