import { v4 as uuidv4 } from "uuid";
import type { Todo } from "@todo/shared";
import type { Db } from "../db/connection.js";

/**
 * Opaque options object threaded through every repository (and service) call.
 *
 * In v1 this type is empty — the implementation ignores it. It exists so that
 * adding cross-cutting context (e.g. `userId` when auth lands, request id,
 * tenant id, locale) is a single-line type change rather than a method-arity
 * refactor through every layer.
 *
 * v2 will likely add:
 *   userId: string;
 * and the repository's WHERE clauses will gain `AND user_id = ?` predicates.
 */
export type RepoContext = {
  // No fields in v1. Intentionally non-empty type body kept for documentation.
  // (TypeScript treats `{}` as "any non-null object" which is too permissive;
  // we want an explicit empty-shape today.)
  readonly _v1_reserved?: never;
};

type Row = {
  id: string;
  title: string;
  completed: number;
  created_at: string;
  updated_at: string;
};

function toTodo(row: Row): Todo {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface TodoRepository {
  list(ctx?: RepoContext): Todo[];
  findById(id: string, ctx?: RepoContext): Todo | null;
  create(input: { title: string }, ctx?: RepoContext): Todo;
  update(
    id: string,
    patch: { title?: string; completed?: boolean },
    ctx?: RepoContext
  ): Todo | null;
  delete(id: string, ctx?: RepoContext): boolean;
  deleteCompleted(ctx?: RepoContext): number;
}

export class SqliteTodoRepository implements TodoRepository {
  constructor(private readonly db: Db) {}

  // Note on the unused `_ctx` parameters below: they're plumbing, not
  // dead code. v2 will read userId from here and add `AND user_id = ?`
  // predicates to every WHERE clause + an INSERT field for create.

  list(_ctx?: RepoContext): Todo[] {
    const rows = this.db
      .prepare(
        "SELECT id, title, completed, created_at, updated_at FROM todos ORDER BY created_at DESC"
      )
      .all() as Row[];
    return rows.map(toTodo);
  }

  findById(id: string, _ctx?: RepoContext): Todo | null {
    const row = this.db
      .prepare(
        "SELECT id, title, completed, created_at, updated_at FROM todos WHERE id = ?"
      )
      .get(id) as Row | undefined;
    return row ? toTodo(row) : null;
  }

  create(input: { title: string }, _ctx?: RepoContext): Todo {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: uuidv4(),
      title: input.title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO todos (id, title, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(todo.id, todo.title, 0, todo.createdAt, todo.updatedAt);
    return todo;
  }

  update(
    id: string,
    patch: { title?: string; completed?: boolean },
    ctx?: RepoContext
  ): Todo | null {
    const existing = this.findById(id, ctx);
    if (!existing) return null;
    const now = new Date().toISOString();
    const nextTitle = patch.title ?? existing.title;
    const nextCompleted =
      patch.completed === undefined ? existing.completed : patch.completed;
    this.db
      .prepare(
        "UPDATE todos SET title = ?, completed = ?, updated_at = ? WHERE id = ?"
      )
      .run(nextTitle, nextCompleted ? 1 : 0, now, id);
    return {
      ...existing,
      title: nextTitle,
      completed: nextCompleted,
      updatedAt: now,
    };
  }

  delete(id: string, _ctx?: RepoContext): boolean {
    const info = this.db.prepare("DELETE FROM todos WHERE id = ?").run(id);
    return info.changes > 0;
  }

  deleteCompleted(_ctx?: RepoContext): number {
    const info = this.db.prepare("DELETE FROM todos WHERE completed = 1").run();
    return info.changes;
  }
}
