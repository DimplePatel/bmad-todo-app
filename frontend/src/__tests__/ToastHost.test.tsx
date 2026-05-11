import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "../components/ToastHost";

/**
 * Tiny harness: pushes one toast per item in `messages` on mount, with
 * optional onRetry/actionLabel. Lets each test set up the toast configuration
 * declaratively rather than fiddling with refs to the push function.
 */
function PushOnMount({
  messages,
  onRetry,
  actionLabel,
}: {
  messages: Array<string>;
  onRetry?: () => void;
  actionLabel?: string;
}): null {
  const { push } = useToast();
  useEffect(() => {
    for (const message of messages) {
      push({
        message,
        ...(onRetry ? { onRetry } : {}),
        ...(actionLabel ? { actionLabel } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function harness(props: {
  messages: Array<string>;
  onRetry?: () => void;
  actionLabel?: string;
}) {
  return render(
    <ToastProvider>
      <PushOnMount {...props} />
    </ToastProvider>
  );
}

function getToastElement(message: string | RegExp): HTMLElement {
  const messageEl = screen.getByText(message);
  const toast = messageEl.closest(".toast");
  if (!toast) throw new Error("toast element not found");
  return toast as HTMLElement;
}

describe("<ToastHost />", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-dismisses after 5 seconds", () => {
    harness({ messages: ["bye soon"] });
    expect(screen.getByText("bye soon")).toBeInTheDocument();

    // Just before the timer fires — still visible.
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText("bye soon")).toBeInTheDocument();

    // Tip past 5000 — dismissed.
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("bye soon")).not.toBeInTheDocument();
  });

  it("hovering pauses the auto-dismiss timer; mouseLeave resumes it", () => {
    harness({ messages: ["hover me"] });
    const toast = getToastElement("hover me");

    // Hover before any time has passed: the existing 5s timer is cleared.
    fireEvent.mouseEnter(toast);

    // Advance well past 5s — still visible because no timer is queued.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("hover me")).toBeInTheDocument();

    // Leaving the toast schedules a fresh 5s timer.
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText("hover me")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("hover me")).not.toBeInTheDocument();
  });

  it("focus also pauses the timer (keyboard equivalent of hover)", () => {
    harness({ messages: ["focus me"] });
    const toast = getToastElement("focus me");

    fireEvent.focus(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("focus me")).toBeInTheDocument();

    fireEvent.blur(toast);
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByText("focus me")).not.toBeInTheDocument();
  });

  it("stacks multiple toasts and dismisses each on its own timer", () => {
    harness({ messages: ["a", "b", "c"] });

    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.getByText("c")).toBeInTheDocument();

    // All three were pushed together, so all three dismiss around the same
    // tick — but the timers are independent (verified by the next test that
    // pauses one without affecting the others).
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(screen.queryByText("b")).not.toBeInTheDocument();
    expect(screen.queryByText("c")).not.toBeInTheDocument();
  });

  it("hovering one toast does not pause the others", () => {
    harness({ messages: ["pinned", "ephemeral"] });
    const pinned = getToastElement("pinned");

    fireEvent.mouseEnter(pinned);
    // Advance 6 s: "pinned" is paused so stays; "ephemeral" auto-dismissed
    // at 5 s.
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText("pinned")).toBeInTheDocument();
    expect(screen.queryByText("ephemeral")).not.toBeInTheDocument();
  });

  it("clicking the action calls onRetry and dismisses the toast", () => {
    const onRetry = vi.fn();
    harness({
      messages: ["please retry"],
      onRetry,
      actionLabel: "Retry",
    });

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("please retry")).not.toBeInTheDocument();
  });

  it("uses the provided actionLabel (e.g. 'Undo') instead of the default 'Retry'", () => {
    harness({
      messages: ["deleted 'X'"],
      onRetry: () => {},
      actionLabel: "Undo",
    });
    expect(
      screen.getByRole("button", { name: /undo/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry/i })
    ).not.toBeInTheDocument();
  });

  it("falls back to 'Retry' when no actionLabel is provided", () => {
    harness({
      messages: ["something failed"],
      onRetry: () => {},
    });
    expect(
      screen.getByRole("button", { name: /retry/i })
    ).toBeInTheDocument();
  });

  it("uses role='alert' when an action is offered (assertive), 'status' otherwise", () => {
    harness({ messages: ["informational"] });
    const info = getToastElement("informational");
    expect(info.getAttribute("role")).toBe("status");
  });

  it("uses role='alert' for actionable toasts", () => {
    harness({ messages: ["actionable"], onRetry: () => {} });
    const actionable = getToastElement("actionable");
    expect(actionable.getAttribute("role")).toBe("alert");
  });

  it("Dismiss button removes the toast immediately", () => {
    harness({ messages: ["dismiss me"] });
    fireEvent.click(
      screen.getByRole("button", { name: /dismiss notification/i })
    );
    expect(screen.queryByText("dismiss me")).not.toBeInTheDocument();
  });
});
