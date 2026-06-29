# Legend-State Sync & Persistence Reference

## Table of Contents
1. [synced](#synced)
2. [syncObservable](#syncobservable)
3. [configureSynced](#configuresynced)
4. [syncState](#syncstate)
5. [Persist Plugins](#persist-plugins)
6. [syncedCrud](#syncedcrud)
7. [syncedFetch](#syncedfetch)
8. [syncedSupabase](#syncedsupabase)
9. [syncedKeel](#syncedkeel)
10. [TanStack Query](#tanstack-query)
11. [Transform](#transform)
12. [Retry & Debounce](#retry--debounce)

---

## synced

Creates a lazy computed observable that activates on first `get()`. Use inside
`observable()` constructor.

```ts
import { observable } from '@legendapp/state'
import { synced } from '@legendapp/state/sync'

const state$ = observable(synced({
  get: () => fetch('https://api/data').then(r => r.json()),
  set: ({ value }) => fetch('https://api/data', { method: 'POST', body: JSON.stringify(value) }),
  initial: { items: [] },
  persist: {
    name: 'mydata',
    plugin: ObservablePersistLocalStorage,
    retrySync: true,   // persist pending changes for retry after restart
  },
  retry: { infinite: true, backoff: 'exponential', maxDelay: 30 },
  debounceSet: 500,
  mode: 'set',         // 'set' | 'assign' | 'merge' | 'append' | 'prepend'
  subscribe: ({ refresh, update }) => {
    const unsub = realtime.subscribe(() => refresh())
    return unsub // return unsubscribe fn
  },
}))
```

**Key difference from `syncObservable`**: `synced` is lazy — it only activates
when `get()` is called. `syncObservable` activates immediately.

---

## syncObservable

Attaches sync/persist to an already-created observable. Starts syncing immediately.

```ts
import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'

const store$ = observable({ todos: [] })
syncObservable(store$, {
  persist: { name: 'todos', plugin: ObservablePersistMMKV }
})
```

With a plugin:
```ts
import { syncedFetch } from '@legendapp/state/sync-plugins/fetch'

const users$ = observable([])
syncObservable(users$, syncedFetch({
  get: 'https://api/users',
  set: 'https://api/users',
}))
```

---

## configureSynced

Creates a reusable factory with default options merged into each call.

```ts
import { configureSynced } from '@legendapp/state/sync'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'

// Base defaults
const syncPlugin = configureSynced({
  persist: { plugin: ObservablePersistMMKV },
})

// Plugin-specific defaults
const crudSync = configureSynced(syncedCrud, {
  persist: { plugin: ObservablePersistMMKV },
  retry: { infinite: true },
  debounceSet: 500,
  changesSince: 'last-sync',
})

// Usage — options merge on top of defaults
const profile$ = observable(crudSync({
  get: getProfile,
  create: createProfile,
  update: updateProfile,
  persist: { name: 'profile' },
}))
```

---

## syncState

Read the sync/persist status of any synced observable.

```ts
import { syncState } from '@legendapp/state'

const status$ = syncState(store$)

// Status fields:
status$.isPersistLoaded.get()  // boolean — local persistence loaded
status$.isLoaded.get()         // boolean — remote get() has returned
status$.error.get()            // Error | undefined
status$.lastSync.get()         // number — timestamp of last sync
status$.syncCount.get()        // number — how many times synced
status$.isSyncEnabled.get()    // boolean — toggle remote sync

// Actions:
await status$.clearPersist()   // clear local storage
await status$.sync()           // re-run get()
status$.getPendingChanges()    // Record<string, object> of unsaved changes

// Wait for async persistence to load:
import { when } from '@legendapp/state'
await when(status$.isPersistLoaded)
```

---

## Persist Plugins

### Local Storage (web)

```ts
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage'
syncObservable(state$, {
  persist: { name: 'key', plugin: ObservablePersistLocalStorage }
})
```

### IndexedDB (web)

```ts
import { observablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'

const plugin = observablePersistIndexedDB({
  databaseName: 'MyApp',
  version: 1,
  tableNames: ['documents', 'settings'],
})

// Mode 1: dictionary (each value must have an `id`)
syncObservable(docs$, { persist: { name: 'documents', plugin } })

// Mode 2: single object with itemID
syncObservable(settings$, { persist: { name: 'settings', plugin, indexedDB: { itemID: 'app-settings' } } })

// IndexedDB is async — wait before reading:
await when(syncState(state$).isPersistLoaded)
```

### MMKV (React Native)

```ts
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
syncObservable(state$, {
  persist: { name: 'store', plugin: ObservablePersistMMKV }
})
```

### AsyncStorage (React Native)

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { observablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage'
import { configureSynced } from '@legendapp/state/sync'

const syncBase = configureSynced({
  persist: { plugin: observablePersistAsyncStorage({ AsyncStorage }) }
})

syncObservable(state$, syncBase({ persist: { name: 'store' } }))
await when(syncState(state$).isPersistLoaded) // AsyncStorage is async
```

### Expo SQLite (React Native)

```ts
import Storage from 'expo-sqlite/kv-store'
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite'
import { configureSynced } from '@legendapp/state/sync'

const syncBase = configureSynced({
  persist: { plugin: observablePersistSqlite(Storage) }
})
```

---

## syncedCrud

Built-in plugin for backends with list/get/create/update/delete operations.
All specific plugins (Supabase, Keel) are built on top of this.

### `get` mode (single value)

```ts
const profile$ = observable(syncedCrud({
  get: getProfile,           // returns single object or null
  create: createProfile,     // called when value was null, now has a value
  update: updateProfile,     // called with changed fields
  delete: deleteProfile,     // called when set to null/undefined
}))
```

- If `get` returns null → next `set()` triggers `create`
- If `get` returns a value → `set()` triggers `update`
- Setting to null/undefined triggers `delete`

### `list` mode (collection)

```ts
const profiles$ = observable(syncedCrud({
  list: listProfiles,        // returns array
  create: createProfile,
  update: updateProfile,
  delete: deleteProfile,
  as: 'object',              // 'object' (default) | 'array' | 'Map' | 'value'
}))
// profiles$.get() is Record<string, Profile>
```

### Key options

```ts
syncedCrud({
  // ...
  fieldCreatedAt: 'created_at',  // auto-detect create vs update
  fieldUpdatedAt: 'updated_at',  // required for changesSince: 'last-sync'
  fieldDeleted: 'deleted',       // soft delete field
  updatePartial: true,           // send only changed fields in update
  changesSince: 'last-sync',     // only sync diffs (requires fieldUpdatedAt)
  generateId: () => uuid(),      // generate local IDs before create
  onSavedUpdate: 'createdUpdatedAt', // auto-apply server timestamps back
  onSaved: ({ saved, input, currentValue, isCreate }) => ({ serverField: saved.serverField }),
  subscribe: ({ refresh, update }) => {
    const unsub = realtime.subscribe((data) => update(data))
    return unsub
  },
  debounceSet: 500,
  retry: { infinite: true },
})
```

### Soft deletes

Setting `fieldDeleted` means delete calls `update({ deleted: true })` instead
of a real delete, so deleted rows remain visible to the sync engine.

---

## syncedFetch

Simple wrapper around `fetch`.

```ts
import { syncedFetch } from '@legendapp/state/sync-plugins/fetch'

const state$ = observable(syncedFetch({
  get: 'https://api/data',
  set: 'https://api/data',
  getInit: { headers: { Authorization: 'Bearer ...' } },
  setInit: { method: 'POST' },           // default
  valueType: 'json',                     // default
  onSaved: (value) => ({ updatedAt: value.updatedAt }),
}))

// Dynamic URL (reactive — re-fetches when observable changes)
const page$ = observable(1)
const users$ = observable(syncedFetch({
  get: () => `https://api/users?page=${page$.get()}`,
  mode: 'append',  // append new pages
}))
```

---

## syncedSupabase

```ts
import { syncedSupabase, configureSyncedSupabase } from '@legendapp/state/sync-plugins/supabase'
import { v4 as uuidv4 } from 'uuid'

// Global config (call once at app init)
configureSyncedSupabase({
  generateId: () => uuidv4(),
  changesSince: 'last-sync',
  fieldCreatedAt: 'created_at',
  fieldUpdatedAt: 'updated_at',
  fieldDeleted: 'deleted',
})

const messages$ = observable(syncedSupabase({
  supabase,                          // typed Supabase client
  collection: 'messages',
  select: (from) => from.select('id,text,user_id'),
  filter: (q) => q.eq('user_id', uid),
  actions: ['read', 'create', 'update'],  // omit 'delete' to disallow
  realtime: true,
  realtime: { schema: 'public', filter: `user_id=eq.${uid}` },
  as: 'object',                      // 'object' | 'Map' | 'value'
  persist: { name: 'messages', retrySync: true },
  changesSince: 'last-sync',
}))
```

### Adding a new row

```ts
const id = uuidv4()
messages$[id].set({
  id,
  text: 'Hello',
  created_at: null,   // Supabase fills this in on create
  updated_at: null,
})
```

### Supabase SQL for changesSince support

```sql
ALTER TABLE messages
  ADD COLUMN created_at timestamptz default now(),
  ADD COLUMN updated_at timestamptz default now(),
  ADD COLUMN deleted boolean default false;

CREATE OR REPLACE FUNCTION handle_times() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN NEW.created_at = OLD.created_at; NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER handle_times
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE PROCEDURE handle_times();
```

### Using RPC / Edge Functions

```ts
syncedSupabase({
  supabase,
  collection: 'messages',
  list: () => supabase.rpc('list_messages'),
  create: (input) => supabase.rpc('create_message', input),
})
```

---

## syncedKeel

```ts
import { syncedKeel } from '@legendapp/state/sync-plugins/keel'
import KSUID from 'ksuid'  // npm install ksuid

const { mutations, queries } = client.api

// Configure globally
const sync = configureSynced(syncedKeel, {
  client,
  persist: { plugin: ObservablePersistLocalStorage, retrySync: true },
  debounceSet: 500,
  retry: { infinite: true },
  changesSince: 'last-sync',
  waitFor: isAuthed$,  // observable — waits until truthy to begin syncing
})

// List (collection)
const messages$ = observable(sync({
  list: queries.listMessages,
  create: mutations.createMessage,
  update: mutations.updateMessage,
  delete: mutations.deleteMessage,
  persist: { name: 'messages' },
}))

// Single value (get)
const profile$ = observable(syncedKeel({
  get: queries.getProfile,
  create: mutations.createProfile,
  update: mutations.updateProfile,
}))

// Add new row with local ID
function addMessage(text: string) {
  const id = KSUID.randomSync().string
  messages$[id].set({ id, text, createdAt: undefined, updatedAt: undefined })
}

// Wait for Keel to confirm creation (it sets createdAt)
await when(messages$[id].createdAt)
```

### Keel model requirements

```
model Message {
  fields { text Text }
  actions {
    list listMessages(updatedAt?)          // updatedAt? for changesSince
    create createMessage() with (id?, text) // id? for local ID generation
    update updateMessage(id) with (text?)  // all changeable fields optional
    delete deleteMessage(id)
  }
}
```

### `waitForSet` — ordering dependent tables

```ts
const rooms$ = observable(syncedKeel({ list: queries.listRooms, ... }))
const msgs$ = observable((roomId: string) => syncedKeel({
  list: queries.getRoomMessages,
  where: { roomId },
  create: (msg) => mutations.createMessage({ roomId, ...msg }),
  waitForSet: rooms$[roomId].createdAt, // don't save until room exists
}))
```

---

## TanStack Query

### Inside React (hook)

```tsx
import { useObservableSyncedQuery } from '@legendapp/state/sync-plugins/tanstack-react-query'
import { useValue } from '@legendapp/state/react'

function Component() {
  const data$ = useObservableSyncedQuery({
    query: {
      queryKey: ['user'],
      queryFn: () => fetch('/api/user').then(r => r.json()),
    },
    mutation: {
      mutationFn: (vars) => fetch('/api/user', { method: 'POST', body: JSON.stringify(vars) }),
    },
  })
  const data = useValue(data$)
  return <$React.input $value={data$.first_name} />
}
```

### Outside React

```ts
import { syncedQuery } from '@legendapp/state/sync-plugins/tanstack-query'

const state$ = observable(syncedQuery({
  queryClient,
  query: { queryKey: ['user'], queryFn: ... },
  mutation: { mutationFn: ... },
}))
```

---

## Transform

Transform data between observable format and storage/remote format.

```ts
import { combineTransforms, transformStringifyDates, transformStringifyKeys } from '@legendapp/state/sync'

synced({
  // ...
  // Remote transform (in/out of sync functions)
  transform: combineTransforms(
    transformStringifyDates(),                    // dates → ISO strings
    transformStringifyKeys('jsonField'),          // stringify object at key
    {
      load: async (value) => { /* transform incoming */ return value },
      save: async (value) => { /* transform outgoing */ return value },
    }
  ),
  // Persist transform (in/out of local storage)
  persist: {
    name: 'data',
    transform: {
      load: (value) => {
        // Migrate old format
        if (value.version < 2) value = migrate(value)
        return value
      },
    },
  },
})
```

---

## Retry & Debounce

```ts
synced({
  // ...
  retry: {
    infinite: true,          // keep retrying forever
    backoff: 'exponential',  // 'none' | 'constant' | 'exponential'
    maxDelay: 30,            // seconds
    times: 3,                // max attempts (ignored if infinite: true)
  },
  debounceSet: 500,          // ms — batch rapid changes before sending to server
})
```

---

## Local-First Pattern (Full Config)

```ts
const sync = configureSynced(syncedCrud, {
  persist: {
    plugin: ObservablePersistMMKV,
    retrySync: true,        // persist pending changes across app restarts
  },
  retry: { infinite: true },
  debounceSet: 500,
  changesSince: 'last-sync',
  fieldUpdatedAt: 'updated_at',
  fieldDeleted: 'deleted',
})

const items$ = observable(sync({
  list: () => api.listItems(),
  create: (item) => api.createItem(item),
  update: (item) => api.updateItem(item),
  subscribe: ({ refresh }) => {
    return pusher.subscribe('items', () => refresh())
  },
  persist: { name: 'items' },
}))
```
