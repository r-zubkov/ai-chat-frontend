import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TuiHint, TuiIcon } from '@taiga-ui/core';
import {
  copyHtmlToClipboard,
  copyPlainTextToClipboard,
  extractPlainTextFromHtml,
} from '../../helpers';
import { MarkdownService } from '../markdown';

@Component({
  selector: 'app-copy-text-button',
  standalone: true,
  imports: [TuiIcon, TuiHint],
  templateUrl: './copy-text-button.component.html',
  styleUrl: './copy-text-button.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyTextButtonComponent implements OnDestroy {
  private static readonly codeCopyButtonSelector = '.chat-code-block__copy';
  private static readonly codeCopyContainerSelector = '.chat-code-block';
  private static readonly codeCopyButtonText = 'Копировать';
  private static readonly codeCopiedButtonText = 'Скопировано';
  private static readonly codeCopySuccessDurationMs = 1500;
  private static readonly codeCopyTimers = new WeakMap<
    HTMLElement,
    ReturnType<typeof setTimeout>
  >();

  readonly text = input.required<string>();
  readonly richText = input(false);
  readonly hint = input('Copy');
  readonly copiedHint = input('Copied');

  private readonly copySuccessDurationMs = 1500;
  private readonly copied = signal(false);
  private readonly markdown = inject(MarkdownService);

  private copiedTimer?: ReturnType<typeof setTimeout>;

  protected readonly icon = computed(() => (this.copied() ? '@tui.check' : '@tui.copy'));
  protected readonly hintText = computed(() =>
    this.copied() ? this.copiedHint() || 'Copied' : this.hint() || 'Copy',
  );

  ngOnDestroy(): void {
    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
      this.copiedTimer = undefined;
    }
  }

  protected async copyText(): Promise<void> {
    const text = this.text();
    const copied = this.richText()
      ? await this.copyRichText(text)
      : await copyPlainTextToClipboard(text);

    if (!copied) {
      return;
    }

    this.copied.set(true);

    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
    }

    this.copiedTimer = setTimeout(() => {
      this.copied.set(false);
      this.copiedTimer = undefined;
    }, this.copySuccessDurationMs);
  }

  private async copyRichText(rawText: string): Promise<boolean> {
    const html = this.markdown.render(rawText);
    const plainText = extractPlainTextFromHtml(html);

    return copyHtmlToClipboard(html, plainText);
  }

  static onCodeBlockClick(event: MouseEvent): void {
    const target = this.resolveEventTarget(event);
    const copyButton = target?.closest(this.codeCopyButtonSelector) as HTMLElement | null;
    if (!copyButton) {
      return;
    }

    event.preventDefault();
    void this.copyCodeBlock(copyButton);
  }

  static onCodeBlockKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const target = this.resolveEventTarget(event);
    const copyButton = target?.closest(this.codeCopyButtonSelector) as HTMLElement | null;
    if (!copyButton) {
      return;
    }

    event.preventDefault();
    void this.copyCodeBlock(copyButton);
  }

  private static async copyCodeBlock(copyButton: HTMLElement): Promise<void> {
    const codeText =
      copyButton.closest(this.codeCopyContainerSelector)?.querySelector('code')?.textContent ?? '';
    if (!codeText.trim()) {
      return;
    }

    const copied = await copyPlainTextToClipboard(codeText);
    if (!copied) {
      return;
    }

    this.setCodeCopyButtonState(copyButton, true);

    const existingTimer = this.codeCopyTimers.get(copyButton);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const resetTimer = setTimeout(() => {
      this.setCodeCopyButtonState(copyButton, false);
      this.codeCopyTimers.delete(copyButton);
    }, this.codeCopySuccessDurationMs);

    this.codeCopyTimers.set(copyButton, resetTimer);
  }

  private static resolveEventTarget(event: Event): Element | null {
    const target = event.target;

    if (target instanceof Element) {
      return target;
    }

    if (target instanceof Node) {
      return target.parentElement;
    }

    return null;
  }

  private static setCodeCopyButtonState(button: HTMLElement, copied: boolean): void {
    const text = copied ? this.codeCopiedButtonText : this.codeCopyButtonText;
    button.setAttribute('aria-label', text);
    button.setAttribute('title', text);
    button.setAttribute('data-copied', copied ? 'true' : 'false');
    button.classList.toggle('chat-code-block__copy--copied', copied);
  }
}
