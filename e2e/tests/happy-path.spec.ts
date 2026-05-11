import { expect, test } from "./_fixtures";

test("happy path: create, complete, delete, clear completed", async ({
  todoPage,
  page,
}) => {
  await expect(todoPage.emptyState).toBeVisible();
  await expect(todoPage.listItems).toHaveCount(0);

  await todoPage.addTodo("first");
  await todoPage.addTodo("second");
  await todoPage.addTodo("third");
  await expect(todoPage.itemsLeft).toHaveText(/3\s+items\s+left/i);

  await todoPage.row("first").toggle();
  await todoPage.row("second").toggle();
  await expect(todoPage.itemsLeft).toHaveText(/1\s+item\s+left/i);

  await todoPage.clearCompletedButton.click();
  await expect(todoPage.row("first").root).toHaveCount(0);
  await expect(todoPage.row("second").root).toHaveCount(0);
  await expect(todoPage.row("third").root).toBeVisible();

  await page.reload();
  await expect(todoPage.row("third").root).toBeVisible();
  await expect(todoPage.itemsLeft).toHaveText(/1\s+item\s+left/i);
});
