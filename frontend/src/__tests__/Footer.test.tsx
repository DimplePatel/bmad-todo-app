import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Todo } from "@todo/shared";
import { Footer } from "../components/Footer";
import { renderWithProviders } from "../test/render";

function todo(partial: Partial<Todo>): Todo {
  return {
    id: partial.id ?? Math.random().toString(),
    title: partial.title ?? "x",
    completed: partial.completed ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("<Footer />", () => {
  it("renders pluralised counter and hides Clear completed when none completed", () => {
    renderWithProviders(<Footer todos={[todo({ completed: false }), todo({ completed: false })]} />);
    expect(screen.getByText(/2 items left/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /clear completed/i })
    ).not.toBeInTheDocument();
  });

  it("shows '1 item left' for a single active item", () => {
    renderWithProviders(<Footer todos={[todo({ completed: false })]} />);
    expect(screen.getByText(/1 item left/i)).toBeInTheDocument();
  });

  it("shows Clear completed when at least one completed", () => {
    renderWithProviders(
      <Footer todos={[todo({ completed: true }), todo({ completed: false })]} />
    );
    expect(
      screen.getByRole("button", { name: /clear completed/i })
    ).toBeInTheDocument();
  });
});
