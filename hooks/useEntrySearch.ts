import { useMemo, useState } from 'react';
import type { VaultEntry } from '../types/vault';
import { getSearchText } from '../utils/search';

export function useEntrySearch(entries: VaultEntry[]) {
  const [searchQuery, setSearchQuery] = useState('');

  const searchableEntries = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        searchText: getSearchText(entry),
      })),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;

    return searchableEntries
      .filter((s) => s.searchText.includes(query))
      .map((s) => s.entry);
  }, [searchQuery, searchableEntries, entries]);

  const isSearching = searchQuery.trim().length > 0;

  return { searchQuery, setSearchQuery, filteredEntries, isSearching };
}
