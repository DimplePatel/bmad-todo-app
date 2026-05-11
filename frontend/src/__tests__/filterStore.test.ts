import { afterEach, describe, expect, it, vi } from "vitest";
import { readFilter, writeFilter } from "../state/filterStore";

describe("filterStore", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("defaults to 'all' when nothing is stored", () => {
    expect(readFilter()).toBe("all");
  });

  it("round-trips a valid value", () => {
    writeFilter("active");
    expect(readFilter()).toBe("active");
  });

  it("ignores invalid stored values", () => {
    window.localStorage.setItem("todo.filter", "bogus");
    expect(readFilter()).toBe("all");
  });

  it("readFilter falls back to 'all' when localStorage.getItem throws (e.g. private-browsing)", () => {
    // Some browsers throw on storage access in private/incognito modes. The
    // catch in filterStore swallows the error and returns the default.
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage disabled");
    });
    expect(readFilter()).toBe("all");
  });

  it("writeFilter swallows exceptions when localStorage.setItem throws", () => {
    // Same scenario as above for writes. The function must not propagate the
    // exception — losing a UI preference is acceptable; crashing the app is
    // not.
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeFilter("active")).not.toThrow();
  });
});
