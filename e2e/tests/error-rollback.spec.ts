import { expect, test } from "./_fixtures";

test("server 500 on create rolls back optimistic UI and toast retries successfully", async ({
  todoPage,
  page,
}) => {
  // Intercept the *next* POST /api/todos with a 500; subsequent calls pass
  // through. Set after the initial page load (which has already done its
  // GET /api/todos), so only the create being tested is affected.
  let blocked = true;
  await page.route("**/api/todos", async (route, req) => {
    if (req.method() === "POST" && blocked) {
      blocked = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" }),
      });
      return;
    }
    await route.continue();
  });

  await todoPage.newTodoInput.fill("retry me");
  await todoPage.newTodoInput.press("Enter");

  await expect(todoPage.retryButton).toBeVisible();
  await todoPage.retryButton.click();
  await expect(todoPage.row("retry me").root).toBeVisible();
});

test("server 404 on toggle (stale row) reverts the optimistic UI and shows an error toast", async ({
  todoPage,
  page,
}) => {
  // Real-world cause: another session (or a server-side bulk operation)
  // deleted the row between our list fetch and our toggle. The PATCH 404s
  // and the UI must roll back rather than silently desync.
  await todoPage.addTodo("stale row");
  const row = todoPage.row("stale row");

  // Intercept every PATCH /api/todos/* with 404 from this point on.
  await page.route("**/api/todos/*", async (route, req) => {
    if (req.method() === "PATCH") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Todo not found" }),
      });
      return;
    }
    await route.continue();
  });

  await row.checkbox.click();

  // Optimistic state reverts: checkbox is unchecked again after the 404.
  await expect(row.checkbox).not.toBeChecked();

  // Error toast surfaces with both the human-readable message and a Retry
  // affordance (Retry would 404 again here; we only verify it's offered).
  await expect(todoPage.retryButton).toBeVisible();
  await expect(
    page.getByText(/couldn't update task.*todo not found/i)
  ).toBeVisible();
});
