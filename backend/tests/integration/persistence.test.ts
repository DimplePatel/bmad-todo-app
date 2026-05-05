import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { openDatabase, runMigrations } from "../../src/db/connection.js";
import { SqliteTodoRepository } from "../../src/repositories/todos.repository.js";

describe("persistence across app restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-persist-"));
  const dbPath = path.join(dir, "todos.db");

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("data survives a rebuild against the same DB file", async () => {
    // First instance: write 3 todos.
    {
      const db = openDatabase(dbPath);
      runMigrations(db);
      const app = buildApp({ repo: new SqliteTodoRepository(db) });
      for (const title of ["one", "two", "three"]) {
        const res = await request(app).post("/api/todos").send({ title });
        expect(res.status).toBe(201);
      }
      db.close();
    }

    // Second instance against the same file.
    {
      const db = openDatabase(dbPath);
      runMigrations(db);
      const app = buildApp({ repo: new SqliteTodoRepository(db) });
      const res = await request(app).get("/api/todos");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body.map((t: { title: string }) => t.title).sort()).toEqual([
        "one",
        "three",
        "two",
      ]);
      db.close();
    }
  });
});
