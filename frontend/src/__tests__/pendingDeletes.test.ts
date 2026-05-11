import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as pendingDeletes from "../state/pendingDeletes";

describe("pendingDeletes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    pendingDeletes.clearAll();
    vi.useRealTimers();
  });

  it("fires the callback after the delay elapses", () => {
    const fn = vi.fn();
    pendingDeletes.schedule("a", fn, 1000);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not fire if cancel() is called before the timer elapses", () => {
    const fn = vi.fn();
    pendingDeletes.schedule("a", fn, 1000);
    pendingDeletes.cancel("a");
    vi.advanceTimersByTime(2000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() on an unknown id is a safe no-op (no throw, no side effects)", () => {
    expect(() => pendingDeletes.cancel("never-scheduled")).not.toThrow();
  });

  it("scheduling the same id again replaces the prior handle (only the new one fires)", () => {
    const first = vi.fn();
    const second = vi.fn();
    pendingDeletes.schedule("a", first, 1000);
    pendingDeletes.schedule("a", second, 1000);
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("clearAll() cancels every in-flight handle", () => {
    const fns = [vi.fn(), vi.fn(), vi.fn()];
    pendingDeletes.schedule("a", fns[0]!, 1000);
    pendingDeletes.schedule("b", fns[1]!, 2000);
    pendingDeletes.schedule("c", fns[2]!, 3000);
    pendingDeletes.clearAll();
    vi.advanceTimersByTime(5000);
    for (const fn of fns) expect(fn).not.toHaveBeenCalled();
  });

  it("after firing, the same id can be scheduled again", () => {
    const first = vi.fn();
    const second = vi.fn();
    pendingDeletes.schedule("a", first, 1000);
    vi.advanceTimersByTime(1000);
    expect(first).toHaveBeenCalledTimes(1);

    pendingDeletes.schedule("a", second, 1000);
    vi.advanceTimersByTime(1000);
    expect(second).toHaveBeenCalledTimes(1);
    // first should not have fired a second time.
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("handles for different ids are independent", () => {
    const a = vi.fn();
    const b = vi.fn();
    pendingDeletes.schedule("a", a, 1000);
    pendingDeletes.schedule("b", b, 5000);
    vi.advanceTimersByTime(1000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("cancelling one id does not affect another", () => {
    const a = vi.fn();
    const b = vi.fn();
    pendingDeletes.schedule("a", a, 1000);
    pendingDeletes.schedule("b", b, 1000);
    pendingDeletes.cancel("a");
    vi.advanceTimersByTime(1000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
