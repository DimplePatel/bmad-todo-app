import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Todo } from "@todo/shared";
import { api } from "../api/todos";
import { useToast } from "../components/ToastHost";
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
      const previous = qc.getQueryData<Todo[]>(TODOS_KEY) ?? [];
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
        (curr ?? []).map((t) => (t.id === id ? { ...t, completed } : t))
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      qc.setQueryData<Todo[]>(TODOS_KEY, context?.previous ?? []);
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

  const remove = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TODOS_KEY });
      const previous = qc.getQueryData<Todo[]>(TODOS_KEY) ?? [];
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
        (curr ?? []).filter((t) => t.id !== id)
      );
      return { previous };
    },
    onError: (err, id, context) => {
      qc.setQueryData<Todo[]>(TODOS_KEY, context?.previous ?? []);
      push({
        message: `Couldn't delete task. ${(err as Error).message}`,
        onRetry: () => remove.mutate(id),
      });
    },
  });

  const clearCompleted = useMutation({
    mutationFn: () => api.clearCompleted(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: TODOS_KEY });
      const previous = qc.getQueryData<Todo[]>(TODOS_KEY) ?? [];
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

  return { create, toggle, remove, clearCompleted };
}
