import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { tuiItemsHandlersProvider, TuiRoot } from '@taiga-ui/core';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { HeaderComponent } from './components/header/header.component';
import { ChatService } from './services/chat.service';
import { AppUiService } from './services/app-ui.service';
import { RouterOutlet } from '@angular/router';

interface ISelectItem {
  readonly id: string | number;
  readonly label: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, SidebarComponent, HeaderComponent],
  providers: [
    tuiItemsHandlersProvider({
      stringify: signal((x: ISelectItem) => x.label),
      identityMatcher: signal((a: ISelectItem, b: ISelectItem) => a.id === b.id),
    }),
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private resizeObserver?: ResizeObserver;

  readonly appUiService = inject(AppUiService);
  private readonly chatService = inject(ChatService);

  constructor() {
    this.chatService.loadCurrentModelFromDB();
    this.chatService.loadChatsFromDB();
    this.chatService.loadChatsCountFromDB();
  }

  ngOnInit(): void {
    this.observeWidthChange();
  }

  ngOnDestroy(): void {
    this.cleanupResizeObserver();
    this.chatService.destroy();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload() {
    this.chatService.destroy();
  }

  private observeWidthChange(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      this.appUiService.updateMobileState(width);
    });

    this.resizeObserver.observe(document.body);
  }

  private cleanupResizeObserver(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }
}
