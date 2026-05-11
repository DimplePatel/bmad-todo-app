import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../components/Skeleton";

// Closes E3.S1 U2 ("`<Skeleton />` renders 3 skeleton rows with appropriate
// `aria-busy='true'`.").
//
// The component renders a <ul aria-busy="true" aria-label="Loading todos">
// with exactly three <li aria-hidden="true"> placeholder rows. The aria-busy
// is the signal that screen readers + axe + Playwright a11y scans rely on
// to recognise the loading state; the aria-hidden on each row keeps the
// placeholder bars out of the accessibility tree so a SR doesn't try to
// read three identical empty rows.
describe("<Skeleton /> (E3.S1 U2)", () => {
  it("renders an aria-busy list with three placeholder rows", () => {
    const { container } = render(<Skeleton />);

    const list = screen.getByLabelText("Loading todos");
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute("aria-busy", "true");

    // The three skeleton rows are aria-hidden, so they don't surface via
    // getByRole("listitem") — query the DOM directly.
    const rows = container.querySelectorAll("li.skeleton-row");
    expect(rows).toHaveLength(3);
    rows.forEach((row) =>
      expect(row).toHaveAttribute("aria-hidden", "true")
    );
  });
});
