import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Filters } from "../components/Filters";

describe("<Filters />", () => {
  it("marks the current value with aria-pressed=true", () => {
    render(<Filters value="active" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("invokes onChange when a chip is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Filters value="all" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Completed" }));
    expect(onChange).toHaveBeenCalledWith("completed");
  });
});
