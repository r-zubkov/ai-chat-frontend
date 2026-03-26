export function extractPlainTextFromHtml(html: string): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const parser = document.createElement('div');
  parser.innerHTML = html;

  return parser.innerText || parser.textContent || '';
}

export async function copyPlainTextToClipboard(text: string): Promise<boolean> {
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

export async function copyHtmlToClipboard(html: string, plainText: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }

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

  return copyPlainTextToClipboard(plainText);
}
