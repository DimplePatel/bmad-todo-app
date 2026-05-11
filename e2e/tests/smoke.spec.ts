import { expect, test } from "./_fixtures";

test("smoke: app loads and health endpoint responds", async ({
  todoPage,
  request,
}) => {
  await expect(todoPage.heading).toBeVisible();

  const health = await request.get(
    `${process.env.BACKEND_URL ?? "http://localhost:3001"}/api/health`
  );
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
});
