import { normalizeUrl } from './csvValidator';

export function createEntryKey(
  title: string,
  username: string,
  url?: string
): string {
  const parts = [
    title.trim().toLowerCase(),
    username.trim().toLowerCase(),
  ];

  if (url) {
    parts.push(normalizeUrl(url).toLowerCase());
  }

  return parts.join('|');
}
