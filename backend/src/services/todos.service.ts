import type { Todo } from "@todo/shared";
import type {
  RepoContext,
  TodoRepository,
} from "../repositories/todos.repository.js";

export class TodosService {
  constructor(private readonly repo: TodoRepository) {}

  list(ctx?: RepoContext): Todo[] {
    return this.repo.list(ctx);
  }

  create(input: { title: string }, ctx?: RepoContext): Todo {
    return this.repo.create({ title: input.title }, ctx);
  }

  update(
    id: string,
    patch: { title?: string; completed?: boolean },
    ctx?: RepoContext
  ): Todo | null {
    return this.repo.update(id, patch, ctx);
  }

  delete(id: string, ctx?: RepoContext): boolean {
    return this.repo.delete(id, ctx);
  }

  deleteCompleted(ctx?: RepoContext): number {
    return this.repo.deleteCompleted(ctx);
  }
}
