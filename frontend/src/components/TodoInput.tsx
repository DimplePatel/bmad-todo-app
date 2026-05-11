import { useState, type FormEvent } from "react";
import { TODO_TITLE_MAX } from "@todo/shared";
import { useTodoMutations } from "../hooks/useTodoMutations";

export function TodoInput(): JSX.Element {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { create } = useTodoMutations();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (title.length === 0) {
      setError("Please enter a task description.");
      return;
    }
    if (title.length > TODO_TITLE_MAX) {
      setError(`Maximum ${TODO_TITLE_MAX} characters.`);
      return;
    }
    setError(null);
    create.mutate(title, {
      onSuccess: () => setValue(""),
    });
  }

  return (
    <form className="todo-input" onSubmit={onSubmit} noValidate>
      <label className="visually-hidden" htmlFor="new-todo">
        New todo
      </label>
      <input
        id="new-todo"
        type="text"
        placeholder="What needs to be done?"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={TODO_TITLE_MAX + 1}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? "new-todo-error" : undefined}
      />
      <button type="submit" aria-label="Add todo">
        Add
      </button>
      {error && (
        <p
          id="new-todo-error"
          className="input-error"
          role="alert"
          data-testid="input-error"
        >
          {error}
        </p>
      )}
    </form>
  );
}
