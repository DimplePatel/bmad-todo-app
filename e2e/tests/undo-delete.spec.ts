import { expect, test } from "./_fixtures";

test("undo within 5s restores the row; otherwise deletion sticks", async ({
  todoPage,
  page,
}) => {
  await todoPage.addTodo("undo-me");
  const row = todoPage.row("undo-me");

  // First delete + Undo within the window.
  await row.delete();
  await expect(row.root).toHaveCount(0);
  await todoPage.undoButton.click();
  await expect(row.root).toBeVisible();

  // Second delete, let the 5s timer elapse, then reload to verify the row
  // also went on the server. Asserting after reload eliminates the toast
  // (which contains the title in its message) as a false-positive source.
  await row.delete();
  await expect(row.root).toHaveCount(0);
  await page.waitForTimeout(5500);
  await page.reload();
  await expect(row.root).toHaveCount(0);
});
