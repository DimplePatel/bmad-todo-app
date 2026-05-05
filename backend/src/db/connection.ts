import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

export function openDatabase(databasePath: string): Db {
  // Ensure parent directory exists.
  const dir = path.dirname(path.resolve(databasePath));
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function runMigrations(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = new URL("./migrations/", import.meta.url);
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((r) => (r as { id: string }).id)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(new URL(file, migrationsDir), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)"
      ).run(file, new Date().toISOString());
    });
    tx();
  }
}
