export type Config = {
  port: number;
  nodeEnv: "development" | "test" | "production";
  databasePath: string;
  corsOrigin: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = (env.NODE_ENV ?? "development") as Config["nodeEnv"];
  const port = Number(env.PORT ?? 3001);
  const databasePath = env.DATABASE_PATH ?? "./data/todos.db";
  const rawOrigin = env.CORS_ORIGIN ?? "http://localhost:5173";
  const corsOrigin = rawOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (nodeEnv === "production" && corsOrigin.includes("*")) {
    throw new Error(
      "Refusing to start: CORS_ORIGIN='*' is not allowed in production. Set an explicit allowlist."
    );
  }

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }

  return { port, nodeEnv, databasePath, corsOrigin };
}
