import { inject, Pipe, PipeTransform } from '@angular/core';
import { MarkdownService } from '../services/markdown.service';

@Pipe({
  name: 'markdown',
  standalone: true,
  pure: true,
})
export class MarkdownPipe implements PipeTransform {
  private readonly md = inject(MarkdownService);

  transform(value: string | null | undefined): string {
    return this.md.render(value || '');
  }
}
