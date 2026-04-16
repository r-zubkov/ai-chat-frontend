import { Injectable } from '@angular/core';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { escapeHtml } from '../../helpers';

type ResolvedLanguage = {
  key?: string;
  label: string;
  icon: 'code' | 'text';
};

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly md: MarkdownIt;
  private readonly mdWithCodeCopyButton: MarkdownIt;
  private readonly codeCopyButtonText = 'Копировать';
  private readonly defaultCodeLanguageLabel = 'Code';
  private readonly plainTextLanguageLabel = 'Текст';

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

        if (language?.key) {
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
        const fallbackLanguage = language ?? this.getFallbackCodeLanguage();

        return withCodeCopyButton
          ? this.renderCodeBlockWithCopyButton(value, fallbackLanguage)
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
      label: this.getLanguageLabel(languageKey, language.name, languageKey),
      icon: this.getLanguageIcon(languageKey, language.name),
    };
  }

  private renderCodeBlockWithCopyButton(code: string, language?: ResolvedLanguage): string {
    const languageClass = language?.key ? ` language-${language.key}` : '';
    const languageLabel = language
      ? `<span class="chat-code-block__language">${escapeHtml(language.label)}</span>`
      : '';
    const iconClass = language?.icon
      ? `chat-code-block__icon chat-code-block__icon--${language.icon}`
      : 'chat-code-block__icon chat-code-block__icon--code';

    return `<pre class="chat-code-block"><div class="chat-code-block__header"><span class="chat-code-block__meta"><span class="${iconClass}" aria-hidden="true"></span>${languageLabel}</span></div><span class="chat-code-block__copy" role="button" tabindex="0" aria-label="${this.codeCopyButtonText}" title="${this.codeCopyButtonText}"></span><code class="hljs${languageClass}">${code}</code></pre>`;
  }

  private renderCodeBlock(code: string, lang?: string): string {
    const languageClass = lang ? ` language-${lang}` : '';

    return `<pre><code class="hljs${languageClass}">${code}</code></pre>`;
  }

  private getLanguageLabel(
    languageKey: string,
    languageName: string | undefined,
    fallback: string,
  ): string {
    if (this.isPlainTextLanguage(languageKey, languageName)) {
      return this.plainTextLanguageLabel;
    }

    const primaryName = languageName?.split(',')[0]?.trim();

    return primaryName || fallback;
  }

  private getLanguageIcon(languageKey: string, languageName: string | undefined): 'code' | 'text' {
    if (this.isPlainTextLanguage(languageKey, languageName)) {
      return 'text';
    }

    return 'code';
  }

  private isPlainTextLanguage(languageKey: string, languageName: string | undefined): boolean {
    const normalizedName = languageName?.trim().toLowerCase();

    return (
      languageKey === 'plaintext' ||
      languageKey === 'text' ||
      languageKey === 'txt' ||
      normalizedName === 'plain text'
    );
  }

  private getFallbackCodeLanguage(): ResolvedLanguage {
    return {
      label: this.defaultCodeLanguageLabel,
      icon: 'code',
    };
  }
}
