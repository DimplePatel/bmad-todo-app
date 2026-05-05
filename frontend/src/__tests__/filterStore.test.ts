import { afterEach, describe, expect, it } from "vitest";
import { readFilter, writeFilter } from "../state/filterStore";

describe("filterStore", () => {
  afterEach(() => {
    window.localStorage.clear();
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
});
