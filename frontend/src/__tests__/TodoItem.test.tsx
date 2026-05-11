import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { renderWithProviders } from "../test/render";
import { resetStore, server } from "../test/server";
import type { Todo } from "@todo/shared";

function seed(): Todo {
  return {
    id: "seed-1",
    title: "writeup",
    completed: false,
    createdAt: new Date(2026, 0, 1).toISOString(),
    updatedAt: new Date(2026, 0, 1).toISOString(),
  };
}

describe("<TodoItem /> delete-with-undo", () => {
  beforeEach(() => {
    resetStore([seed()]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("undo within the window restores the row and never sends DELETE", async () => {
    let deletes = 0;
    server.use(
      http.delete("/api/todos/:id", () => {
        deletes++;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<App />);
    await screen.findByText("writeup");

    await user.click(
      screen.getByRole("button", { name: /delete "writeup"/i })
    );
    expect(screen.queryByText("writeup")).not.toBeInTheDocument();

    // Click Undo — the delete toast's primary action.
    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(await screen.findByText("writeup")).toBeInTheDocument();

    // Even if we let the original timer pass, no DELETE was sent.
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(deletes).toBe(0);
  });

  // The "DELETE after 5s elapses" path is exercised end-to-end in
  // e2e/tests/undo-delete.spec.ts — keeping it out of unit tests avoids fake-
  // timer/microtask races against React Query mutation flushes.
});

describe("<TodoItem /> multiple deletes (Story E3.S4 AC5)", () => {
  beforeEach(() => {
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
        completed: false,
        createdAt: new Date(2026, 0, 2).toISOString(),
        updatedAt: new Date(2026, 0, 2).toISOString(),
      },
    ]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues independent toasts; undoing one restores only that row", async () => {
    // Block the real DELETEs so we can verify which ones (if any) get sent
    // after the 5s window. None should during this test — we'll undo one and
    // then short-circuit before the other's timer fires.
    const deletedIds: string[] = [];
    server.use(
      http.delete("/api/todos/:id", ({ params }) => {
        deletedIds.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      })
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<App />);
    await screen.findByText("alpha");
    expect(screen.getByText("beta")).toBeInTheDocument();

    // Delete both rows in quick succession.
    await user.click(
      screen.getByRole("button", { name: /delete "alpha"/i })
    );
    await user.click(
      screen.getByRole("button", { name: /delete "beta"/i })
    );

    // Both rows are optimistically removed from the list.
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("beta")).not.toBeInTheDocument();

    // Two independent undo toasts are queued, each with its own message.
    expect(screen.getByText(/Deleted "alpha"/)).toBeInTheDocument();
    expect(screen.getByText(/Deleted "beta"/)).toBeInTheDocument();
    const undoButtons = screen.getAllByRole("button", { name: /undo/i });
    expect(undoButtons).toHaveLength(2);

    // Find the Undo button that lives inside the "beta" toast specifically —
    // each toast is one `.toast` element; we scope by its message text so the
    // test isn't sensitive to DOM order.
    const betaToast = screen.getByText(/Deleted "beta"/).closest(".toast");
    expect(betaToast).not.toBeNull();
    await user.click(
      within(betaToast as HTMLElement).getByRole("button", { name: /undo/i })
    );

    // "beta" comes back; "alpha" stays pending delete.
    expect(await screen.findByText("beta")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();

    // One undo toast remaining (alpha's). beta's is dismissed.
    expect(
      screen.queryAllByRole("button", { name: /undo/i })
    ).toHaveLength(1);

    // No server DELETE has been issued yet — both timers are still in flight.
    expect(deletedIds).toEqual([]);
  });
});

// Closes the unit-level gap for FR5 ("completed todos are visually
// differentiated"). The CSS in `frontend/src/styles/index.css` applies
// `text-decoration: line-through` + a dimmed colour via the
// `.todo-item.is-completed` selector — but the visual flip is only
// observable through that class being present in the DOM. A regression
// that dropped the className (or renamed it) would still pass every
// existing unit test; only the e2e a11y populated-list axe scan would
// catch the resulting contrast/legibility issue. This test pins the
// class-presence contract directly.
describe("<TodoItem /> visual differentiation (FR5)", () => {
  beforeEach(() => {
    resetStore([
      {
        id: "id-vd",
        title: "visual",
        completed: false,
        createdAt: new Date(2026, 0, 1).toISOString(),
        updatedAt: new Date(2026, 0, 1).toISOString(),
      },
    ]);
  });

  it("toggling a row adds the is-completed class to its <li>", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    const checkbox = await screen.findByRole("checkbox", {
      name: /mark "visual" as complete/i,
    });
    const row = checkbox.closest("li.todo-item");
    expect(row).not.toBeNull();
    // Pre-toggle: the row exists but is not marked completed.
    expect(row).not.toHaveClass("is-completed");

    await user.click(checkbox);

    // Post-toggle (optimistic): the class flips immediately and the
    // checkbox is in its checked state. A regression that removed the
    // `${todo.completed ? " is-completed" : ""}` template in TodoItem.tsx
    // would fail here.
    await screen.findByRole("checkbox", {
      name: /mark "visual" as active/i,
    });
    expect(row).toHaveClass("is-completed");
  });
});
