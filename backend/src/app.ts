import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { healthController } from "./controllers/health.controller.js";
import { todosController } from "./controllers/todos.controller.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./logger.js";
import type { TodoRepository } from "./repositories/todos.repository.js";
import { TodosService } from "./services/todos.service.js";

export type AppDeps = {
  repo: TodoRepository;
  corsOrigin?: string[];
};

export function buildApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: deps.corsOrigin && deps.corsOrigin.length > 0 ? deps.corsOrigin : true,
    })
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(requestLogger);

  app.use("/api/health", healthController());
  app.use("/api/todos", todosController(new TodosService(deps.repo)));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
