import { expect, test } from "@playwright/test";

test("renders the pitch coach workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pitch Coach" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practice Library" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Major Triad/ })).toContainText("No attempts yet");
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
  await expect(page.getByLabel("Attempt history")).toContainText("No attempts yet for this exercise.");

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

test("shows and clears local attempt history", async ({ page }) => {
  await page.goto("/");
  await seedAttemptHistory(page);
  await page.goto("/exercises/major-triad");

  await expect(page.getByLabel("Attempt history")).toContainText("Pass");
  await expect(page.getByLabel("Attempt history")).toContainText("Nice triad.");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear history" }).click();

  await expect(page.getByLabel("Attempt history")).toContainText("No attempts yet for this exercise.");
});

async function seedAttemptHistory(page: import("@playwright/test").Page) {
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("pitch-coach-attempt-history", 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("attempts")) {
            request.result.createObjectStore("attempts", { keyPath: "id" });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("attempts", "readwrite");
          transaction.objectStore("attempts").put(record);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    {
      id: "major-triad-browser-seed",
      exerciseId: "major-triad",
      createdAt: new Date().toISOString(),
      rootMidi: 57,
      tempoBpm: 80,
      toleranceCents: 35,
      passed: true,
      summary: "Nice triad.",
      durationMs: 2400,
      notes: [
        {
          degree: 1,
          label: "A3",
          midi: 57,
          status: "pass",
          medianCents: 0,
          warnings: []
        }
      ]
    }
  );
}
