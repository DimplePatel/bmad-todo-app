import { type APIRequestContext } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

/**
 * Reset the backend to an empty state via the API. Faster + more deterministic
 * than driving the UI; the API is also the contract under test, so any drift
 * in cleanup behaviour would show up as a real test failure.
 */
export async function resetServerState(
  request: APIRequestContext
): Promise<void> {
  const list = await request.get(`${BACKEND_URL}/api/todos`);
  const todos = (await list.json()) as Array<{ id: string }>;
  for (const t of todos) {
    await request.patch(`${BACKEND_URL}/api/todos/${t.id}`, {
      data: { completed: true },
    });
  }
  await request.delete(`${BACKEND_URL}/api/todos?completed=true`);
}
