import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../components/EmptyState";

// Closes E3.S1 U1 ("`<EmptyState />` renders the expected hint and a
// focusable 'Add a todo' affordance.").
//
// Spec/impl reconciliation note: the story specifies a focusable affordance
// **inside** EmptyState. The actual implementation puts that affordance in
// the sibling `<TodoInput>` above (the "New todo" input is keyboard-reachable
// as the first tab stop — verified by `App.test.tsx` "tab order traverses
// controls in visual order"). EmptyState itself is a passive `role="status"`
// hint. These tests pin the contract that exists:
//   - the hint text
//   - the live-region role so screen readers announce it on transition into
//     empty state
//   - the `data-testid` used by e2e + the spec for stable selection
// If the story intent should change (move the "Add" affordance into
// EmptyState), update the implementation first, then extend this test.
describe("<EmptyState /> (E3.S1 U1)", () => {
  it("renders the hint text and announces it as a live status region", () => {
    render(<EmptyState />);

    expect(screen.getByText(/nothing to do yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/add your first task above to get started/i)
    ).toBeInTheDocument();

    const region = screen.getByTestId("empty-state");
    expect(region).toHaveAttribute("role", "status");
  });
});
