# Legend-State Reactivity Reference

## Table of Contents
1. [Observing Contexts](#observing-contexts)
2. [observe](#observe)
3. [when](#when)
4. [onChange](#onchange)
5. [Batching](#batching)
6. [Shallow Tracking](#shallow-tracking)
7. [React Hooks](#react-hooks)
8. [Tracing & Debugging](#tracing--debugging)

---

## Observing Contexts

An **observing context** is any function that automatically tracks observable
`get()` calls and re-runs when those observables change.

| Context | How it tracks |
|---------|---------------|
| `observe(fn)` | Runs `fn`, tracks all `get()` calls, re-runs on change |
| `when(selector, fn)` | Like observe but fires `fn` only once (when truthy) |
| `useValue(obs \| fn)` | React hook — subscribes component to observable |
| `observer(Component)` | Makes all `useValue` calls in the component use one hook |
| Computed observable `fn` | Activates on first `get()`, re-runs on dependency change |
| `synced` get function | Re-runs if observables accessed inside it change |

### What tracks vs. what doesn't

**Tracks** (creates subscription):
```ts
obs.get()               // explicit track
obs.prop.get()          // nested track
arr.map(...)            // shallow track (see below)
arr.length              // shallow track
Object.keys(obs.get())  // shallow track
```

**Does NOT track**:
```ts
obs.prop               // accessing node without get()
obs.peek()             // explicit no-track read
```

---

## observe

Runs a function in a reactive context. Automatically re-runs whenever any
`get()` called inside it changes.

```ts
import { observe, observable } from '@legendapp/state'

const state$ = observable({ count: 0, online: true })

const dispose = observe((e) => {
  console.log('count is', state$.count.get())

  // Cleanup runs before next re-execution
  e.cleanup = () => console.log('cleaning up')

  // Cancel further observations
  // e.cancel = true

  // e.num — how many times this has run (0-indexed)
  // e.previous — return value of previous run
})

// Stop observing
dispose()
```

**Cleanup pattern** (useful for subscriptions, timers):

```ts
observe((e) => {
  if (state$.isOnline.get()) {
    const id = setInterval(() => poll(), 5000)
    e.cleanup = () => clearInterval(id)
  }
})
```

---

## when

Runs callback **once** when the selector returns truthy. Returns a Promise if
no callback is provided.

```ts
import { when } from '@legendapp/state'

// Promise form
const value = await when(state$.isLoaded)
const value = await when(() => state$.user.name.get().length > 0)

// Callback form
when(state$.isReady, () => console.log('Ready!'))
when(() => state$.count.get() > 10, () => console.log('Count exceeded 10'))

// Cancel
const dispose = when(state$.isReady, () => { ... })
dispose() // cancel before it fires
```

`whenReady` is the same but only fires when the value is "ready" (not empty
object, not empty array):

```ts
import { whenReady } from '@legendapp/state'
await whenReady(state$.user)
```

---

## onChange

Listen to changes on a specific node. Fires for any change in the subtree.

```ts
state$.user.name.onChange(({ value, getPrevious, changes }) => {
  console.log('name changed to', value)
  console.log('was', getPrevious())
})

// Shallow — only fires when keys are added/removed, not when children change
state$.user.onChange(handler, { trackingType: true })

// Fire immediately with current value
state$.user.onChange(handler, { initial: true })

// Unsubscribe
const unsub = state$.user.name.onChange(handler)
unsub()
```

---

## Batching

Delays all notifications until the batch completes. Prevents intermediate
renders and excess storage writes.

```ts
import { batch, beginBatch, endBatch } from '@legendapp/state'

// Function form (preferred)
batch(() => {
  state$.a.set(1)
  state$.b.set(2)
  state$.c.set(3)
  // Observers notified once after this runs
})

// Begin/end form
beginBatch()
state$.a.set(1)
state$.b.set(2)
endBatch() // notifies here

// Critical: always batch large array mutations
batch(() => {
  for (let i = 0; i < 1000; i++) state$.items.push({ id: i })
})
```

---

## Shallow Tracking

A shallow listener fires when **keys are added or removed** from an object or
array, but not when child values change. Use this in parent list components so
they only re-render when items are added/removed, not when each item updates.

```ts
// In observe
observe(() => {
  // Only re-runs when items are added/removed, not when item content changes
  state$.items.get(true) // pass true for shallow
})

// In useValue
const itemCount = useValue(() => state$.items.get(true).length)

// In onChange
state$.items.onChange(handler, { trackingType: true })
```

Legend-State's array methods (`map`, `filter`, `find`, `forEach`, etc.) set up
shallow tracking automatically.

---

## React Hooks

### useObserve / useObserveEffect

Like `observe` but tied to component lifecycle.

```tsx
import { useObserve, useObserveEffect } from '@legendapp/state/react'

function Component() {
  const form$ = useObservable({ name: '' })

  // Runs during render when observables change
  useObserve(() => {
    document.title = form$.name.get()
  })

  // Same but runs after mount (like useEffect)
  useObserveEffect(() => {
    analytics.track('view', { name: form$.name.get() })
  })

  // With selector + callback (selector is tracked, callback is not)
  useObserve(form$.name, ({ value }) => {
    validate(value)
  })
}
```

### useWhen / useWhenReady

```tsx
import { useWhen, useWhenReady } from '@legendapp/state/react'

function Component() {
  useWhen(state$.isLoaded, () => {
    // Runs once when isLoaded becomes truthy
    initSomething()
  })
}
```

### useMount / useUnmount

```tsx
import { useMount, useUnmount } from '@legendapp/state/react'

function Component() {
  useMount(() => console.log('mounted'))
  useUnmount(() => console.log('unmounted'))
}
```

### useIsMounted

```tsx
import { useIsMounted } from '@legendapp/state/react'

function Component() {
  const isMounted = useIsMounted()

  const onClick = () => {
    setTimeout(() => {
      if (isMounted.get()) doSomething()
    }, 100)
  }
}
```

### usePauseProvider

Stop all Legend-State rendering under a context (e.g., hidden screens in RN).

```tsx
import { usePauseProvider } from '@legendapp/state/react'

function App() {
  const { PauseProvider, paused$ } = usePauseProvider()

  return (
    <PauseProvider>
      {/* Pause rendering when a modal covers this */}
      <Screen />
    </PauseProvider>
  )
}
// paused$.set(true) to pause, paused$.set(false) to resume
```

---

## Tracing & Debugging

### useTraceListeners

Log all observables a component is tracking.

```tsx
import { useTraceListeners } from '@legendapp/state/trace'

const Component = observer(function Component() {
  useTraceListeners('MyComponent') // optional name arg
  const count = useValue(state$.count)
  return <div>{count}</div>
  // Logs: [legend-state] tracking 1 observable: count
})
```

### useTraceUpdates

Log what caused each re-render.

```tsx
import { useTraceUpdates } from '@legendapp/state/trace'

const Component = observer(function Component() {
  useTraceUpdates('MyComponent')
  const count = useValue(state$.count)
  return <div>{count}</div>
  // Logs: [legend-state] Rendering because "count" changed: from 0 to 1
})
```

### useVerifyNotTracking

Error if the component is tracking any observables (verify render-once pattern).

```tsx
import { useVerifyNotTracking } from '@legendapp/state/trace'

function Component() {
  useVerifyNotTracking()
  return <Memo>{state$.count}</Memo> // OK: Memo tracks, not the parent
}
```

### useVerifyOneRender

Error if the component renders more than once.

```tsx
import { useVerifyOneRender } from '@legendapp/state/trace'

function Component() {
  useVerifyOneRender()
  // ...
}
```

### Manual debugging

```ts
// Log every change to an observable
state$.count.onChange(({ value }) => {
  console.log('count changed', value)
  console.trace()
  debugger
})
```

---

## Helper Observables

```ts
// Current day (updates at midnight)
import { currentDay } from '@legendapp/state/helpers/time'
observe(() => console.log('Today:', currentDay.get()))

// Current time (updates every minute)
import { currentTime } from '@legendapp/state/helpers/time'

// Page hash (web)
import { pageHash, configurePageHash } from '@legendapp/state/helpers/pageHash'
configurePageHash({ setter: 'pushState' })
pageHash.set('tab=settings')

// Page hash params (web)
import { pageHashParams } from '@legendapp/state/helpers/pageHashParams'
pageHashParams.tab.set('settings')
observe(() => console.log('tab:', pageHashParams.tab.get()))
```

---

## trackHistory / undoRedo

```ts
import { trackHistory } from '@legendapp/state/helpers/trackHistory'
import { undoRedo } from '@legendapp/state/helpers/undoRedo'

// Track history
const history = trackHistory(state$)
state$.name.set('new name')
// history: { [timestamp]: { name: 'old name' } }

// Undo/redo
const { undo, redo, getHistory } = undoRedo(state$.todos, { limit: 100 })
state$.todos.push('item')
undo()   // reverts push
redo()   // re-applies push
```
