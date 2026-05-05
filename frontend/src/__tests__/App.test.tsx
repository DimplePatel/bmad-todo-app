import { screen, waitFor } from "@testing-library/react";
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

  it("creates a todo via the input (optimistic + reconcile)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await screen.findByText(/nothing to do yet/i);

    const input = screen.getByLabelText("New todo");
    await user.type(input, "buy milk{Enter}");

    expect(await screen.findByText("buy milk")).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue(""));
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
