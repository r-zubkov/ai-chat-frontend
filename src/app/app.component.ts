import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';
import { ChatStore } from '@entities/chat';
import { SettingsStore } from '@entities/settings';
import { SendMessageService } from '@features/send-message';
import { ChatHeaderComponent, ChatSidebarComponent } from '@widgets';
import { AppStateService } from './app-state.service';
import { AppUiService } from './app-ui.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, ChatSidebarComponent, ChatHeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private resizeObserver?: ResizeObserver;

  readonly appUi = inject(AppUiService);
  private readonly appState = inject(AppStateService);
  private readonly chatStore = inject(ChatStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly sendMessage = inject(SendMessageService);

  constructor() {
    this.appState.registerInitialDataLoad(
      Promise.all([this.settingsStore.loadSettings(), this.chatStore.loadAll()]).then(
        () => undefined,
      ),
    );
  }

  ngOnInit(): void {
    this.observeWidthChange();
  }

  ngOnDestroy(): void {
    this.cleanupResizeObserver();
    this.sendMessage.destroy();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.sendMessage.destroy();
  }

  private observeWidthChange(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      this.appUi.updateMobileState(width);
    });

    this.resizeObserver.observe(document.body);
  }

  private cleanupResizeObserver(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }
}
