import { v4 as uuidv4 } from "uuid";
import type { Todo } from "@todo/shared";
import type { Db } from "../db/connection.js";

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
  list(): Todo[];
  findById(id: string): Todo | null;
  create(input: { title: string }): Todo;
  update(
    id: string,
    patch: { title?: string; completed?: boolean }
  ): Todo | null;
  delete(id: string): boolean;
  deleteCompleted(): number;
}

export class SqliteTodoRepository implements TodoRepository {
  constructor(private readonly db: Db) {}

  list(): Todo[] {
    const rows = this.db
      .prepare(
        "SELECT id, title, completed, created_at, updated_at FROM todos ORDER BY created_at DESC"
      )
      .all() as Row[];
    return rows.map(toTodo);
  }

  findById(id: string): Todo | null {
    const row = this.db
      .prepare(
        "SELECT id, title, completed, created_at, updated_at FROM todos WHERE id = ?"
      )
      .get(id) as Row | undefined;
    return row ? toTodo(row) : null;
  }

  create(input: { title: string }): Todo {
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
    patch: { title?: string; completed?: boolean }
  ): Todo | null {
    const existing = this.findById(id);
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

  delete(id: string): boolean {
    const info = this.db.prepare("DELETE FROM todos WHERE id = ?").run(id);
    return info.changes > 0;
  }

  deleteCompleted(): number {
    const info = this.db.prepare("DELETE FROM todos WHERE completed = 1").run();
    return info.changes;
  }
}
