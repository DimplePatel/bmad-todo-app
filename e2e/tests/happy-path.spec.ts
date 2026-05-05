import { expect, test } from "@playwright/test";
import { addTodo, resetServerState } from "./_helpers";

test.beforeEach(async ({ request, page }) => {
  await resetServerState(request);
  await page.addInitScript(() => window.localStorage.clear());
});

test("happy path: create, complete, delete, clear completed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /todo app/i })
  ).toBeVisible();
  // Empty state visible.
  await expect(page.getByText(/nothing to do yet/i)).toBeVisible();

  // Create three todos.
  await addTodo(page, "first");
  await addTodo(page, "second");
  await addTodo(page, "third");

  // Items-left counter.
  await expect(page.getByText(/3 items left/i)).toBeVisible();

  // Complete two of them.
  await page
    .getByRole("checkbox", { name: /mark "first" as complete/i })
    .click();
  await page
    .getByRole("checkbox", { name: /mark "second" as complete/i })
    .click();
  await expect(page.getByText(/1 item left/i)).toBeVisible();

  // Clear completed.
  await page.getByRole("button", { name: /clear completed/i }).click();
  await expect(page.getByText("first")).toHaveCount(0);
  await expect(page.getByText("second")).toHaveCount(0);
  await expect(page.getByText("third")).toBeVisible();

  // Reload to confirm persistence.
  await page.reload();
  await expect(page.getByText("third")).toBeVisible();
  await expect(page.getByText(/1 item left/i)).toBeVisible();
});
