import { expect, test } from "@playwright/test";

test("renders the pitch coach workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pitch Coach" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practice Library" })).toBeVisible();
  await page.getByRole("button", { name: /Major Triad/ }).click();
  await expect(page).toHaveURL(/\/exercises\/major-triad$/);
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.getByText("Guide tempo")).toBeVisible();
  await expect(page.getByText("A3 major")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);

  await page.getByRole("combobox", { name: "Exercise" }).click();
  await page.getByRole("option", { name: "Single Note Match" }).click();
  await expect(page).toHaveURL(/\/exercises\/single-note-match$/);
  await expect(page.getByText("72 BPM")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Practice Library" })).toBeVisible();
});

test("opens exercise routes directly", async ({ page }) => {
  await page.goto("/exercises/major-triad");
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.getByText("A3 major")).toBeVisible();
});

test("keeps the exercise usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Pitch Coach" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Single Note Match/ })).toBeVisible();
  await page.getByRole("button", { name: /Major Triad/ }).click();
  await expect(page).toHaveURL(/\/exercises\/major-triad$/);
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
});
