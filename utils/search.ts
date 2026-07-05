import type { VaultEntry } from '../types/vault';

export function getSearchText(entry: VaultEntry): string {
  const parts: (string | undefined)[] = [
    entry.title,
    entry.username,
    entry.url,
    entry.notes,
  ];

  if (entry.extras) {
    Object.values(entry.extras).forEach((value) => {
      if (value != null) {
        parts.push(String(value));
      }
    });
  }

  return parts
    .filter((p): p is string => p != null && p !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
