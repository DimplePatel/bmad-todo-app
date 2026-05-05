import { type APIRequestContext, type Page, expect } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function resetServerState(request: APIRequestContext): Promise<void> {
  // Mark every existing todo as completed, then bulk-delete completed.
  const list = await request.get(`${BACKEND_URL}/api/todos`);
  const todos = (await list.json()) as Array<{ id: string }>;
  for (const t of todos) {
    await request.patch(`${BACKEND_URL}/api/todos/${t.id}`, {
      data: { completed: true },
    });
  }
  await request.delete(`${BACKEND_URL}/api/todos?completed=true`);
}

export async function addTodo(page: Page, title: string): Promise<void> {
  await page.getByLabel("New todo").fill(title);
  await page.getByLabel("New todo").press("Enter");
  await expect(page.getByText(title)).toBeVisible();
}
