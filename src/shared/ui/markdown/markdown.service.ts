import { Injectable } from '@angular/core';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

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
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            const { value } = hljs.highlight(str, { language: lang });
            return withCodeCopyButton
              ? this.renderCodeBlockWithCopyButton(value, lang)
              : this.renderCodeBlock(value, lang);
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

  private renderCodeBlockWithCopyButton(code: string, lang?: string): string {
    const languageClass = lang ? ` language-${lang}` : '';

    return `<pre class="chat-code-block"><span class="chat-code-block__copy" role="button" tabindex="0" aria-label="${this.codeCopyButtonText}" title="${this.codeCopyButtonText}"></span><code class="hljs${languageClass}">${code}</code></pre>`;
  }

  private renderCodeBlock(code: string, lang?: string): string {
    const languageClass = lang ? ` language-${lang}` : '';

    return `<pre><code class="hljs${languageClass}">${code}</code></pre>`;
  }
}
