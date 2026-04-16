import { copyPlainTextToClipboard } from './clipboard';

const codeCopyButtonSelector = '.chat-code-block__copy';
const codeCopyContainerSelector = '.chat-code-block';
const codeCopyButtonText = 'Копировать';
const codeCopiedButtonText = 'Скопировано';
const codeCopySuccessDurationMs = 1500;
const codeCopyTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function handleCodeBlockCopyClick(event: MouseEvent): void {
  const copyButton = getCodeCopyButton(event);
  if (!copyButton) {
    return;
  }

  event.preventDefault();
  void copyCodeBlock(copyButton);
}

export function handleCodeBlockCopyKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const copyButton = getCodeCopyButton(event);
  if (!copyButton) {
    return;
  }

  event.preventDefault();
  void copyCodeBlock(copyButton);
}

function getCodeCopyButton(event: Event): HTMLElement | null {
  const target = resolveEventTarget(event);

  return target?.closest(codeCopyButtonSelector) as HTMLElement | null;
}

async function copyCodeBlock(copyButton: HTMLElement): Promise<void> {
  const codeText =
    copyButton.closest(codeCopyContainerSelector)?.querySelector('code')?.textContent ?? '';
  if (!codeText.trim()) {
    return;
  }

  const copied = await copyPlainTextToClipboard(codeText);
  if (!copied) {
    return;
  }

  setCodeCopyButtonState(copyButton, true);

  const existingTimer = codeCopyTimers.get(copyButton);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const resetTimer = setTimeout(() => {
    setCodeCopyButtonState(copyButton, false);
    codeCopyTimers.delete(copyButton);
  }, codeCopySuccessDurationMs);

  codeCopyTimers.set(copyButton, resetTimer);
}

function resolveEventTarget(event: Event): Element | null {
  const target = event.target;

  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function setCodeCopyButtonState(button: HTMLElement, copied: boolean): void {
  const text = copied ? codeCopiedButtonText : codeCopyButtonText;
  button.setAttribute('aria-label', text);
  button.setAttribute('title', text);
  button.setAttribute('data-copied', copied ? 'true' : 'false');
  button.classList.toggle('chat-code-block__copy--copied', copied);
}
