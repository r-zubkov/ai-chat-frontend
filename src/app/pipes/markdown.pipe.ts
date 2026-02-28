import { Pipe, PipeTransform } from '@angular/core';
import { MarkdownService } from '../services/markdown.service';

@Pipe({
  name: 'markdown',
  standalone: true,
  pure: true,
})
export class MarkdownPipe implements PipeTransform {
  constructor(private readonly md: MarkdownService) {}

  transform(value: string | null | undefined): string {
    return this.md.render(value || '');
  }
}
