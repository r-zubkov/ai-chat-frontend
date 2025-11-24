import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MarkdownService } from '../services/markdown.service';

@Pipe({
  name: 'markdown',
  standalone: true,
  pure: true,
})
export class MarkdownPipe implements PipeTransform {
  constructor(
    private readonly md: MarkdownService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  transform(value: string | null | undefined): SafeHtml {
    const html = this.md.render(value || '');
    // html мы генерим сами из markdown, без сырого html от пользователя
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
