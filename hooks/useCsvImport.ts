import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { importCsv, createEntryKey } from '../core/import';
import { getMasterKey } from '../core/masterKeyStore';
import { createEntry, decryptVaultKey, getEntriesForVault } from '../core/vault/vaultService';
import { appStore$ } from '../store/appStore';
import type { Vault } from '../types/vault';

const CSV_EXT = '.csv';
const CSV_MIME = 'text/csv';

function showAlert(title: string, message?: string): void {
  const text = message ? `${title}\n${message}` : title;
  console.log(`[CSV Import] ${text}`);
  if (Platform.OS === 'web') {
    window.alert(text);
  } else {
    Alert.alert(title, message);
  }
}

function isValidCsvFile(file: DocumentPicker.DocumentPickerAsset): boolean {
  if (file.mimeType && file.mimeType !== CSV_MIME && !file.mimeType.includes('csv')) {
    return false;
  }

  if (file.name && !file.name.toLowerCase().endsWith(CSV_EXT)) {
    return false;
  }

  return true;
}

function formatImportResult(result: Awaited<ReturnType<typeof importCsv>>): string {
  const lines: string[] = [
    `Imported: ${result.imported} / ${result.totalRows}`,
  ];

  if (result.duplicates > 0) {
    lines.push(`Duplicates: ${result.duplicates}`);
  }

  if (result.skipped > 0) {
    lines.push(`Skipped: ${result.skipped}`);
  }

  if (result.errors.length > 0) {
    const sample = result.errors.slice(0, 10);
    lines.push('', 'Errors:');
    for (const e of sample) {
      lines.push(`Row ${e.row} - ${e.reason}`);
    }
    if (result.errors.length > 10) {
      lines.push(`...and ${result.errors.length - 10} more`);
    }
  }

  return lines.join('\n');
}

async function importCsvText(
  csvText: string,
  vaultId: string,
  setIsImporting: (v: boolean) => void,
  onComplete?: () => void,
): Promise<void> {
  const masterKey = getMasterKey();
  if (!masterKey) {
    showAlert('Error', 'Not authenticated');
    return;
  }

  setIsImporting(true);

  try {
    const vaults = appStore$.vaults.get();
    const vault = vaults.find((v: Vault) => v.id === vaultId);

    if (!vault) {
      showAlert('Error', 'Vault not found');
      return;
    }

    const vaultKey = await decryptVaultKey(vault.encryptedEncryptionKey, masterKey);
    try {
      const existing = await getEntriesForVault(vaultId, vaultKey);
      const existingKeys = new Set(
        existing.map((e) => createEntryKey(e.title, e.username, e.url))
      );

      const importResult = await importCsv(csvText, {
        vaultId,
        createEntry: (input) => createEntry(input, vaultKey),
        existingKeys,
      });

      showAlert('Import Complete', formatImportResult(importResult));
      onComplete?.();
    } finally {
      vaultKey.destroy();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Import failed';
    showAlert('Import Error', message);
  } finally {
    setIsImporting(false);
  }
}

export function useCsvImport(onComplete?: () => void) {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = useCallback(async (vaultId: string) => {
    if (isImporting) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [CSV_MIME, 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];

      if (!isValidCsvFile(file)) {
        showAlert('Invalid File', 'Please select a CSV file');
        return;
      }

      const response = await fetch(file.uri);
      const csvText = await response.text();

      await importCsvText(csvText, vaultId, setIsImporting, onComplete);
    } catch {
      showAlert('Error', 'Import failed');
    }
  }, [isImporting, onComplete]);

  return { isImporting, importCsvFromFile: handleImport };
}
