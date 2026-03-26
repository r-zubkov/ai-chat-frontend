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
import { MarkdownService } from '../markdown';

@Component({
  selector: 'app-copy-msg-button',
  standalone: true,
  imports: [TuiIcon, TuiHint],
  templateUrl: './copy-msg-button.component.html',
  styleUrl: './copy-msg-button.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyMsgButtonComponent implements OnDestroy {
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
      : await this.copyPlainTextToClipboard(text);

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
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return false;
    }

    const html = this.markdown.render(rawText);
    const plainText = this.extractPlainTextFromHtml(html);
    const canWriteHtml =
      typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard.write === 'function';

    if (canWriteHtml) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
          }),
        ]);

        return true;
      } catch (error) {
        console.error('Error copying rich message:', error);
      }
    }

    return this.copyPlainTextToClipboard(plainText);
  }

  private async copyPlainTextToClipboard(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Error copying message:', error);
      return false;
    }
  }

  private extractPlainTextFromHtml(html: string): string {
    if (typeof document === 'undefined') {
      return '';
    }

    const parser = document.createElement('div');
    parser.innerHTML = html;

    return parser.innerText || parser.textContent || '';
  }
}
