import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
