import { expect, test } from "@playwright/test";

test("queues a generation job and displays generated content", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Content generation jobs" })).toBeVisible();

  await page.getByLabel("Topic").fill("AI onboarding for customer success teams");
  await page.getByLabel("Audience").fill("B2B SaaS founders");
  await page.getByLabel("Tone").selectOption("friendly");
  await page.getByLabel("Platform").selectOption("newsletter");
  await page.getByRole("button", { name: "Queue job" }).click();

  await expect(page.getByText(/Job queued:/)).toBeVisible();
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Generated content" })).toBeVisible();
  await expect(page.getByText("Validated structured output")).toBeVisible();

  await page.getByRole("link", { name: "Details" }).first().click();
  await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "AI onboarding for customer success teams" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Execution events" })).toBeVisible();
});
