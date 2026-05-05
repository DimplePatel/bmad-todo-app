import type { Todo } from "@todo/shared";
import type { TodoRepository } from "../repositories/todos.repository.js";

export class TodosService {
  constructor(private readonly repo: TodoRepository) {}

  list(): Todo[] {
    return this.repo.list();
  }

  create(input: { title: string }): Todo {
    return this.repo.create({ title: input.title });
  }

  update(
    id: string,
    patch: { title?: string; completed?: boolean }
  ): Todo | null {
    return this.repo.update(id, patch);
  }

  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  deleteCompleted(): number {
    return this.repo.deleteCompleted();
  }
}
