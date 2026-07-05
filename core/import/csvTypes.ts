export interface ImportError {
  row: number;
  reason: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  totalRows: number;
  errors: ImportError[];
}

export interface PreparedEntry {
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  extras?: Record<string, string | number | boolean>;
}

export interface CsvImportOptions {
  vaultId: string;
  createEntry(input: {
    vaultId: string;
    title: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
    extras?: Record<string, string | number | boolean>;
  }): Promise<unknown>;
  existingKeys: ReadonlySet<string>;
  onProgress?(completed: number, total: number): void;
}
