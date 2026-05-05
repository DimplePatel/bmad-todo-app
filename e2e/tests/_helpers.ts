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
  // Wait for the server's POST response *and* for React Query's onSuccess to
  // replace the optimistic temp-id row with the server's UUID-keyed row. We
  // do this in two steps because the network response landing (Playwright's
  // view) and the cache update (React Query's view) are separated by a
  // microtask + render — clicking inside that window picks up the temp id and
  // any subsequent DELETE goes to a non-existent server resource.
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/todos") &&
      res.request().method() === "POST" &&
      res.status() === 201
  );
  await page.getByLabel("New todo").fill(title);
  await page.getByLabel("New todo").press("Enter");
  await responsePromise;

  // No temp-id checkbox should remain in the DOM — that's the signal that
  // onSuccess has reconciled the cache.
  await expect(
    page.locator('input[type="checkbox"][id^="cb-temp-"]')
  ).toHaveCount(0);
  await expect(page.getByText(title)).toBeVisible();
}
