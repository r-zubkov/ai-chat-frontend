import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TuiChevron } from '@taiga-ui/kit';
import { TuiDataList, TuiDropdown, TuiIcon, TuiLink } from '@taiga-ui/core';
import { ChatService } from '../../services/chat.service';
import { ModelType } from '../../types/model-type';
import { AppService } from '../../services/app.service';
import { ChatNavigationService } from '../../services/chat-navigation.service';

@Component({
  selector: 'app-header',
  imports: [TuiChevron, TuiIcon, TuiLink, TuiDropdown, TuiDataList],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected modelSelectionOpen: boolean = false;

  public readonly appService = inject(AppService);
  public readonly chatService = inject(ChatService);
  private readonly chatNavigationService = inject(ChatNavigationService);

  protected readonly selectedModel = computed(() => {
    const currentModel = this.chatService.currentModel();
    return this.chatService.models.find((model) => model.id === currentModel)?.label ?? null;
  });

  protected onClick(model: ModelType): void {
    this.chatService.updateCurrentModel(model);
    this.modelSelectionOpen = false;
  }

  protected itemIsActive(model: ModelType): boolean {
    return model === this.chatService.currentModel();
  }

  protected toggleMenu(): void {
    this.appService.toggleSidebar();
  }

  protected newChat(): void {
    this.chatNavigationService.navigateToChat(null);
  }
}
