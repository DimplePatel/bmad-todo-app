import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { renderWithProviders } from "../test/render";
import { resetStore, server } from "../test/server";

describe("App", () => {
  beforeEach(() => {
    resetStore([]);
  });

  it("renders the heading and empty state when no todos exist", async () => {
    renderWithProviders(<App />);
    expect(
      screen.getByRole("heading", { name: /todo app/i })
    ).toBeInTheDocument();
    expect(await screen.findByText(/nothing to do yet/i)).toBeInTheDocument();
  });

  it("creates a todo and reconciles the temp id to the server-issued id", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText(/nothing to do yet/i);

    const input = screen.getByLabelText("New todo");
    await user.type(input, "buy milk{Enter}");

    // Row appears.
    expect(await screen.findByText("buy milk")).toBeInTheDocument();

    // Input clears on success.
    await waitFor(() => expect(input).toHaveValue(""));

    // The optimistic row was rendered with a `cb-temp-…` id; once the server
    // response lands, React Query swaps in the server-issued id. Without this
    // assertion, a regression in the create.onSuccess reconciliation step
    // would silently desync the cache from the server (the bug we hit in the
    // E2E `addTodo` helper).
    const cb = screen.getByRole("checkbox", {
      name: /mark "buy milk" as complete/i,
    });
    await waitFor(() => {
      expect(cb.getAttribute("id")).not.toMatch(/^cb-temp-/);
    });
  });

  it("shows the optimistic row immediately while the POST is in flight", async () => {
    // Hold the server response open with an unresolved promise; the
    // optimistic row should be visible (with a temp id) during the hold.
    // This is the strongest available assertion of "optimistic UI is fast"
    // — if a future refactor accidentally awaited the server before
    // updating the cache, this test would fail.
    let releaseResponse!: () => void;
    const heldByTest = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    server.use(
      http.post("/api/todos", async () => {
        await heldByTest;
        return HttpResponse.json(
          {
            id: "srv-deadbeef",
            title: "buy milk",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { status: 201 }
        );
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText(/nothing to do yet/i);

    await user.type(
      screen.getByLabelText("New todo"),
      "buy milk{Enter}"
    );

    // Optimistic state: row visible with a temp-id while the request hangs.
    const optimistic = await screen.findByRole("checkbox", {
      name: /mark "buy milk" as complete/i,
    });
    expect(optimistic.getAttribute("id")).toMatch(/^cb-temp-/);
    expect(screen.queryByText(/nothing to do yet/i)).not.toBeInTheDocument();

    // Release the response — reconciliation completes. TodoList keys by
    // todo.id, so the temp-id → server-id transition forces an unmount +
    // remount of <TodoItem />. The waitFor body must re-query each iteration
    // because the optimistic checkbox above is now detached; a cached
    // reference would keep reporting its old (temp) id forever.
    releaseResponse();

    await waitFor(() => {
      const cb = screen.getByRole("checkbox", {
        name: /mark "buy milk" as complete/i,
      });
      expect(cb.getAttribute("id")).toBe("cb-srv-deadbeef");
    });
  });

  it("toggles a todo's completion (optimistic)", async () => {
    resetStore([
      {
        id: "seed-1",
        title: "seeded",
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<App />);
    const cb = await screen.findByRole("checkbox", {
      name: /mark "seeded" as complete/i,
    });
    await user.click(cb);
    await waitFor(() => expect(cb).toBeChecked());
  });

  it("shows an inline error when the title is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText(/nothing to do yet/i);
    await user.click(screen.getByRole("button", { name: /add todo/i }));
    expect(
      await screen.findByText(/please enter a task description/i)
    ).toBeInTheDocument();
  });

  it("rejects titles longer than 200 characters with an inline error", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText(/nothing to do yet/i);

    const input = screen.getByLabelText("New todo") as HTMLInputElement;

    // fireEvent.change bypasses the input's maxLength={201} so we can set
    // exactly 201 chars and exercise the >200 validation branch in
    // TodoInput.tsx. user.type would respect maxLength and take ~40 s for
    // this length.
    fireEvent.change(input, { target: { value: "x".repeat(201) } });
    await user.click(screen.getByRole("button", { name: /add todo/i }));

    expect(
      await screen.findByText(/maximum 200 characters/i)
    ).toBeInTheDocument();

    // The form did NOT submit — input retains its value.
    expect(input.value).toHaveLength(201);
  });

  it("tab order traverses controls in visual order (NFR4 / Story E4.S2 I1)", async () => {
    // Seed two todos — one active, one completed — so every focusable type
    // is exercised: input → Add button → 3 filter chips → 2 rows
    // (checkbox + delete each) → Clear completed (only visible because
    // something is completed).
    //
    // Server returns todos sorted by createdAt desc, so the *later* one
    // (beta) renders first in the DOM and gets focused first.
    resetStore([
      {
        id: "id-alpha",
        title: "alpha",
        completed: false,
        createdAt: new Date(2026, 0, 1).toISOString(),
        updatedAt: new Date(2026, 0, 1).toISOString(),
      },
      {
        id: "id-beta",
        title: "beta",
        completed: true,
        createdAt: new Date(2026, 0, 2).toISOString(),
        updatedAt: new Date(2026, 0, 2).toISOString(),
      },
    ]);

    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText("beta");

    // 1. New-todo input
    await user.tab();
    expect(screen.getByLabelText("New todo")).toHaveFocus();

    // 2. Add button
    await user.tab();
    expect(screen.getByRole("button", { name: /add todo/i })).toHaveFocus();

    // 3–5. Filter chips. Anchor regexes so "Active" doesn't also match the
    // beta row's "Mark \"beta\" as active" checkbox (RTL does case-
    // insensitive substring matching by default).
    await user.tab();
    expect(screen.getByRole("button", { name: /^All$/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /^Active$/ })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: /^Completed$/ })
    ).toHaveFocus();

    // 6. beta's checkbox (beta sorts first by createdAt desc and is completed)
    await user.tab();
    expect(
      screen.getByRole("checkbox", { name: /mark "beta" as active/i })
    ).toHaveFocus();

    // 7. beta's delete button
    await user.tab();
    expect(
      screen.getByRole("button", { name: /^Delete "beta"$/ })
    ).toHaveFocus();

    // 8. alpha's checkbox
    await user.tab();
    expect(
      screen.getByRole("checkbox", { name: /mark "alpha" as complete/i })
    ).toHaveFocus();

    // 9. alpha's delete button
    await user.tab();
    expect(
      screen.getByRole("button", { name: /^Delete "alpha"$/ })
    ).toHaveFocus();

    // 10. Clear completed (visible because beta is completed)
    await user.tab();
    expect(
      screen.getByRole("button", { name: /clear completed/i })
    ).toHaveFocus();
  });

  it("shows an error toast with Retry on POST failure (then succeeds)", async () => {
    let calls = 0;
    server.use(
      http.post("/api/todos", () => {
        calls++;
        if (calls === 1) {
          return HttpResponse.json({ error: "boom" }, { status: 500 });
        }
        return HttpResponse.json(
          {
            id: "x",
            title: "after retry",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText(/nothing to do yet/i);
    await user.type(screen.getByLabelText("New todo"), "after retry{Enter}");

    // Optimistic row was rolled back; toast shows.
    const retry = await screen.findByRole("button", { name: /retry/i });
    await user.click(retry);
    expect(await screen.findByText("after retry")).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
