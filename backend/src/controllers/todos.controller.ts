import { Router, type Request } from "express";
import { ZodError } from "zod";
import { HttpError } from "../errors/http-error.js";
import type { RepoContext } from "../repositories/todos.repository.js";
import {
  BulkDeleteQuery,
  CreateTodoBody,
  IdParam,
  UpdateTodoBody,
} from "../validators/todos.schema.js";
import type { TodosService } from "../services/todos.service.js";

function unwrap<T>(parser: { parse: (input: unknown) => T }, input: unknown): T {
  try {
    return parser.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpError(400, "Invalid request", err.issues);
    }
    throw err;
  }
}

/**
 * Build the per-request RepoContext that's threaded through service +
 * repository calls. Today this returns an empty object — v2 will read
 * `req.user?.id` (populated by an auth middleware) and put it on the
 * context. Centralising the construction here means the rest of the
 * controller doesn't need to know about auth state when it lands.
 */
function ctx(_req: Request): RepoContext {
  return {};
}

export function todosController(service: TodosService): Router {
  const router = Router();

  // Bulk delete must come BEFORE the parameterized routes.
  router.delete("/", (req, res) => {
    unwrap(BulkDeleteQuery, req.query);
    const deleted = service.deleteCompleted(ctx(req));
    res.status(200).json({ deleted });
  });

  router.get("/", (req, res) => {
    res.status(200).json(service.list(ctx(req)));
  });

  router.post("/", (req, res) => {
    const body = unwrap(CreateTodoBody, req.body);
    const todo = service.create({ title: body.title }, ctx(req));
    res.status(201).json(todo);
  });

  router.patch("/:id", (req, res) => {
    const { id } = unwrap(IdParam, req.params);
    const parsed = unwrap(UpdateTodoBody, req.body);
    const patch: { title?: string; completed?: boolean } = {};
    if (parsed.title !== undefined) patch.title = parsed.title;
    if (parsed.completed !== undefined) patch.completed = parsed.completed;
    const updated = service.update(id, patch, ctx(req));
    if (!updated) throw new HttpError(404, "Todo not found");
    res.status(200).json(updated);
  });

  router.delete("/:id", (req, res) => {
    const { id } = unwrap(IdParam, req.params);
    const ok = service.delete(id, ctx(req));
    if (!ok) throw new HttpError(404, "Todo not found");
    res.status(204).send();
  });

  return router;
}
