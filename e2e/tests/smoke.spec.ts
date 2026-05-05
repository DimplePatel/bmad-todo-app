import { expect, test } from "@playwright/test";

test("smoke: app loads and health endpoint responds", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /todo app/i })
  ).toBeVisible();

  const health = await request.get(
    `${process.env.BACKEND_URL ?? "http://localhost:3001"}/api/health`
  );
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
});
