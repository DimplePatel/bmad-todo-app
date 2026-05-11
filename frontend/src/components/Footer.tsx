import type { Todo } from "@todo/shared";
import { useTodoMutations } from "../hooks/useTodoMutations";

export function Footer({ todos }: { todos: Todo[] }): JSX.Element {
  const active = todos.filter((t) => !t.completed).length;
  const completed = todos.length - active;
  const { clearCompleted } = useTodoMutations();
  return (
    <footer className="footer">
      <span
        className="items-left"
        aria-live="polite"
        data-testid="items-left"
      >
        {active} {active === 1 ? "item" : "items"} left
      </span>
      {completed > 0 && (
        <button
          type="button"
          className="clear-completed"
          onClick={() => clearCompleted.mutate()}
        >
          Clear completed
        </button>
      )}
    </footer>
  );
}
