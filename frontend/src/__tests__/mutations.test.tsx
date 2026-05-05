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

  it("clear completed: server 500 restores all completed rows", async () => {
    let calls = 0;
    server.use(
      http.delete("/api/todos", () => {
        calls++;
        return HttpResponse.json({ error: "boom" }, { status: 500 });
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText("alpha");
    expect(screen.getByText("beta")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /clear completed/i })
    );

    // Failure: completed row is restored.
    await waitFor(() => expect(screen.getByText("beta")).toBeInTheDocument());
    expect(calls).toBe(1);
    expect(
      screen.getByRole("button", { name: /retry/i })
    ).toBeInTheDocument();
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
