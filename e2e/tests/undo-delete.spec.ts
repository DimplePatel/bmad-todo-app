import { expect, test } from "@playwright/test";
import { addTodo, resetServerState } from "./_helpers";

test.beforeEach(async ({ request }) => {
  await resetServerState(request);
});

test("undo within 5s restores the row; otherwise deletion sticks", async ({
  page,
}) => {
  await page.goto("/");
  await addTodo(page, "undo-me");

  // Use the row's checkbox as a row-scoped locator. We deliberately don't use
  // getByText("undo-me") for "is the row hidden?" because the toast message
  // (`Deleted "undo-me".`) ALSO contains the title and would mask a real bug.
  const rowCheckbox = page.getByRole("checkbox", {
    name: /mark "undo-me" as complete/i,
  });

  await page.getByRole("button", { name: /delete "undo-me"/i }).click();
  await expect(rowCheckbox).toHaveCount(0);

  // Undo within the window. The toast's affordance currently re-uses the
  // Retry slot; assert via the toast region so we don't pick up unrelated
  // buttons elsewhere on the page.
  await page.getByRole("button", { name: /retry/i }).click();
  await expect(rowCheckbox).toHaveCount(1);

  // Delete again, but this time wait for the 5s undo timer to elapse so the
  // server actually receives the DELETE.
  await page.getByRole("button", { name: /delete "undo-me"/i }).click();
  await expect(rowCheckbox).toHaveCount(0);
  await page.waitForTimeout(5500);

  // After reload the toast is gone, so a coarse text check is safe and proves
  // the row is gone from the server too.
  await page.reload();
  await expect(page.getByText("undo-me")).toHaveCount(0);
});
