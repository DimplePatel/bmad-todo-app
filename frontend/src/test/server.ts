import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Todo } from "@todo/shared";

let store: Todo[] = [];
let nextSeq = 1;

function nowIso() {
  return new Date(2026, 0, 1, 0, 0, 0, nextSeq++).toISOString();
}

export function resetStore(initial: Todo[] = []): void {
  store = [...initial];
  nextSeq = 1;
}

export function getStore(): Todo[] {
  return store;
}

export const handlers = [
  http.get("/api/todos", () =>
    HttpResponse.json([...store].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
  ),
  http.post("/api/todos", async ({ request }) => {
    const body = (await request.json()) as { title?: unknown };
    const title = String(body.title ?? "").trim();
    if (title.length === 0 || title.length > 200) {
      return HttpResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }
    const t: Todo = {
      id: `srv-${Math.random().toString(36).slice(2, 10)}`,
      title,
      completed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.push(t);
    return HttpResponse.json(t, { status: 201 });
  }),
  http.patch("/api/todos/:id", async ({ params, request }) => {
    const body = (await request.json()) as Partial<Todo>;
    const idx = store.findIndex((t) => t.id === params.id);
    if (idx < 0)
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    const updated: Todo = {
      ...store[idx]!,
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.completed !== undefined
        ? { completed: Boolean(body.completed) }
        : {}),
      updatedAt: nowIso(),
    };
    store[idx] = updated;
    return HttpResponse.json(updated);
  }),
  http.delete("/api/todos/:id", ({ params }) => {
    const before = store.length;
    store = store.filter((t) => t.id !== params.id);
    if (store.length === before)
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete("/api/todos", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get("completed") !== "true") {
      return HttpResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const before = store.length;
    store = store.filter((t) => !t.completed);
    return HttpResponse.json({ deleted: before - store.length });
  }),
];

export const server = setupServer(...handlers);
