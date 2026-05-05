import { useEffect, useRef, useState } from "react";
import type { Todo } from "@todo/shared";
import { useToast } from "./ToastHost";
import { useTodoMutations } from "../hooks/useTodoMutations";
import { useQueryClient } from "@tanstack/react-query";
import { TODOS_KEY } from "../hooks/useTodos";

const UNDO_WINDOW_MS = 5000;

export function TodoItem({ todo }: { todo: Todo }): JSX.Element {
  const { toggle, remove } = useTodoMutations();
  const { push, dismiss } = useToast();
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function onToggle() {
    toggle.mutate({ id: todo.id, completed: !todo.completed });
  }

  function onDeleteClick() {
    // Optimistically hide locally without yet calling the server.
    qc.setQueryData<Todo[]>(TODOS_KEY, (curr) =>
      (curr ?? []).filter((t) => t.id !== todo.id)
    );
    setPendingDelete(true);

    const toastId = push({
      message: `Deleted "${todo.title}".`,
      // Re-using onRetry slot for "Undo": treat retry as undo (we'll override below).
    });

    let undone = false;
    const undoHandler = () => {
      undone = true;
      window.clearTimeout(timerRef.current);
      // Restore in cache.
      qc.setQueryData<Todo[]>(TODOS_KEY, (curr) => {
        const list = curr ?? [];
        if (list.some((t) => t.id === todo.id)) return list;
        return [todo, ...list];
      });
      dismiss(toastId);
    };

    // Replace the simple toast with one that has an Undo button.
    // We push a fresh toast and dismiss the placeholder.
    dismiss(toastId);
    const realId = push({
      message: `Deleted "${todo.title}".`,
      onRetry: undoHandler,
    });

    timerRef.current = window.setTimeout(() => {
      if (undone) return;
      remove.mutate(todo.id, {
        onError: () => {
          // remove() onError will already restore + push an error toast.
          dismiss(realId);
        },
        onSuccess: () => {
          dismiss(realId);
        },
      });
      setPendingDelete(false);
    }, UNDO_WINDOW_MS);
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
        disabled={pendingDelete}
      >
        ×
      </button>
    </li>
  );
}
