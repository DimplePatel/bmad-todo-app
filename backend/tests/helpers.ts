import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, runMigrations } from "../src/db/connection.js";
import { SqliteTodoRepository } from "../src/repositories/todos.repository.js";
import { buildApp } from "../src/app.js";
import type { Express } from "express";

export type TestContext = {
  app: Express;
  repo: SqliteTodoRepository;
  dbPath: string;
  cleanup: () => void;
};

export function createTestContext(): TestContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-test-"));
  const dbPath = path.join(dir, "todos.db");
  const db = openDatabase(dbPath);
  runMigrations(db);
  const repo = new SqliteTodoRepository(db);
  const app = buildApp({ repo });
  return {
    app,
    repo,
    dbPath,
    cleanup: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
