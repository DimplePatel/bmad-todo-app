import { Router } from "express";
import { ZodError } from "zod";
import { HttpError } from "../errors/http-error.js";
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

export function todosController(service: TodosService): Router {
  const router = Router();

  // Bulk delete must come BEFORE the parameterized routes.
  router.delete("/", (req, res) => {
    unwrap(BulkDeleteQuery, req.query);
    const deleted = service.deleteCompleted();
    res.status(200).json({ deleted });
  });

  router.get("/", (_req, res) => {
    res.status(200).json(service.list());
  });

  router.post("/", (req, res) => {
    const body = unwrap(CreateTodoBody, req.body);
    const todo = service.create({ title: body.title });
    res.status(201).json(todo);
  });

  router.patch("/:id", (req, res) => {
    const { id } = unwrap(IdParam, req.params);
    const parsed = unwrap(UpdateTodoBody, req.body);
    const patch: { title?: string; completed?: boolean } = {};
    if (parsed.title !== undefined) patch.title = parsed.title;
    if (parsed.completed !== undefined) patch.completed = parsed.completed;
    const updated = service.update(id, patch);
    if (!updated) throw new HttpError(404, "Todo not found");
    res.status(200).json(updated);
  });

  router.delete("/:id", (req, res) => {
    const { id } = unwrap(IdParam, req.params);
    const ok = service.delete(id);
    if (!ok) throw new HttpError(404, "Todo not found");
    res.status(204).send();
  });

  return router;
}
