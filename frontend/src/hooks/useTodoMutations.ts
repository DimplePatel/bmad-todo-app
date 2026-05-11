import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Todo } from "@todo/shared";
import { api } from "../api/todos";
import { useToast } from "../components/ToastHost";
import * as pendingDeletes from "../state/pendingDeletes";
import { TODOS_KEY } from "./useTodos";

const tempId = () => `temp-${Math.random().toString(36).slice(2)}`;

export function useTodoMutations() {
  const qc = useQueryClient();
  const { push } = useToast();

  const create = useMutation({
    mutationFn: (title: string) => api.create(title),
    onMutate: async (title: string) => {
      await qc.cancelQueries({ queryKey: TODOS_KEY });
      const previous = qc.getQueryData<Todo[]>(TODOS_KEY) ?? [];
      const now = new Date().toISOString();
      const optimistic: Todo = {
        id: tempId(),
        title,
        completed: false,
        createdAt: now,
        updatedAt: now,
      };
      qc.setQueryData<Todo[]>(TODOS_KEY, [optimistic, ...previous]);
      return { previous, optimistic };
    },
    onError: (err, title, context) => {
      qc.setQueryData<Todo[]>(TODOS_KEY, context?.previous ?? []);
      push({
        message: `Couldn't add "${title}". ${(err as Error).message}`,
        onRetry: () => create.mutate(title),
      });
    },
    onSuccess: (server, _title, context) => {
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
        (curr ?? []).map((t) => (t.id === context?.optimistic.id ? server : t))
      );
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.update(id, { completed }),
    onMutate: async ({ id, completed }) => {
      await qc.cancelQueries({ queryKey: TODOS_KEY });
      // Capture the previous completed value for the specific row so we
      // can roll back surgically. A whole-array snapshot would let us blow
      // away unrelated reconciliations (e.g. a concurrent create.onSuccess
      // that swapped a temp-id row for the server-issued one — B3).
      const list = qc.getQueryData<Todo[]>(TODOS_KEY) ?? [];
      const prevRow = list.find((t) => t.id === id);
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
        (curr ?? []).map((t) => (t.id === id ? { ...t, completed } : t))
      );
      return { id, prevCompleted: prevRow?.completed };
    },
    onError: (err, vars, context) => {
      // Restore only this row's completed state. If the row no longer
      // exists in the cache (because it was reconciled to a new id, or
      // deleted via another path) we leave the cache as the source of
      // truth and just surface the error.
      if (context?.prevCompleted !== undefined) {
        qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
          (curr ?? []).map((t) =>
            t.id === context.id
              ? { ...t, completed: context.prevCompleted as boolean }
              : t
          )
        );
      }
      push({
        message: `Couldn't update task. ${(err as Error).message}`,
        onRetry: () => toggle.mutate(vars),
      });
    },
    onSuccess: (server) => {
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
        (curr ?? []).map((t) => (t.id === server.id ? server : t))
      );
    },
  });

  // Note: there is no `remove` mutation here. TodoItem schedules deferred
  // deletes via `state/pendingDeletes` and calls `api.remove` directly so the
  // timer survives the row's optimistic unmount. Reintroduce a useMutation
  // wrapper only if a non-deferred delete flow is needed elsewhere.

  const clearCompleted = useMutation({
    mutationFn: () => api.clearCompleted(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: TODOS_KEY });
      const previous = qc.getQueryData<Todo[]>(TODOS_KEY) ?? [];
      // Cancel any in-flight deferred deletes for completed rows (B4). The
      // bulk DELETE wipes them server-side; if the per-row deferred DELETE
      // still fires afterwards it 404s, and the row's catch-block would
      // restore it to the cache as a ghost. Cancelling here keeps the two
      // delete paths from racing.
      for (const t of previous) {
        if (t.completed) pendingDeletes.cancel(t.id);
      }
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
        (curr ?? []).filter((t) => !t.completed)
      );
      return { previous };
    },
    onError: (err, _v, context) => {
      qc.setQueryData<Todo[]>(TODOS_KEY, context?.previous ?? []);
      push({
        message: `Couldn't clear completed. ${(err as Error).message}`,
        onRetry: () => clearCompleted.mutate(),
      });
    },
  });

  return { create, toggle, clearCompleted };
}
