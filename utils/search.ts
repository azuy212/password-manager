import type { VaultEntry } from '../types/vault';

const SCORE = {
  HOST_EXACT: 200,
  DOMAIN_MATCH: 150,
  TITLE_EXACT: 100,
  TITLE_STARTS_WITH: 90,
  HOST_EXACT_MATCH: 85,
  HOST_STARTS_WITH: 80,
  USERNAME_STARTS_WITH: 70,
  HOST_CONTAINS: 60,
  TITLE_CONTAINS: 50,
  USERNAME_CONTAINS: 40,
  NOTES_CONTAINS: 20,
} as const;

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

export interface SearchOptions {
  query?: string
  currentHost?: string
  mode: 'relevant' | 'all' | 'favorites' | 'search'
}

function extractHost(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '').toLowerCase();
  }
}

function registrableDomain(host: string): string {
  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts.slice(-2).join('.');
  }
  return host;
}

function entryUrlHost(entry: VaultEntry): string | null {
  if (!entry.url) return null;
  const url = entry.url.trim();
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '').toLowerCase();
  }
}

function scoreEntry(
  entry: VaultEntry,
  query: string,
  currentHost: string | undefined,
  mode: string,
): number {
  const q = query.toLowerCase();
  const title = entry.title?.toLowerCase() ?? '';
  const username = entry.username?.toLowerCase() ?? '';
  const host = entryUrlHost(entry);
  const hostStr = host ?? '';
  const notes = entry.notes?.toLowerCase() ?? '';

  let score = 0;

  if (q) {
    if (title === q) score += SCORE.TITLE_EXACT;
    else if (title.startsWith(q)) score += SCORE.TITLE_STARTS_WITH;
    if (hostStr === q) score += SCORE.HOST_EXACT_MATCH;
    else if (hostStr.startsWith(q)) score += SCORE.HOST_STARTS_WITH;
    if (username.startsWith(q)) score += SCORE.USERNAME_STARTS_WITH;
    if (hostStr.includes(q)) score += SCORE.HOST_CONTAINS;
    if (title.includes(q)) score += SCORE.TITLE_CONTAINS;
    if (username.includes(q)) score += SCORE.USERNAME_CONTAINS;
    if (notes.includes(q)) score += SCORE.NOTES_CONTAINS;
  }

  if (mode === 'relevant' && currentHost && host) {
    if (host === currentHost) score += SCORE.HOST_EXACT;
    else if (registrableDomain(host) === registrableDomain(currentHost)) score += SCORE.DOMAIN_MATCH;
  }

  return score;
}

export function searchEntries(entries: VaultEntry[], options: SearchOptions): VaultEntry[] {
  const { query, currentHost, mode } = options;

  if (mode === 'favorites') {
    const fav = entries.filter(e => e.extras?.favorite === true);
    const q = query?.trim();
    if (q) {
      return fav
        .map(e => ({ entry: e, score: scoreEntry(e, q, currentHost, mode) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score || ((b.entry.extras?.lastUsedAt as number) ?? 0) - ((a.entry.extras?.lastUsedAt as number) ?? 0))
        .map(s => s.entry);
    }
    return fav.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (mode === 'all') {
    if (query?.trim()) {
      const q = query.trim();
      return entries
        .map(e => ({ entry: e, score: scoreEntry(e, q, undefined, 'search') }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score || ((b.entry.extras?.lastUsedAt as number) ?? 0) - ((a.entry.extras?.lastUsedAt as number) ?? 0))
        .map(s => s.entry);
    }
    return [...entries].sort((a, b) => a.title.localeCompare(b.title));
  }

  if (mode === 'relevant') {
    const q = query?.trim();
    if (q) {
      return entries
        .map(e => ({ entry: e, score: scoreEntry(e, q, currentHost, mode) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score || ((b.entry.extras?.lastUsedAt as number) ?? 0) - ((a.entry.extras?.lastUsedAt as number) ?? 0))
        .map(s => s.entry);
    }
    return [...entries]
      .map(e => ({ entry: e, score: scoreEntry(e, '', currentHost, mode) }))
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
      .map(s => s.entry);
  }

  const q = query?.trim();
  if (!q) return [...entries].sort((a, b) => a.title.localeCompare(b.title));

  return entries
    .map(e => ({ entry: e, score: scoreEntry(e, q, undefined, 'search') }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || ((b.entry.extras?.lastUsedAt as number) ?? 0) - ((a.entry.extras?.lastUsedAt as number) ?? 0))
    .map(s => s.entry);
}
