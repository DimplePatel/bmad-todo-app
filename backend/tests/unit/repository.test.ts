import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@todo/shared";
import { createTestContext, type TestContext } from "../helpers.js";

describe("SqliteTodoRepository", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe("list()", () => {
    it("returns empty array on empty DB", () => {
      expect(ctx.repo.list()).toEqual([]);
    });

    it("returns rows ordered by createdAt desc", async () => {
      const a = ctx.repo.create({ title: "first" });
      // ensure the second todo gets a later createdAt
      await new Promise((r) => setTimeout(r, 5));
      const b = ctx.repo.create({ title: "second" });
      const list = ctx.repo.list();
      expect(list.map((t) => t.id)).toEqual([b.id, a.id]);
    });
  });

  describe("create()", () => {
    it("generates UUID, ISO timestamps, and completed=false", () => {
      const t = ctx.repo.create({ title: "buy milk" });
      expect(t.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(t.title).toBe("buy milk");
      expect(t.completed).toBe(false);
      expect(new Date(t.createdAt).toString()).not.toBe("Invalid Date");
      expect(t.createdAt).toBe(t.updatedAt);
    });
  });

  describe("update()", () => {
    it("updates title and refreshes updatedAt", async () => {
      const t = ctx.repo.create({ title: "old" });
      await new Promise((r) => setTimeout(r, 5));
      const u = ctx.repo.update(t.id, { title: "new" });
      expect(u).not.toBeNull();
      expect(u!.title).toBe("new");
      expect(u!.updatedAt > t.updatedAt).toBe(true);
    });

    it("toggles completed", () => {
      const t = ctx.repo.create({ title: "x" });
      const u = ctx.repo.update(t.id, { completed: true });
      expect(u!.completed).toBe(true);
    });

    it("returns null when id missing", () => {
      expect(
        ctx.repo.update("00000000-0000-0000-0000-000000000000", {
          completed: true,
        })
      ).toBeNull();
    });

    it("returns null when the row vanishes between findById and UPDATE (B2)", () => {
      // Simulate a concurrent DELETE that lands between the SELECT and the
      // UPDATE inside `update()`. We stub findById to claim the row exists
      // (so the early return is skipped) while the actual DB has no row
      // with that id — the UPDATE matches 0 changes and we want null,
      // not a fabricated Todo.
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

      const result = ctx.repo.update(phantom.id, { completed: true });

      expect(findSpy).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("delete()", () => {
    it("returns true on hit", () => {
      const t = ctx.repo.create({ title: "x" });
      expect(ctx.repo.delete(t.id)).toBe(true);
      expect(ctx.repo.findById(t.id)).toBeNull();
    });

    it("returns false on miss", () => {
      expect(
        ctx.repo.delete("00000000-0000-0000-0000-000000000000")
      ).toBe(false);
    });
  });

  describe("deleteCompleted()", () => {
    it("deletes only completed rows and returns the count", () => {
      const a = ctx.repo.create({ title: "a" });
      const b = ctx.repo.create({ title: "b" });
      ctx.repo.create({ title: "c" });
      ctx.repo.update(a.id, { completed: true });
      ctx.repo.update(b.id, { completed: true });
      const n = ctx.repo.deleteCompleted();
      expect(n).toBe(2);
      expect(ctx.repo.list()).toHaveLength(1);
    });

    it("returns 0 when no rows are completed", () => {
      ctx.repo.create({ title: "a" });
      expect(ctx.repo.deleteCompleted()).toBe(0);
    });
  });
});
