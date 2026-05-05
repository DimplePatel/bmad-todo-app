import type { NextFunction, Request, Response } from "express";

type Level = "info" | "error";

export function log(level: Level, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...fields,
  });
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    log("info", {
      method: req.method,
      path: req.originalUrl ?? req.url,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
    });
  });
  next();
}
