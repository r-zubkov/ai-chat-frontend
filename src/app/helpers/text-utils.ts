export function truncateAtWord(
  text: string,
  maxLength: number,
  ellipsis: string | null = '…', // можно передать null, чтобы не добавлять троеточие
): string {
  if (!text || maxLength <= 0) return '';

  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  // Ищем последний пробел до лимита
  const boundary = trimmed.lastIndexOf(' ', maxLength);

  let result: string;

  if (boundary === -1) {
    // Если пробелов нет — режем жёстко по символам
    result = trimmed.slice(0, maxLength);
  } else {
    // Обрезаем по последнему слову
    result = trimmed.slice(0, boundary);
  }

  result = result.replace(/\s+$/g, ''); // убираем пробелы в конце

  if (ellipsis) {
    result += ellipsis;
  }

  return result;
}