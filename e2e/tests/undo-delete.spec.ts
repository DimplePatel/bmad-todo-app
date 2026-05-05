import { expect, test } from "@playwright/test";
import { addTodo, resetServerState } from "./_helpers";

test.beforeEach(async ({ request, page }) => {
  await resetServerState(request);
  await page.addInitScript(() => window.localStorage.clear());
});

test("undo within 5s restores the row; otherwise deletion sticks", async ({
  page,
}) => {
  await page.goto("/");
  await addTodo(page, "undo-me");

  await page.getByRole("button", { name: /delete "undo-me"/i }).click();
  await expect(page.getByText("undo-me")).toHaveCount(0);

  // Undo within the window.
  await page.getByRole("button", { name: /retry/i }).click(); // "Retry" button is our Undo affordance
  await expect(page.getByText("undo-me")).toBeVisible();

  // Delete again, but this time wait for the timer to elapse.
  await page.getByRole("button", { name: /delete "undo-me"/i }).click();
  await expect(page.getByText("undo-me")).toHaveCount(0);
  await page.waitForTimeout(5500);
  await page.reload();
  await expect(page.getByText("undo-me")).toHaveCount(0);
});
