// Module-level registry for deferred deletes.
//
// Why this lives outside the component: TodoItem optimistically removes the
// row from the React Query cache on click, which unmounts that <TodoItem />.
// If the deferred-delete timer were stored on the component (useState/useRef
// + useEffect cleanup), the cleanup would clearTimeout on unmount and the
// real DELETE would never fire — the row would silently stay on the server
// and reappear on the next refetch.
//
// Storing the handle in a module-level Map decouples the timer's lifetime
// from any single component instance. Cancellation is explicit (cancel()).
//
// Single page-app, single QueryClient — a module-level Map is the right
// scope. If we ever go multi-tab/multi-window with shared workers we'd
// revisit.

const handles = new Map<string, ReturnType<typeof setTimeout>>();

export function schedule(id: string, fn: () => void, delayMs: number): void {
  cancel(id);
  const handle = setTimeout(() => {
    handles.delete(id);
    fn();
  }, delayMs);
  handles.set(id, handle);
}

export function cancel(id: string): void {
  const handle = handles.get(id);
  if (handle !== undefined) {
    clearTimeout(handle);
    handles.delete(id);
  }
}

// Test helper.
export function clearAll(): void {
  for (const handle of handles.values()) clearTimeout(handle);
  handles.clear();
}
