import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/http-error.js";
import { log } from "../logger.js";

export const notFoundHandler = (
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.issues !== undefined) body.issues = err.issues;
    res.status(err.status).json(body);
    return;
  }

  // express.json body-parser errors
  const e = err as { type?: string; status?: number; statusCode?: number; message?: string };
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  if (e?.type === "entity.too.large") {
    // RFC 9110 §15.5.14: 413 Content Too Large.
    res.status(413).json({ error: "Request body too large" });
    return;
  }
  if (typeof e?.status === "number" && e.status >= 400 && e.status < 500) {
    res.status(e.status).json({ error: e.message ?? "Bad request" });
    return;
  }

  log("error", {
    msg: "Unhandled exception",
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: "Internal server error" });
};
