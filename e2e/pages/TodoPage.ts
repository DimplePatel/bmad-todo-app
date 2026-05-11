import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object Model for the Todo app.
 *
 * Scope of this POM:
 *  - Exposes user-facing **locators** as public readonly fields.
 *  - Wraps repeated **actions** (goto, addTodo, setFilter, toggle, delete).
 *  - Does NOT contain test assertions — those live in the spec files, so
 *    each test reads top-to-bottom as "do these actions, then assert these
 *    invariants" without hiding what's being verified.
 *  - The `expect()` calls inside `goto()` and `addTodo()` are
 *    synchronization, not test assertions: they guarantee the action's
 *    post-conditions before returning (page loaded; row reconciled to a
 *    server id), so subsequent test steps don't race.
 *
 * Row-scoped locators (TodoRow) match by visible title text, so they
 * survive aria-label changes when a checkbox is toggled.
 */

export type FilterName = "All" | "Active" | "Completed";

const NEW_TODO_LABEL = "New todo";

export class TodoRow {
  readonly title: string;
  readonly root: Locator;
  readonly checkbox: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page, title: string) {
    this.title = title;
    this.root = page.getByRole("listitem").filter({ hasText: title });
    this.checkbox = this.root.getByRole("checkbox");
    this.deleteButton = this.root.getByRole("button", {
      name: `Delete "${title}"`,
      exact: true,
    });
  }

  async toggle(): Promise<void> {
    await this.checkbox.click();
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
  }
}

export class TodoPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newTodoInput: Locator;
  readonly addButton: Locator;
  readonly emptyState: Locator;
  readonly itemsLeft: Locator;
  readonly listItems: Locator;
  readonly clearCompletedButton: Locator;
  readonly retryButton: Locator;
  // Distinct from retryButton because the delete-toast affordance is labelled
  // "Undo" (the spec'd UX), not "Retry". Other toasts still use "Retry".
  readonly undoButton: Locator;
  readonly inputError: Locator;

  constructor(page: Page) {
    this.page = page;
    // Locator hierarchy (Playwright recommendation):
    //   1. getByRole / getByLabel / getByPlaceholder — semantic, user-facing
    //   2. getByTestId — explicit `data-testid` hooks for elements without a
    //      strong semantic identity (or where role+name would be ambiguous,
    //      e.g. multiple aria-live regions on the page)
    //   3. (avoid) page.locator(".class") or attribute selectors
    this.heading = page.getByRole("heading", { name: /todo app/i });
    this.newTodoInput = page.getByLabel(NEW_TODO_LABEL);
    this.addButton = page.getByRole("button", { name: /add todo/i });
    this.emptyState = page.getByTestId("empty-state");
    this.itemsLeft = page.getByTestId("items-left");
    this.listItems = page.getByRole("listitem");
    this.clearCompletedButton = page.getByRole("button", {
      name: /clear completed/i,
    });
    this.retryButton = page.getByRole("button", { name: /retry/i });
    this.undoButton = page.getByRole("button", { name: /undo/i });
    this.inputError = page.getByTestId("input-error");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    // Synchronization: ensure the SPA has rendered before returning. Not a
    // test assertion — tests don't need to re-verify the heading exists.
    await expect(this.heading).toBeVisible();
  }

  /**
   * Type a title, press Enter, and wait for React Query to reconcile the
   * optimistic temp-id row into a server-keyed row. The awaits inside are
   * synchronization (the action's post-conditions), not test assertions.
   */
  async addTodo(title: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/todos") &&
        res.request().method() === "POST" &&
        res.status() === 201
    );
    await this.newTodoInput.fill(title);
    await this.newTodoInput.press("Enter");
    await responsePromise;
    await expect(
      this.page.locator('input[type="checkbox"][id^="cb-temp-"]')
    ).toHaveCount(0);
    await expect(this.page.getByText(title)).toBeVisible();
  }

  row(title: string): TodoRow {
    return new TodoRow(this.page, title);
  }

  filterChip(name: FilterName): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  async setFilter(name: FilterName): Promise<void> {
    await this.filterChip(name).click();
  }
}
