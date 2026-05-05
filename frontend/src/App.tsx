import { useMemo } from "react";
import { EmptyState } from "./components/EmptyState";
import { Filters } from "./components/Filters";
import { Footer } from "./components/Footer";
import { Skeleton } from "./components/Skeleton";
import { TodoInput } from "./components/TodoInput";
import { TodoList } from "./components/TodoList";
import { useToast } from "./components/ToastHost";
import { useTodos } from "./hooks/useTodos";
import { useFilter } from "./state/filterStore";

export default function App(): JSX.Element {
  const { data: todos, isLoading, isError, refetch } = useTodos();
  const [filter, setFilter] = useFilter();
  const { push } = useToast();

  const filtered = useMemo(() => {
    const list = todos ?? [];
    if (filter === "active") return list.filter((t) => !t.completed);
    if (filter === "completed") return list.filter((t) => t.completed);
    return list;
  }, [todos, filter]);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Todo App</h1>
      </header>
      <TodoInput />
      <Filters value={filter} onChange={setFilter} />
      {isLoading ? (
        <Skeleton />
      ) : isError ? (
        <div role="alert" className="error-banner">
          <p>Couldn't load your todos.</p>
          <button
            type="button"
            onClick={() => {
              push({
                message: "Retrying…",
                onRetry: () => void refetch(),
              });
              void refetch();
            }}
          >
            Retry
          </button>
        </div>
      ) : (todos ?? []).length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TodoList todos={filtered} />
          <Footer todos={todos ?? []} />
        </>
      )}
    </main>
  );
}
