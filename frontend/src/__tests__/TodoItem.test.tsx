import { act, screen, waitFor } from "@testing-library/react";
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

    // Click Undo (uses the Retry slot in the toast).
    await user.click(screen.getByRole("button", { name: /retry/i }));
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
