import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ChatNavigationService } from './chat-navigation.service';

describe('ChatNavigationService', () => {
  let service: ChatNavigationService;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.callFake(async () => true);

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });

    service = TestBed.inject(ChatNavigationService);
  });

  it('переходит в чат по идентификатору', async () => {
    const result = await service.navigateToChat('chat-123');

    expect(result).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/chats', 'chat-123']);
  });

  it('переходит на экран создания нового чата', async () => {
    const result = await service.navigateToNewChat();

    expect(result).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/chats', 'new']);
  });
});
