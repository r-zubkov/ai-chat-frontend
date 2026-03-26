import {
  copyHtmlToClipboard,
  copyPlainTextToClipboard,
  extractPlainTextFromHtml,
} from './clipboard';

describe('clipboard helpers', () => {
  let originalNavigatorClipboardDescriptor: PropertyDescriptor | undefined;
  let originalClipboardItemDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalNavigatorClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    originalClipboardItemDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem');
  });

  afterEach(() => {
    restoreProperty(navigator, 'clipboard', originalNavigatorClipboardDescriptor);
    restoreProperty(globalThis, 'ClipboardItem', originalClipboardItemDescriptor);
  });

  it('извлекает plain text из html-строки', () => {
    expect(extractPlainTextFromHtml('<strong>Привет</strong> мир')).toBe('Привет мир');
  });

  it('копирует plain text в буфер обмена', async () => {
    const clipboard = createClipboardMock();
    clipboard.writeText.and.callFake(async () => undefined);
    setNavigatorClipboard(clipboard);

    const copied = await copyPlainTextToClipboard('Текст');

    expect(copied).toBeTrue();
    expect(clipboard.writeText).toHaveBeenCalledWith('Текст');
  });

  it('возвращает false для plain text, если clipboard недоступен', async () => {
    setNavigatorClipboard(undefined);

    const copied = await copyPlainTextToClipboard('Текст');

    expect(copied).toBeFalse();
  });

  it('возвращает false для plain text при ошибке записи', async () => {
    const clipboard = createClipboardMock();
    clipboard.writeText.and.callFake(async () => {
      throw new Error('Ошибка записи');
    });
    setNavigatorClipboard(clipboard);
    spyOn(console, 'error');

    const copied = await copyPlainTextToClipboard('Текст');

    expect(copied).toBeFalse();
    expect(console.error).toHaveBeenCalled();
  });

  it('копирует html через ClipboardItem, если доступна rich-copy запись', async () => {
    const clipboard = createClipboardMock();
    clipboard.write.and.callFake(async () => undefined);
    setNavigatorClipboard(clipboard);
    setClipboardItemMock();

    const copied = await copyHtmlToClipboard('<b>Текст</b>', 'Текст');

    expect(copied).toBeTrue();
    expect(clipboard.write).toHaveBeenCalled();
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('делает fallback на plain text, если ClipboardItem недоступен', async () => {
    const clipboard = createClipboardMock();
    clipboard.writeText.and.callFake(async () => undefined);
    setNavigatorClipboard(clipboard);
    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const copied = await copyHtmlToClipboard('<b>Текст</b>', 'Текст');

    expect(copied).toBeTrue();
    expect(clipboard.write).not.toHaveBeenCalled();
    expect(clipboard.writeText).toHaveBeenCalledWith('Текст');
  });

  it('делает fallback на plain text при ошибке rich-copy записи', async () => {
    const clipboard = createClipboardMock();
    clipboard.write.and.callFake(async () => {
      throw new Error('Ошибка rich-copy');
    });
    clipboard.writeText.and.callFake(async () => undefined);
    setNavigatorClipboard(clipboard);
    setClipboardItemMock();
    spyOn(console, 'error');

    const copied = await copyHtmlToClipboard('<b>Текст</b>', 'Текст');

    expect(copied).toBeTrue();
    expect(clipboard.write).toHaveBeenCalled();
    expect(clipboard.writeText).toHaveBeenCalledWith('Текст');
    expect(console.error).toHaveBeenCalled();
  });

  it('возвращает false для html-copy, если clipboard недоступен', async () => {
    setNavigatorClipboard(undefined);

    const copied = await copyHtmlToClipboard('<b>Текст</b>', 'Текст');

    expect(copied).toBeFalse();
  });
});

function createClipboardMock(): jasmine.SpyObj<Pick<Clipboard, 'write' | 'writeText'>> {
  return jasmine.createSpyObj<Pick<Clipboard, 'write' | 'writeText'>>('clipboard', [
    'write',
    'writeText',
  ]);
}

function setNavigatorClipboard(
  clipboard: Pick<Clipboard, 'write' | 'writeText'> | undefined,
): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
    writable: true,
  });
}

function setClipboardItemMock(): void {
  class MockClipboardItem {
    constructor(public readonly items: Record<string, Blob>) {}
  }

  Object.defineProperty(globalThis, 'ClipboardItem', {
    value: MockClipboardItem as unknown as typeof ClipboardItem,
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
