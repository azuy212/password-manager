import type { CsvImportOptions, ImportResult, PreparedEntry } from './csvTypes';
import { parseCsv } from './csvParser';
import { validateHeaders, validateRow } from './csvValidator';
import { transformRow } from './csvTransformer';
import { createEntryKey } from './dedup';

async function runConcurrent<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

export async function importCsv(
  csv: string,
  options: CsvImportOptions
): Promise<ImportResult> {
  const { vaultId, createEntry, onProgress } = options;
  const seenKeys = new Set(options.existingKeys);
  const errors: ImportResult['errors'] = [];
  let duplicates = 0;
  let skipped = 0;

  const parsed = parseCsv(csv);

  const headerError = validateHeaders(parsed.headers);
  if (headerError) {
    throw new Error(headerError.reason);
  }

  const entries: PreparedEntry[] = [];
  const totalDataRows = parsed.rows.length;

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const csvRowNum = i + 2;

    const validationError = validateRow(row, csvRowNum);
    if (validationError) {
      errors.push(validationError);
      skipped++;
      continue;
    }

    const entry = transformRow(row);
    const key = createEntryKey(entry.title, entry.username, entry.url);

    if (seenKeys.has(key)) {
      duplicates++;
      continue;
    }

    seenKeys.add(key);
    entries.push(entry);
  }

  let imported = 0;

  await runConcurrent(entries, async (entry) => {
    await createEntry({
      vaultId,
      title: entry.title,
      username: entry.username,
      password: entry.password,
      url: entry.url,
      notes: entry.notes,
      extras: entry.extras,
    });
    imported++;
    onProgress?.(imported, totalDataRows);
  }, 8);

  return {
    imported,
    skipped,
    duplicates,
    totalRows: totalDataRows,
    errors,
  };
}
