import type { Todo } from "@todo/shared";
import { TodoItem } from "./TodoItem";

export function TodoList({ todos }: { todos: Todo[] }): JSX.Element {
  return (
    <ul className="todo-list" aria-label="Todos">
      {todos.map((t) => (
        <TodoItem key={t.id} todo={t} />
      ))}
    </ul>
  );
}
