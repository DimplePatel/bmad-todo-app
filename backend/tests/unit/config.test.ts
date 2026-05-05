import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  it("returns defaults when env is empty", () => {
    const c = loadConfig({});
    expect(c.port).toBe(3001);
    expect(c.nodeEnv).toBe("development");
    expect(c.databasePath).toBe("./data/todos.db");
    expect(c.corsOrigin).toEqual(["http://localhost:5173"]);
  });

  it("parses CORS_ORIGIN as a comma-separated allowlist", () => {
    const c = loadConfig({ CORS_ORIGIN: "http://a.com, http://b.com" });
    expect(c.corsOrigin).toEqual(["http://a.com", "http://b.com"]);
  });

  it("rejects '*' in production", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production", CORS_ORIGIN: "*" })
    ).toThrow();
  });

  it("rejects invalid PORT", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow();
  });
});
