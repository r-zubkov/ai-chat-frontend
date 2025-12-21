export function buildTextHash(text: string): string {
  let hashNum = 0;

  for (let i = 0; i < text.length; i++) {
    hashNum = (hashNum * 31 + text.charCodeAt(i)) | 0;
  }

  return hashNum.toString(16);
}