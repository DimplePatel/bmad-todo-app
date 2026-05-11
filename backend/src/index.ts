import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase, runMigrations } from "./db/connection.js";
import { log } from "./logger.js";
import { SqliteTodoRepository } from "./repositories/todos.repository.js";

const config = loadConfig();
const db = openDatabase(config.databasePath);
runMigrations(db);
const repo = new SqliteTodoRepository(db);
const app = buildApp({ repo, corsOrigin: config.corsOrigin });

const server = app.listen(config.port, () => {
  log("info", {
    msg: "server.listen",
    port: config.port,
    env: config.nodeEnv,
    databasePath: config.databasePath,
  });
});

// Graceful shutdown (B8). Docker sends SIGTERM on `docker stop`; tini in the
// Dockerfile propagates it as PID 1. Without these handlers, Express keeps
// accepting connections and in-flight requests are cut off mid-flight;
// better-sqlite3 also doesn't checkpoint the WAL on a clean shutdown.
//
// On signal:
//   1. Stop accepting new connections (server.close).
//   2. Wait for in-flight requests to finish (server.close callback).
//   3. Close the DB so the WAL is checkpointed and the file is flushed.
//   4. Exit 0. Fall back to exit 1 if we're still running after a grace
//      window — Kubernetes / Docker's own kill timer will take over otherwise.
const SHUTDOWN_GRACE_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", { msg: "server.shutdown.begin", signal });

  const forceExit = setTimeout(() => {
    log("error", { msg: "server.shutdown.forced", signal });
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  server.close((err) => {
    if (err) log("error", { msg: "server.close.error", error: err.message });
    try {
      db.close();
      log("info", { msg: "server.shutdown.complete", signal });
    } catch (e) {
      log("error", {
        msg: "db.close.error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
