import { expect, test } from "@playwright/test";
import { addTodo, resetServerState } from "./_helpers";

test.beforeEach(async ({ request }) => {
  await resetServerState(request);
  // Playwright contexts are isolated; localStorage starts clean. Critically,
  // do NOT addInitScript to clear it — that would clear on page.reload() too
  // and defeat this very test.
});

test("active filter persists across page reload", async ({ page }) => {
  await page.goto("/");
  await addTodo(page, "active-task");
  await addTodo(page, "done-task");
  await page
    .getByRole("checkbox", { name: /mark "done-task" as complete/i })
    .click();

  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.getByText("active-task")).toBeVisible();
  await expect(page.getByText("done-task")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Active", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByText("active-task")).toBeVisible();
  await expect(page.getByText("done-task")).toHaveCount(0);
});
