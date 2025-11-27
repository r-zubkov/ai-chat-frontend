import { Injectable } from '@angular/core';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true,
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            const { value } = hljs.highlight(str, { language: lang });
            return `<pre><code class="hljs language-${lang}">${value}</code></pre>`;
          } catch {}
        }

        const { value } = hljs.highlightAuto(str);
        return `<pre><code class="hljs">${value}</code></pre>`;
      },
    });

    this.md.renderer.rules['table_open'] = () => '<div class="table-wrapper"><table>';
    this.md.renderer.rules['table_close'] = () => '</table></div>';
  }

  render(src: string): string {
    return this.md.render(src ?? '');
  }
}
