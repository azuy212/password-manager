import type { PreparedEntry } from './csvTypes';
import { normalizeUrl } from './csvValidator';

const KNOWN_LOWER: Record<string, string> = {
  name: 'title',
  username: 'username',
  password: 'password',
  url: 'url',
  extra: 'notes',
};

export function transformRow(row: Record<string, string>): PreparedEntry {
  const trimmed: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    trimmed[key] = (row[key] ?? '').trim();
  }

  let title = '';
  let username = '';
  let password = '';
  let rawUrl = '';
  let notes: string | undefined;

  const extras: Record<string, string | number | boolean> = {};

  for (const key of Object.keys(trimmed)) {
    const val = trimmed[key];
    const keyLower = key.toLowerCase();
    const mapped = KNOWN_LOWER[keyLower];

    if (mapped === 'title') {
      title = val;
    } else if (mapped === 'username') {
      username = val;
    } else if (mapped === 'password') {
      password = val;
    } else if (mapped === 'url') {
      rawUrl = val;
    } else if (mapped === 'notes') {
      notes = val || undefined;
    } else if (val !== '') {
      extras[key] = val;
    }
  }

  const url = rawUrl ? normalizeUrl(rawUrl) || undefined : undefined;

  const hasExtras = Object.keys(extras).length > 0;

  return {
    title,
    username,
    password,
    url,
    notes,
    ...(hasExtras ? { extras } : {}),
  };
}
