import { checkA11y, injectAxe } from "axe-playwright";
import { expect, test } from "./_fixtures";

// Closes NFR3 (PRD §2.2) and the Verification step of Story E4.S1.
// For each viewport, the test:
//   1. Resizes the page.
//   2. Adds a todo (covers the populated-list layout, which is wider than
//      the empty state and the more interesting case for horizontal scroll).
//   3. Asserts the page has no horizontal overflow (`scrollWidth <= clientWidth`).
//   4. Runs an axe scan at the new viewport — catches issues that only
//      appear at narrow widths (touch targets, contrast in wrapped layouts).
//
// CSS media queries re-evaluate on setViewportSize() without a reload, so we
// don't navigate again between sizes.

const AXE_OPTS = {
  detailedReport: true,
  detailedReportOptions: { html: true },
  includedImpacts: ["serious", "critical"] as ("serious" | "critical")[],
};

const VIEWPORTS = [
  { label: "mobile-narrow", width: 320, height: 640 },
  { label: "mobile", width: 375, height: 812 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "desktop", width: 1280, height: 800 },
  { label: "wide", width: 1920, height: 1080 },
] as const;

test.describe("Responsive layout (NFR3, Story E4.S1)", () => {
  for (const v of VIEWPORTS) {
    test(`${v.label} (${v.width}×${v.height}): no horizontal scroll + axe-clean`, async ({
      todoPage,
      page,
    }) => {
      await page.setViewportSize({ width: v.width, height: v.height });

      // Populated state — wider rows, completion strikethrough, footer
      // counter all visible. This is the layout most likely to overflow at
      // 320 px if any element forgot to use a flexible width.
      await todoPage.addTodo("responsive scan");
      await todoPage.row("responsive scan").toggle();

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth;
      });
      expect(
        overflow,
        `Horizontal scroll detected at ${v.width}×${v.height} — something isn't using a flexible width.`
      ).toBe(false);

      await injectAxe(page);
      await checkA11y(page, undefined, AXE_OPTS);
    });
  }
});
