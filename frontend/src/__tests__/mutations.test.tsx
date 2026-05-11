import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { renderWithProviders } from "../test/render";
import { resetStore, server } from "../test/server";
import type { Todo } from "@todo/shared";

function todo(partial: Partial<Todo>): Todo {
  return {
    id: partial.id ?? Math.random().toString(),
    title: partial.title ?? "x",
    completed: partial.completed ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Mutations: rollback + retry", () => {
  beforeEach(() => {
    resetStore([
      todo({ id: "a", title: "alpha", completed: false }),
      todo({ id: "b", title: "beta", completed: true }),
    ]);
  });

  it("toggle: server 500 reverts the optimistic state and offers Retry", async () => {
    let calls = 0;
    server.use(
      http.patch("/api/todos/:id", () => {
        calls++;
        if (calls === 1)
          return HttpResponse.json({ error: "boom" }, { status: 500 });
        return HttpResponse.json(
          todo({ id: "a", title: "alpha", completed: true })
        );
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<App />);
    const cb = await screen.findByRole("checkbox", {
      name: /mark "alpha" as complete/i,
    });
    await user.click(cb);
    // After failure, checkbox reverts.
    await waitFor(() => expect(cb).not.toBeChecked());

    await user.click(await screen.findByRole("button", { name: /retry/i }));
    await waitFor(() => expect(cb).toBeChecked());
    expect(calls).toBe(2);
  });

  it("toggle: server 404 on a stale row reverts the optimistic state and offers Retry", async () => {
    // Real-world cause: another session (or a server-side bulk operation)
    // deleted "alpha" between our list fetch and our toggle. The PATCH 404s
    // and the UI should roll back rather than silently desync.
    let calls = 0;
    server.use(
      http.patch("/api/todos/:id", () => {
        calls++;
        return HttpResponse.json(
          { error: "Todo not found" },
          { status: 404 }
        );
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<App />);
    const cb = await screen.findByRole("checkbox", {
      name: /mark "alpha" as complete/i,
    });

    await user.click(cb);

    // Optimistic toggle reverts after the 404.
    await waitFor(() => expect(cb).not.toBeChecked());
    expect(calls).toBe(1);

    // A toast with Retry and the server's error message is shown.
    expect(
      await screen.findByRole("button", { name: /retry/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/couldn't update task.*todo not found/i)
    ).toBeInTheDocument();
  });

  it("clear completed: optimistic removal + 500 rollback + retry succeeds", async () => {
    // Three things asserted in one flow:
    //   (a) The optimistic removal of completed rows is observable BEFORE
    //       any server response — verified by holding the first response
    //       open with a Deferred; while held, the cache reflects the
    //       optimistic state and "beta" is gone.
    //   (b) On the 500 rollback, the completed row is restored.
    //   (c) Retry re-issues the bulk-delete; the second call succeeds and
    //       the row stays gone. This also covers useTodoMutations.ts:87 —
    //       the clearCompleted retry callback, previously uncovered.
    let releaseFirst!: () => void;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    server.use(
      http.delete("/api/todos", async () => {
        calls++;
        if (calls === 1) {
          await firstHeld;
          return HttpResponse.json({ error: "boom" }, { status: 500 });
        }
        return HttpResponse.json({ deleted: 1 });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText("alpha");
    expect(screen.getByText("beta")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /clear completed/i })
    );

    // (a) Optimistic removal observable while the first response is held.
    //     waitFor here covers the React Query async onMutate microtask
    //     chain (cancelQueries → setQueryData) without losing the
    //     intermediate-state guarantee, because the server response is
    //     still pending — no rollback can have run yet.
    await waitFor(() =>
      expect(screen.queryByText("beta")).not.toBeInTheDocument()
    );

    // (b) Release the held response → 500 → rollback restores "beta".
    releaseFirst();
    await waitFor(() => expect(screen.getByText("beta")).toBeInTheDocument());
    expect(calls).toBe(1);

    // (c) Retry re-issues the bulk delete; second call succeeds (no held
    //     promise this time) and "beta" stays gone.
    await user.click(
      await screen.findByRole("button", { name: /retry/i })
    );
    await waitFor(() =>
      expect(screen.queryByText("beta")).not.toBeInTheDocument()
    );
    expect(calls).toBe(2);
  });
});

describe("App error state", () => {
  it("shows error banner with Retry when initial fetch fails", async () => {
    resetStore([]);
    server.use(
      http.get("/api/todos", () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );
    renderWithProviders(<App />);
    expect(
      await screen.findByText(/couldn't load your todos/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry/i })
    ).toBeInTheDocument();
  });
});
