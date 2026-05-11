import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext, type TestContext } from "../helpers.js";

describe("GET /api/health", () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });
  afterEach(() => {
    ctx.cleanup();
  });

  it("returns 200 and {status:'ok'}", async () => {
    const res = await request(ctx.app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("notFoundHandler (unknown routes)", () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });
  afterEach(() => {
    ctx.cleanup();
  });

  it("GET /api/bogus returns 404 with {error:'Not found'}", async () => {
    const res = await request(ctx.app).get("/api/bogus");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("POST to an unknown route also yields 404", async () => {
    const res = await request(ctx.app)
      .post("/api/does-not-exist")
      .send({ anything: true });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

// The requestLogger middleware (backend/src/logger.ts) emits one JSON line
// per request to stdout when the response finishes. Closes NFR10 — previously
// only verifiable by reading `docker compose logs` by hand. Pattern:
//   1. Spy on process.stdout.write so we can capture what would have hit the
//      terminal (and also suppress noisy test output).
//   2. Make a real HTTP round-trip through Supertest, which runs through the
//      whole middleware chain including requestLogger.
//   3. Yield one tick so the `res.on("finish", …)` handler has a chance to
//      run — Supertest's await resolves on response receipt, which is
//      typically slightly before `finish` fires server-side.
//   4. Parse the captured stdout, filter for JSON lines that look like our
//      request log, and assert the shape promised in NFR10.
describe("requestLogger (NFR10)", () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });
  afterEach(() => {
    ctx.cleanup();
    vi.restoreAllMocks();
  });

  it("emits exactly one JSON line per request with required fields", async () => {
    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(((chunk: unknown) => {
        writes.push(typeof chunk === "string" ? chunk : String(chunk));
        return true;
      }) as typeof process.stdout.write);

    try {
      const res = await request(ctx.app).get("/api/health");
      expect(res.status).toBe(200);
      // Let res.on('finish') fire on the server side.
      await new Promise((r) => setImmediate(r));
    } finally {
      spy.mockRestore();
    }

    const requestLogs = writes
      .map((s) => s.trim())
      .filter((s) => s.startsWith("{") && s.endsWith("}"))
      .map((s) => {
        try {
          return JSON.parse(s) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(
        (o): o is Record<string, unknown> =>
          o !== null && o.path === "/api/health" && o.method === "GET"
      );

    // Exactly one log line for the one request we made.
    expect(requestLogs).toHaveLength(1);
    const line = requestLogs[0]!;

    // Shape promised by NFR10 + the logger implementation.
    expect(line).toMatchObject({
      level: "info",
      method: "GET",
      path: "/api/health",
      status: 200,
    });
    // `ts` is an ISO timestamp string parseable by Date.
    expect(typeof line.ts).toBe("string");
    expect(new Date(line.ts as string).toString()).not.toBe("Invalid Date");
    // `duration_ms` is a non-negative number (process.hrtime delta in ms).
    expect(typeof line.duration_ms).toBe("number");
    expect(line.duration_ms as number).toBeGreaterThanOrEqual(0);
  });
});
