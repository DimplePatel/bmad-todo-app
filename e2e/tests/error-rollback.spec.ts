import { expect, test } from "@playwright/test";
import { resetServerState } from "./_helpers";

test.beforeEach(async ({ request, page }) => {
  await resetServerState(request);
  await page.addInitScript(() => window.localStorage.clear());
});

test("server 500 on create rolls back optimistic UI and toast retries successfully", async ({
  page,
}) => {
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

  await page.goto("/");
  await page.getByLabel("New todo").fill("retry me");
  await page.getByLabel("New todo").press("Enter");

  // Optimistic row was rolled back; toast appears.
  const retry = page.getByRole("button", { name: /retry/i });
  await expect(retry).toBeVisible();

  await retry.click();
  await expect(page.getByText("retry me")).toBeVisible();
});
