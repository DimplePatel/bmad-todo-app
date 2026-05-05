import type { Todo } from "@todo/shared";

const BASE = "/api/todos";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const message =
      (body as { error?: string } | undefined)?.error ??
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  list: async (): Promise<Todo[]> => handle<Todo[]>(await fetch(BASE)),
  create: async (title: string): Promise<Todo> =>
    handle<Todo>(
      await fetch(BASE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      })
    ),
  update: async (
    id: string,
    patch: { title?: string; completed?: boolean }
  ): Promise<Todo> =>
    handle<Todo>(
      await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
    ),
  remove: async (id: string): Promise<void> =>
    handle<void>(await fetch(`${BASE}/${id}`, { method: "DELETE" })),
  clearCompleted: async (): Promise<{ deleted: number }> =>
    handle<{ deleted: number }>(
      await fetch(`${BASE}?completed=true`, { method: "DELETE" })
    ),
};
