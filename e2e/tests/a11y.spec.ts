import { expect, test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";
import { addTodo, resetServerState } from "./_helpers";

test.beforeEach(async ({ request, page }) => {
  await resetServerState(request);
  await page.addInitScript(() => window.localStorage.clear());
});

// Surface a detailed HTML report on failure; only fail the test on serious or
// critical impacts so cosmetic issues don't block deploys (they still appear
// in the report for follow-up). axe defaults already cover WCAG 2.1 A/AA.
const AXE_OPTS = {
  detailedReport: true,
  detailedReportOptions: { html: true },
  includedImpacts: ["serious", "critical"] as ("serious" | "critical")[],
};

test.describe("Accessibility (axe-core, WCAG 2.1 AA)", () => {
  test("empty state has no serious/critical violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/nothing to do yet/i)).toBeVisible();
    await injectAxe(page);
    await checkA11y(page, undefined, AXE_OPTS);
  });

  test("populated list has no serious/critical violations", async ({
    page,
  }) => {
    await page.goto("/");
    await addTodo(page, "alpha");
    await addTodo(page, "beta");
    await page
      .getByRole("checkbox", { name: /mark "beta" as complete/i })
      .click();
    await injectAxe(page);
    await checkA11y(page, undefined, AXE_OPTS);
  });

  test("active filter view has no serious/critical violations", async ({
    page,
  }) => {
    await page.goto("/");
    await addTodo(page, "alpha");
    await addTodo(page, "beta");
    await page
      .getByRole("checkbox", { name: /mark "beta" as complete/i })
      .click();
    await page.getByRole("button", { name: "Active" }).click();
    await injectAxe(page);
    await checkA11y(page, undefined, AXE_OPTS);
  });

  test("primary flow is keyboard-only operable", async ({ page }) => {
    await page.goto("/");
    // Tab into the input and add a todo with Enter only.
    await page.keyboard.press("Tab"); // input
    await page.keyboard.type("kb only");
    await page.keyboard.press("Enter");
    await expect(page.getByText("kb only")).toBeVisible();

    // Toggle the row's checkbox via keyboard.
    const checkbox = page.getByRole("checkbox", {
      name: /mark "kb only" as complete/i,
    });
    await checkbox.focus();
    await page.keyboard.press(" ");
    await expect(checkbox).toBeChecked();
  });
});
