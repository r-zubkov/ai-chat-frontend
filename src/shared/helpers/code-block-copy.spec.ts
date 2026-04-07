import { handleCodeBlockCopyClick, handleCodeBlockCopyKeydown } from './code-block-copy';

const fixtureHosts: HTMLElement[] = [];

describe('code-block-copy helpers', () => {
  let originalNavigatorClipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalNavigatorClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  });

  afterEach(() => {
    restoreProperty(navigator, 'clipboard', originalNavigatorClipboardDescriptor);
    for (const host of fixtureHosts) {
      host.remove();
    }

    fixtureHosts.length = 0;
  });

  it('копирует код по клику и временно меняет состояние кнопки', async () => {
    const fixture = createCodeBlockFixture('const a = 1;');
    const clipboard = createClipboardMock();
    setNavigatorClipboard(clipboard);

    let resetState: (() => void) | undefined;
    spyOn(globalThis, 'setTimeout').and.callFake((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        resetState = () => handler();
      }

      return 101 as unknown as ReturnType<typeof setTimeout>;
    });

    const event = createMouseEventMock(fixture.copyButton);

    handleCodeBlockCopyClick(event);
    await flushPromises();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(clipboard.writeText).toHaveBeenCalledWith('const a = 1;');
    expect(fixture.copyButton.getAttribute('aria-label')).toBe('Скопировано');
    expect(fixture.copyButton.getAttribute('title')).toBe('Скопировано');
    expect(fixture.copyButton.getAttribute('data-copied')).toBe('true');
    expect(fixture.copyButton.classList.contains('chat-code-block__copy--copied')).toBeTrue();

    expect(resetState).toBeDefined();
    resetState?.();

    expect(fixture.copyButton.getAttribute('aria-label')).toBe('Копировать');
    expect(fixture.copyButton.getAttribute('title')).toBe('Копировать');
    expect(fixture.copyButton.getAttribute('data-copied')).toBe('false');
    expect(fixture.copyButton.classList.contains('chat-code-block__copy--copied')).toBeFalse();
  });

  it('копирует код по клавише Enter', async () => {
    const fixture = createCodeBlockFixture('console.log(1)');
    const clipboard = createClipboardMock();
    setNavigatorClipboard(clipboard);
    spyOn(globalThis, 'setTimeout').and.returnValue(1 as unknown as ReturnType<typeof setTimeout>);
    const event = createKeyboardEventMock(fixture.copyButton, 'Enter');

    handleCodeBlockCopyKeydown(event);
    await flushPromises();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(clipboard.writeText).toHaveBeenCalledWith('console.log(1)');
  });

  it('не обрабатывает keydown с неподдерживаемой клавишей', async () => {
    const fixture = createCodeBlockFixture('console.log(1)');
    const clipboard = createClipboardMock();
    setNavigatorClipboard(clipboard);
    const event = createKeyboardEventMock(fixture.copyButton, 'Escape');

    handleCodeBlockCopyKeydown(event);
    await flushPromises();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('не копирует, если target не является кнопкой копирования', async () => {
    const fixture = createCodeBlockFixture('const a = 1;');
    const clipboard = createClipboardMock();
    setNavigatorClipboard(clipboard);
    const event = createMouseEventMock(fixture.container);

    handleCodeBlockCopyClick(event);
    await flushPromises();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('не копирует пустой код', async () => {
    const fixture = createCodeBlockFixture('   ');
    const clipboard = createClipboardMock();
    setNavigatorClipboard(clipboard);
    const event = createMouseEventMock(fixture.copyButton);

    handleCodeBlockCopyClick(event);
    await flushPromises();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(fixture.copyButton.getAttribute('data-copied')).toBeNull();
  });

  it('сбрасывает предыдущий таймер при повторном копировании той же кнопки', async () => {
    const fixture = createCodeBlockFixture('const a = 1;');
    const clipboard = createClipboardMock();
    setNavigatorClipboard(clipboard);

    const clearTimeoutSpy = spyOn(globalThis, 'clearTimeout');
    let timerId = 0;
    spyOn(globalThis, 'setTimeout').and.callFake(() => {
      timerId += 1;
      return timerId as unknown as ReturnType<typeof setTimeout>;
    });

    const firstEvent = createMouseEventMock(fixture.copyButton);
    const secondEvent = createMouseEventMock(fixture.copyButton);

    handleCodeBlockCopyClick(firstEvent);
    await flushPromises();
    handleCodeBlockCopyClick(secondEvent);
    await flushPromises();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(1 as unknown as ReturnType<typeof setTimeout>);
    expect(clipboard.writeText).toHaveBeenCalledTimes(2);
  });
});

function createCodeBlockFixture(codeText: string): {
  container: HTMLElement;
  copyButton: HTMLElement;
} {
  const host = document.createElement('div');
  const container = document.createElement('pre');
  container.className = 'chat-code-block';

  const copyButton = document.createElement('span');
  copyButton.className = 'chat-code-block__copy';

  const code = document.createElement('code');
  code.textContent = codeText;

  container.append(copyButton, code);
  host.append(container);
  document.body.append(host);
  fixtureHosts.push(host);

  return { container, copyButton };
}

function createMouseEventMock(target: EventTarget): MouseEvent {
  return {
    target,
    preventDefault: jasmine.createSpy('preventDefault'),
  } as unknown as MouseEvent;
}

function createKeyboardEventMock(target: EventTarget, key: string): KeyboardEvent {
  return {
    target,
    key,
    preventDefault: jasmine.createSpy('preventDefault'),
  } as unknown as KeyboardEvent;
}

function createClipboardMock(): Pick<Clipboard, 'writeText'> & {
  writeText: jasmine.Spy<(text: string) => Promise<void>>;
} {
  return {
    writeText: jasmine.createSpy('writeText').and.callFake(async () => undefined),
  };
}

function setNavigatorClipboard(clipboard: Pick<Clipboard, 'writeText'> | undefined): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
    writable: true,
  });
}

function restoreProperty(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  Reflect.deleteProperty(target, key);
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
