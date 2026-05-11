import { expect, test } from "./_fixtures";

test("deleting the only todo reveals the empty state", async ({ todoPage }) => {
  // Sanity check: we begin on the empty state.
  await expect(todoPage.emptyState).toBeVisible();
  await expect(todoPage.listItems).toHaveCount(0);

  // Create one todo and confirm it renders.
  await todoPage.addTodo("delete me");
  await expect(todoPage.row("delete me").root).toBeVisible();
  await expect(todoPage.emptyState).toHaveCount(0);

  // Delete it. The row is removed optimistically, so the empty state
  // reappears immediately — no need to wait the 5s undo window.
  await todoPage.row("delete me").delete();

  await expect(todoPage.row("delete me").root).toHaveCount(0);
  await expect(todoPage.listItems).toHaveCount(0);
  await expect(todoPage.emptyState).toBeVisible();
});
