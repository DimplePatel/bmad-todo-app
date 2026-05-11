import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@todo/shared";
import { buildApp } from "../../src/app.js";
import { openDatabase, runMigrations } from "../../src/db/connection.js";
import { SqliteTodoRepository } from "../../src/repositories/todos.repository.js";
import { createTestContext, type TestContext } from "../helpers.js";

describe("Todos API", () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });
  afterEach(() => {
    ctx.cleanup();
  });

  describe("GET /api/todos", () => {
    it("returns [] when empty", async () => {
      const res = await request(ctx.app).get("/api/todos");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns todos sorted by createdAt desc", async () => {
      const a = ctx.repo.create({ title: "a" });
      await new Promise((r) => setTimeout(r, 5));
      const b = ctx.repo.create({ title: "b" });
      const res = await request(ctx.app).get("/api/todos");
      expect(res.status).toBe(200);
      expect(res.body.map((t: { id: string }) => t.id)).toEqual([b.id, a.id]);
    });
  });

  describe("POST /api/todos", () => {
    it("creates a todo and trims the title (201)", async () => {
      const res = await request(ctx.app)
        .post("/api/todos")
        .send({ title: "  buy milk  " });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("buy milk");
      expect(res.body.completed).toBe(false);
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it("rejects empty title (400)", async () => {
      const res = await request(ctx.app)
        .post("/api/todos")
        .send({ title: "" });
      expect(res.status).toBe(400);
    });

    it("rejects whitespace-only title (400)", async () => {
      const res = await request(ctx.app)
        .post("/api/todos")
        .send({ title: "    " });
      expect(res.status).toBe(400);
    });

    it("rejects > 200 chars (400)", async () => {
      const res = await request(ctx.app)
        .post("/api/todos")
        .send({ title: "x".repeat(201) });
      expect(res.status).toBe(400);
    });

    it("rejects non-JSON body (400)", async () => {
      const res = await request(ctx.app)
        .post("/api/todos")
        .set("content-type", "application/json")
        .send("not json{{");
      expect(res.status).toBe(400);
    });

    it("rejects oversized JSON body with 413 (B5)", async () => {
      // express.json limit is 16kb; send a body comfortably over.
      const huge = { title: "x".repeat(20 * 1024) };
      const res = await request(ctx.app)
        .post("/api/todos")
        .set("content-type", "application/json")
        .send(JSON.stringify(huge));
      expect(res.status).toBe(413);
      expect(res.body).toMatchObject({ error: "Request body too large" });
    });
  });

  describe("PATCH /api/todos/:id", () => {
    it("toggles completion (200)", async () => {
      const t = ctx.repo.create({ title: "x" });
      const res = await request(ctx.app)
        .patch(`/api/todos/${t.id}`)
        .send({ completed: true });
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });

    it("updates title (200)", async () => {
      const t = ctx.repo.create({ title: "old" });
      const res = await request(ctx.app)
        .patch(`/api/todos/${t.id}`)
        .send({ title: "new" });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("new");
    });

    it("updates both title and completed in one request (200)", async () => {
      // The schema accepts both fields together (verified in schema.test.ts);
      // this test makes sure the controller's strip-undefined logic still
      // forwards both when both are present. Without this, a regression to
      // the D2-era "only one field at a time" semantics would slip through.
      const t = ctx.repo.create({ title: "old" });
      const res = await request(ctx.app)
        .patch(`/api/todos/${t.id}`)
        .send({ title: "new title", completed: true });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("new title");
      expect(res.body.completed).toBe(true);
    });

    it("no-op PATCH still advances updated_at (documents current behavior)", async () => {
      // Repository.update() writes updated_at = now unconditionally — see
      // C3 in the bug review. This test documents that behavior so a future
      // optimisation that skips no-op writes has to update the contract
      // here (and presumably in the architecture doc) at the same time.
      const t = ctx.repo.create({ title: "x" });
      await new Promise((r) => setTimeout(r, 10));
      const res = await request(ctx.app)
        .patch(`/api/todos/${t.id}`)
        .send({ completed: false }); // same as the created value
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(false);
      expect(res.body.title).toBe("x");
      expect(res.body.updatedAt > t.updatedAt).toBe(true);
    });

    it("returns 404 when the row vanishes between findById and UPDATE (B2 / HTTP layer)", async () => {
      // The repository unit test simulates the race via vi.spyOn on
      // findById; mirror that at the HTTP layer so the controller's 404
      // wiring is exercised, not just the repo's null return.
      const phantom: Todo = {
        id: "11111111-1111-1111-1111-111111111111",
        title: "ghost",
        completed: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const findSpy = vi
        .spyOn(ctx.repo, "findById")
        .mockReturnValue(phantom);

      const res = await request(ctx.app)
        .patch(`/api/todos/${phantom.id}`)
        .send({ completed: true });

      expect(findSpy).toHaveBeenCalled();
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: "Todo not found" });
    });

    it("404 on unknown id", async () => {
      const res = await request(ctx.app)
        .patch("/api/todos/00000000-0000-0000-0000-000000000000")
        .send({ completed: true });
      expect(res.status).toBe(404);
    });

    it("400 on non-UUID id", async () => {
      const res = await request(ctx.app)
        .patch("/api/todos/not-a-uuid")
        .send({ completed: true });
      expect(res.status).toBe(400);
    });

    it("400 on empty body", async () => {
      const t = ctx.repo.create({ title: "x" });
      const res = await request(ctx.app).patch(`/api/todos/${t.id}`).send({});
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/todos/:id", () => {
    it("deletes and returns 204", async () => {
      const t = ctx.repo.create({ title: "x" });
      const res = await request(ctx.app).delete(`/api/todos/${t.id}`);
      expect(res.status).toBe(204);
      expect(ctx.repo.findById(t.id)).toBeNull();
    });
    it("404 on miss", async () => {
      const res = await request(ctx.app).delete(
        "/api/todos/00000000-0000-0000-0000-000000000000"
      );
      expect(res.status).toBe(404);
    });
    it("400 on non-UUID", async () => {
      const res = await request(ctx.app).delete("/api/todos/not-a-uuid");
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/todos?completed=true", () => {
    it("removes only completed rows and reports count", async () => {
      const a = ctx.repo.create({ title: "a" });
      const b = ctx.repo.create({ title: "b" });
      const c = ctx.repo.create({ title: "c" });
      ctx.repo.update(a.id, { completed: true });
      ctx.repo.update(b.id, { completed: true });
      const res = await request(ctx.app).delete("/api/todos?completed=true");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: 2 });
      // Assert *which* row survives — a regression that deleted by id range
      // or by some other predicate would still pass the count check.
      const remaining = ctx.repo.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe(c.id);
      expect(remaining[0]?.completed).toBe(false);
    });

    it("returns 0 when nothing completed", async () => {
      ctx.repo.create({ title: "a" });
      const res = await request(ctx.app).delete("/api/todos?completed=true");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: 0 });
    });

    it("400 when ?completed is missing", async () => {
      const res = await request(ctx.app).delete("/api/todos");
      expect(res.status).toBe(400);
    });

    it("400 when ?completed=false", async () => {
      const res = await request(ctx.app).delete("/api/todos?completed=false");
      expect(res.status).toBe(400);
    });
  });

  describe("security headers", () => {
    it("sets helmet defaults on /api/health", async () => {
      const res = await request(ctx.app).get("/api/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBeTruthy();
    });

    it("sets helmet defaults on /api/todos", async () => {
      // Helmet is registered at the top of buildApp so every route should
      // get the same headers; assert explicitly so a future refactor that
      // scopes helmet to a sub-router doesn't quietly drop them.
      const res = await request(ctx.app).get("/api/todos");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBeTruthy();
    });
  });
});

// CORS is configured in app.ts via `cors({ origin: deps.corsOrigin })`.
// createTestContext() uses the default app build (no corsOrigin → reflect
// any origin) which doesn't exercise the allowlist path. Build a fresh app
// here with a real allowlist so the integration test actually verifies
// what config.test.ts only asserts at the parse layer.
describe("CORS allowlist (NFR9, B1)", () => {
  let app: import("express").Express;
  let cleanup: () => void;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-cors-"));
    const dbPath = path.join(dir, "todos.db");
    const db = openDatabase(dbPath);
    runMigrations(db);
    const repo = new SqliteTodoRepository(db);
    app = buildApp({ repo, corsOrigin: ["http://localhost:5173"] });
    cleanup = () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("reflects an allowed origin on a preflight request", async () => {
    const res = await request(app)
      .options("/api/todos")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    // cors() returns 204 on preflight with the allowed origin reflected.
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173"
    );
  });

  it("does NOT echo an Allow-Origin header for a disallowed origin", async () => {
    // The cors middleware doesn't 403 a disallowed origin — it just omits
    // the Access-Control-Allow-Origin header, letting the browser block
    // the response. That's the contract this test pins down.
    const res = await request(app)
      .get("/api/todos")
      .set("Origin", "http://evil.example.com");
    // The request itself still completes server-side …
    expect(res.status).toBe(200);
    // … but the CORS header that would unlock it browser-side is absent.
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
