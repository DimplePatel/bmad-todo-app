import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
      ctx.repo.create({ title: "c" });
      ctx.repo.update(a.id, { completed: true });
      ctx.repo.update(b.id, { completed: true });
      const res = await request(ctx.app).delete("/api/todos?completed=true");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: 2 });
      expect(ctx.repo.list()).toHaveLength(1);
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
    it("sets helmet defaults", async () => {
      const res = await request(ctx.app).get("/api/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBeTruthy();
    });
  });
});
