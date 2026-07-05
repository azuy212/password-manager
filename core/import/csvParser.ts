import Papa from 'papaparse';
import type { ParseError } from 'papaparse';

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(input: string): ParsedCSV {
  if (!input || input.trim().length === 0) {
    throw new Error('CSV file is empty');
  }

  const cleaned = input.charCodeAt(0) === 0xFEFF ? input.slice(1) : input;

  const result = Papa.parse<Record<string, string>>(cleaned.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
    transform: (val: string) => val.trim(),
  });

  if (result.errors.length > 0) {
    const parseErrors = result.errors
      .filter(
        (e: ParseError) =>
          e.type === 'FieldMismatch' || e.type === 'Quotes'
      )
      .map((e: ParseError) => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
    if (parseErrors.length > 0) {
      throw new Error(`CSV parse failed:\n${parseErrors.join('\n')}`);
    }
  }

  const rows = result.data.filter(
    (row: Record<string, string>) =>
      row && Object.keys(row).length > 0
  );

  if (rows.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  const headers = Object.keys(rows[0]);

  return { headers, rows };
}
