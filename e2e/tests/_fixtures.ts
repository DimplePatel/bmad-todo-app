import { test as base, expect } from "@playwright/test";
import { TodoPage } from "../pages/TodoPage";
import { resetServerState } from "./_helpers";

type Fixtures = {
  todoPage: TodoPage;
};

/**
 * Extended test() that auto-provides a fresh TodoPage on a clean backend.
 *
 * Tests that need to set up page.route() *before* the initial navigation
 * should use the base test() from @playwright/test directly — todoPage's
 * setup calls page.goto("/") before the test body runs. The existing
 * error-rollback test intercepts the *POST* (which happens later), so the
 * todoPage fixture works for it.
 */
export const test = base.extend<Fixtures>({
  todoPage: async ({ page, request }, use) => {
    await resetServerState(request);
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await use(todoPage);
  },
});

export { expect };
