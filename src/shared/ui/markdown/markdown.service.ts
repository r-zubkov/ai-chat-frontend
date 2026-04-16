import { Injectable } from '@angular/core';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { escapeHtml } from '../../helpers';

type ResolvedLanguage = {
  key: string;
  label: string;
};

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly md: MarkdownIt;
  private readonly mdWithCodeCopyButton: MarkdownIt;
  private readonly codeCopyButtonText = 'Копировать';

  constructor() {
    this.md = this.createMarkdownInstance(false);
    this.mdWithCodeCopyButton = this.createMarkdownInstance(true);
  }

  render(src: string): string {
    return this.md.render(src ?? '');
  }

  renderForChat(src: string): string {
    return this.mdWithCodeCopyButton.render(src ?? '');
  }

  private createMarkdownInstance(withCodeCopyButton: boolean): MarkdownIt {
    const markdown = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true,
      highlight: (str, langInfo) => {
        const language = this.resolveLanguage(langInfo);

        if (language) {
          try {
            const { value } = hljs.highlight(str, { language: language.key });
            return withCodeCopyButton
              ? this.renderCodeBlockWithCopyButton(value, language)
              : this.renderCodeBlock(value, language.key);
          } catch {
            // Переключение на автоопределение подсветки, если основной метод не сработал.
          }
        }

        const { value } = hljs.highlightAuto(str);
        return withCodeCopyButton
          ? this.renderCodeBlockWithCopyButton(value)
          : this.renderCodeBlock(value);
      },
    });

    markdown.renderer.rules['table_open'] = () => '<div class="table-wrapper"><table>';
    markdown.renderer.rules['table_close'] = () => '</table></div>';

    return markdown;
  }

  private resolveLanguage(langInfo: string): ResolvedLanguage | null {
    const languageKey = langInfo?.trim().split(/\s+/u)[0]?.toLowerCase();
    if (!languageKey) {
      return null;
    }

    const language = hljs.getLanguage(languageKey);
    if (!language) {
      return null;
    }

    return {
      key: languageKey,
      label: language.name ?? languageKey,
    };
  }

  private renderCodeBlockWithCopyButton(code: string, language?: ResolvedLanguage): string {
    const languageClass = language ? ` language-${language.key}` : '';
    const languageLabel = language
      ? `<span class="chat-code-block__language">${escapeHtml(language.label)}</span>`
      : '';

    return `<pre class="chat-code-block"><div class="chat-code-block__header"><span class="chat-code-block__meta"><span class="chat-code-block__icon" aria-hidden="true"></span>${languageLabel}</span></div><span class="chat-code-block__copy" role="button" tabindex="0" aria-label="${this.codeCopyButtonText}" title="${this.codeCopyButtonText}"></span><code class="hljs${languageClass}">${code}</code></pre>`;
  }

  private renderCodeBlock(code: string, lang?: string): string {
    const languageClass = lang ? ` language-${lang}` : '';

    return `<pre><code class="hljs${languageClass}">${code}</code></pre>`;
  }
}
