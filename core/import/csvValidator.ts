import type { ImportError } from './csvTypes';

export function normalizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim();
  let withScheme = trimmed;

  if (!/^https?:\/\//i.test(withScheme)) {
    withScheme = `https://${withScheme}`;
  }

  try {
    const parsed = new URL(withScheme);

    if (parsed.pathname === '/' || parsed.pathname === '') {
      parsed.pathname = '';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function hasRequiredHeaders(headers: string[]): boolean {
  const lower = headers.map((h) => h.trim().toLowerCase());
  return lower.includes('name');
}

export function validateHeaders(headers: string[]): ImportError | null {
  if (!headers || headers.length === 0) {
    return { row: 0, reason: 'No headers found' };
  }

  if (!hasRequiredHeaders(headers)) {
    return { row: 0, reason: 'Missing required header: name' };
  }

  return null;
}

export function validateRow(
  row: Record<string, string>,
  rowIndex: number
): ImportError | null {
  const lowerRow: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    lowerRow[key.toLowerCase()] = row[key];
  }

  const nameVal = lowerRow['name'] ?? '';
  if (!nameVal.trim()) {
    return { row: rowIndex, reason: 'Missing name' };
  }

  const urlVal = lowerRow['url'] ?? '';
  if (urlVal.trim()) {
    const normalized = normalizeUrl(urlVal);
    try {
      new URL(normalized);
    } catch {
      return { row: rowIndex, reason: `Invalid URL: ${urlVal}` };
    }
  }

  return null;
}
