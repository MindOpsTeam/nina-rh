// Helpers PT-BR (normalização, slug).
export function stripAccents(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugify(s: string, maxLen = 60): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
}
