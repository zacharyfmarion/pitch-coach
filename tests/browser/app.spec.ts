import { expect, test } from "@playwright/test";

test("renders the pitch coach workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pitch Coach" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practice Library" })).toBeVisible();
  await page.getByRole("button", { name: /Major Triad/ }).click();
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.getByText("Guide tempo")).toBeVisible();
  await expect(page.getByText("A3 major")).toBeVisible();
});

test("keeps the exercise usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Pitch Coach" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Single Note Match/ })).toBeVisible();
  await page.getByRole("button", { name: /Major Triad/ }).click();
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
});
