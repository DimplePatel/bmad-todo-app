import { useQueryClient } from "@tanstack/react-query";
import type { Todo } from "@todo/shared";
import { api } from "../api/todos";
import { TODOS_KEY } from "../hooks/useTodos";
import { useTodoMutations } from "../hooks/useTodoMutations";
import * as pendingDeletes from "../state/pendingDeletes";
import { useToast } from "./ToastHost";

const UNDO_WINDOW_MS = 5000;

export function TodoItem({ todo }: { todo: Todo }): JSX.Element {
  const { toggle } = useTodoMutations();
  const { push, dismiss } = useToast();
  const qc = useQueryClient();

  function onToggle() {
    toggle.mutate({ id: todo.id, completed: !todo.completed });
  }

  function onDeleteClick() {
    // Optimistically hide the row. We use the module-level pendingDeletes
    // registry instead of a component-local timer because the cache filter
    // below unmounts <TodoItem />; a useEffect cleanup would clearTimeout()
    // and the deferred DELETE would never fire.
    qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
      (curr ?? []).filter((t) => t.id !== todo.id)
    );

    let undone = false;
    let toastId = "";

    const undoHandler = () => {
      undone = true;
      pendingDeletes.cancel(todo.id);
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) => {
        const list = curr ?? [];
        if (list.some((t) => t.id === todo.id)) return list;
        return [todo, ...list];
      });
      dismiss(toastId);
    };

    toastId = push({
      message: `Deleted "${todo.title}".`,
      onRetry: undoHandler,
    });

    pendingDeletes.schedule(
      todo.id,
      async () => {
        if (undone) return;
        try {
          await api.remove(todo.id);
        } catch (err) {
          // DELETE failed — restore the row and surface the error.
          qc.setQueryData<Todo[]>(TODOS_KEY, (curr) => {
            const list = curr ?? [];
            if (list.some((t) => t.id === todo.id)) return list;
            return [todo, ...list];
          });
          push({
            message: `Couldn't delete "${todo.title}". ${
              (err as Error).message
            }`,
          });
        } finally {
          dismiss(toastId);
        }
      },
      UNDO_WINDOW_MS
    );
  }

  return (
    <li className={`todo-item${todo.completed ? " is-completed" : ""}`}>
      <input
        id={`cb-${todo.id}`}
        type="checkbox"
        checked={todo.completed}
        onChange={onToggle}
        aria-label={`Mark "${todo.title}" as ${
          todo.completed ? "active" : "complete"
        }`}
      />
      <label htmlFor={`cb-${todo.id}`} className="todo-title">
        {todo.title}
      </label>
      <button
        type="button"
        className="todo-delete"
        aria-label={`Delete "${todo.title}"`}
        onClick={onDeleteClick}
      >
        ×
      </button>
    </li>
  );
}
