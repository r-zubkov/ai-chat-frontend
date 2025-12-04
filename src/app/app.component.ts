import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { tuiItemsHandlersProvider, TuiRoot } from '@taiga-ui/core';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { HeaderComponent } from './components/header/header.component';
import { ChatComponent } from './components/chat/chat.component';
import { ChatService } from './services/chat.service';
import { AppService } from './services/app.service';

interface ISelectItem {
  readonly id: string | number;
  readonly label: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    TuiRoot,
    SidebarComponent,
    HeaderComponent,
    ChatComponent
  ],
  providers: [
    tuiItemsHandlersProvider({
      stringify: signal((x: ISelectItem) => x.label),
      identityMatcher: signal((a: ISelectItem, b: ISelectItem) => a.id === b.id),
    }),
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
})
export class AppComponent implements OnInit, OnDestroy {
  private resizeObserver?: ResizeObserver;

  constructor(
    public readonly appSerivce: AppService,
    private readonly chatService: ChatService
  ) {
    this.chatService.loadCurrentModelFromLocalStorage()
    this.chatService.loadChatsFromLocalStorage()
  }

  ngOnInit(): void {
    this.observeWidthChange();
  }

  ngOnDestroy(): void {
    this.chatService.destroy()
  }

  @HostListener('window:beforeunload')
  onBeforeUnload() {
    this.chatService.destroy()
  }

  private observeWidthChange(): void {
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      this.appSerivce.updateMobileState(width);
    });

    this.resizeObserver.observe(document.body);
  }
}
