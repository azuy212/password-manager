---
name: legend-state
description: >
  Expert guidance for using @legendapp/state v3 — a fast, fine-grained reactive
  state library for React and React Native. Use this skill whenever the user is
  working with Legend-State, including: creating observables, using useValue /
  observer / Memo in React components, setting up sync/persistence with Supabase,
  Keel, fetch, or TanStack Query, optimizing list rendering with the For
  component, debugging reactivity issues, or migrating from v1/v2 to v3. Trigger
  on mentions of "legend-state", "@legendapp/state", "observable()", "useValue",
  "syncedSupabase", "syncedKeel", or any fine-grained reactivity patterns.
---

# Legend-State v3 Skill

Legend-State is a super-fast, all-in-one local and remote state library. Its
core idea: observables track by *path*, not by value — so re-renders happen only
when the exact piece of state a component cares about changes.

## Key Mental Models

1. **Observables are Proxies** — they wrap raw data without modifying it. Every
   node in the tree has `get()`, `set()`, `peek()`, `delete()`, and `onChange()`.
2. **Tracking is explicit** — inside a component, only `useValue()` (or
   `observer`) creates subscriptions. Plain property access does *not* subscribe.
3. **Computed functions** are lazy observables — a function in an observable
   activates and caches when you first call `.get()` on it.
4. **Sync is declarative** — persistence and remote sync are configured *in* the
   observable, keeping UI code clean.

---

## Core API Quick Reference

### Creating observables

```ts
import { observable } from '@legendapp/state'

// Primitive
const count$ = observable(0)

// Object (deep)
const state$ = observable({
  user: { name: 'Zain', age: 30 },
  // Computed observable — lazy, recalculates on dependency changes
  greeting: () => `Hello, ${state$.user.name.get()}`,
  // Action
  reset: () => state$.user.assign({ name: '', age: 0 }),
})
```

### Reading and writing

```ts
state$.user.name.get()           // read (tracks in observing context)
state$.user.name.peek()          // read without tracking
state$.user.name.set('Ali')      // set
state$.user.assign({ age: 31 }) // shallow merge
state$.user.name.delete()        // delete key
```

### Naming convention

Suffix observable variables with `$` to make them visually distinct:
`state$`, `count$`, `profile$`.

---

## React Integration

### `useValue` — primary way to subscribe in React

```tsx
import { useValue } from '@legendapp/state/react'

function Counter() {
  const count = useValue(count$)           // subscribe to primitive
  const name  = useValue(state$.user.name) // subscribe to nested path
  const big   = useValue(() => count$.get() > 100) // computed subscription
  return <div>{name}: {count}</div>
}
```

> **v3 rule**: Prefer `useValue` over calling `.get()` directly inside render.
> `observer` wrapping is optional but collapses multiple `useValue` calls into
> one hook — good for large components.

### `observer` — optimization for many subscriptions

```tsx
import { observer, useValue } from '@legendapp/state/react'

const BigForm = observer(function BigForm() {
  const first = useValue(state$.first)
  const last  = useValue(state$.last)
  const email = useValue(state$.email)
  // ... all tracked in a single hook
})
```

### Fine-grained rendering — never re-render the parent

```tsx
import { Memo, For } from '@legendapp/state/react'

// Memo: self-updating text node, parent never re-renders
<Memo>{count$}</Memo>
<Memo>{() => <div>Count: {count$.get()}</div>}</Memo>

// For: optimized list rendering
<For each={state$.items} item={Row} />
// With optimized prop (re-uses React nodes — fastest, use for large lists)
<For each={state$.items} item={Row} optimized />
```

### Reactive components (two-way binding)

```tsx
// Web
import { $React } from '@legendapp/state/react-web'
<$React.input $value={state$.name} />
<$React.div $style={() => ({ color: state$.active.get() ? 'green' : 'red' })} />

// React Native
import { $TextInput, $View } from '@legendapp/state/react-native'
<$TextInput $value={state$.name} />
<$View $style={() => ({ opacity: state$.visible.get() ? 1 : 0.5 })} />
```

### Control-flow components

```tsx
import { Show, Switch, Computed } from '@legendapp/state/react'

// Show/hide without re-rendering parent
<Show if={state$.isLoggedIn} else={() => <Login />}>
  {() => <Dashboard />}
</Show>

// Switch on observable value
<Switch value={state$.tab}>
  {{ home: () => <Home />, profile: () => <Profile />, default: () => <NotFound /> }}
</Switch>

// Computed: extract children from parent renders
<Computed>{() => items$.map(i => <Row key={i.peek().id} item$={i} />)}</Computed>
```

---

## Arrays — Critical Patterns

```tsx
// ✅ Use peek() for keys to avoid tracking inside map
state$.items.map(item => <Row key={item.peek().id} item$={item} />)

// ✅ Use For component to prevent parent re-renders
<For each={state$.items} item={Row} />

// ✅ Arrays require unique `id` or `key` field for optimized rendering
// If field name differs:
const data$ = observable({
  arr: [],
  arr_keyExtractor: (item) => item._id,
})

// ✅ Batch bulk mutations
import { batch } from '@legendapp/state'
batch(() => {
  for (let i = 0; i < 1000; i++) state$.items.push({ id: i, text: `Item ${i}` })
})
```

---

## Sync & Persistence

See `references/sync.md` for full sync API details.

### Quick persistence setup

```ts
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'

const store$ = observable({ todos: [] })
syncObservable(store$, {
  persist: { name: 'todos', plugin: ObservablePersistMMKV }
})
```

### Supabase

```ts
import { syncedSupabase } from '@legendapp/state/sync-plugins/supabase'

const messages$ = observable(syncedSupabase({
  supabase,
  collection: 'messages',
  filter: (q) => q.eq('user_id', uid),
  realtime: { filter: `user_id=eq.${uid}` },
  persist: { name: 'messages', retrySync: true },
  changesSince: 'last-sync',
  fieldCreatedAt: 'created_at',
  fieldUpdatedAt: 'updated_at',
  fieldDeleted: 'deleted',
}))
```

### Keel

```ts
import { syncedKeel } from '@legendapp/state/sync-plugins/keel'

const messages$ = observable(syncedKeel({
  list: queries.listMessages,
  create: mutations.createMessage,
  update: mutations.updateMessage,
  delete: mutations.deleteMessage,
  changesSince: 'last-sync',
  persist: { name: 'messages', retrySync: true },
}))
```

### fetch

```ts
import { syncedFetch } from '@legendapp/state/sync-plugins/fetch'

const users$ = observable(syncedFetch({
  get: 'https://api.example.com/users',
  set: 'https://api.example.com/users',
}))
```

---

## Common Patterns

### Local state in a component

```tsx
import { useObservable, useValue } from '@legendapp/state/react'

function ProfileForm() {
  const form$ = useObservable({ name: '', email: '' })
  const name = useValue(form$.name)
  return <$TextInput $value={form$.name} />
}
```

### Computed observables

```ts
const state$ = observable({
  items: [] as Todo[],
  total: () => state$.items.length,
  completed: () => state$.items.get().filter(t => t.done).length,
})
```

### Linked observable (two-way transform)

```ts
import { linked } from '@legendapp/state'

const str$ = observable('[1,2,3]')
const arr$ = observable(linked({
  get: () => JSON.parse(str$.get()),
  set: (v) => str$.set(JSON.stringify(v)),
}))
```

### Lookup table (computed by key)

```ts
const state$ = observable({
  items: { id1: { text: 'hi' }, id2: { text: 'hello' } },
  item: (key: string) => state$.items[key],
})
state$.item('id1').text.get() // 'hi'
```

### Wait for async observable

```ts
import { when } from '@legendapp/state'

const profile$ = observable(syncedSupabase({ ... }))
await when(profile$.created_at) // resolves when truthy
```

### Observe side effects

```tsx
import { useObserve } from '@legendapp/state/react'

function Component() {
  const form$ = useObservable({ name: '' })
  useObserve(() => {
    document.title = form$.name.get()
  })
}
```

---

## v3 Migration Notes

| Old | New |
|-----|-----|
| `useSelector(obs)` | `useValue(obs)` |
| `use$(obs)` | `useValue(obs)` |
| `observer(() => obs.get())` | `observer(() => useValue(obs))` |
| `computed(() => ...)` | `observable(() => ...)` or inline function |
| `persistObservable(...)` | `syncObservable(...)` |
| `configureObservablePersistence` | `configureSynced(...)` |
| `Reactive.div` | `$React.div` (from `react-web`) |
| `Reactive.View` | `$View` (from `react-native`) |
| `enableReactTracking({ auto: true })` | Deprecated — use `useValue` |

**Important**: `observer` no longer enables `.get()` to track directly. Always
use `useValue()` inside `observer`. The `observer` wrapper is now purely a
performance optimization that merges multiple `useValue` hooks into one.

---

## Performance Checklist

- [ ] Use `For` instead of `.map()` in render for observable arrays
- [ ] Use `peek()` when accessing observable values for React `key` props
- [ ] Use `batch()` when setting many observables at once
- [ ] Use `Memo` to isolate frequently-updating values from parent renders
- [ ] Call `.get()` at the highest practical level to avoid deep proxy creation
- [ ] Use `ObservableHint.opaque()` for large objects (DOM nodes, React elements)
  that don't need reactivity
- [ ] Use `ObservableHint.plain()` for large static child objects

---

## Reference Files

- `references/sync.md` — Full sync/persistence API (synced, syncObservable,
  configureSynced, syncState, all persist plugins, transform, retry, subscribe)
- `references/reactivity.md` — observe, when, onChange, batching, shallow
  tracking, observing context details
