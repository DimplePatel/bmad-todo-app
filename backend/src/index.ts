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

app.listen(config.port, () => {
  log("info", {
    msg: "server.listen",
    port: config.port,
    env: config.nodeEnv,
    databasePath: config.databasePath,
  });
});
