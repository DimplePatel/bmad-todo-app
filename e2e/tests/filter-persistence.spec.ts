import { expect, test } from "./_fixtures";

test("active filter persists across page reload", async ({
  todoPage,
  page,
}) => {
  await todoPage.addTodo("active-task");
  await todoPage.addTodo("done-task");
  await todoPage.row("done-task").toggle();

  await todoPage.setFilter("Active");
  await expect(todoPage.row("active-task").root).toBeVisible();
  await expect(todoPage.row("done-task").root).toHaveCount(0);

  await page.reload();
  await expect(todoPage.filterChip("Active")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(todoPage.row("active-task").root).toBeVisible();
  await expect(todoPage.row("done-task").root).toHaveCount(0);
});
