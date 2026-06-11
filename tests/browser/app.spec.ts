import { expect, test } from "@playwright/test";

test("renders the pitch coach workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good evening" })).toBeVisible();
  await expect(page.getByText("Your local practice stats will build as you sing.")).toBeVisible();
  await expect(page.locator(".shell-user-copy").getByText("Local practice")).toBeVisible();
  await expect(page.getByRole("button", { name: /Start practice/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Interval Training/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sing a Song/ })).toBeVisible();
  await expect(page.getByText("0 attempts logged")).toBeVisible();
  await expect(page.getByText("Robin")).toHaveCount(0);

  await page.getByRole("button", { name: /Start practice/ }).click();
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
  await expect(page.getByRole("heading", { name: "Good evening" })).toBeVisible();
});

test("opens exercise routes directly", async ({ page }) => {
  await page.goto("/exercises/major-triad");
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.getByText("A3 major")).toBeVisible();
});

test("navigates the shell and renders progress from local history", async ({ page }) => {
  await page.goto("/");
  await seedAttemptHistory(page, [browserAttemptRecord()]);

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent sessions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accuracy over time" })).toBeVisible();
  await expect(page.getByText("Exercises done")).toBeVisible();
  await expect(page.getByText("Major Triad")).toBeVisible();
  await expect(page.getByText(/Triads & Chords/)).toBeVisible();
  const recentSessionLink = page.locator('.progress-session-link[href="/exercises/major-triad"]');
  await expect(recentSessionLink).toHaveCount(1);
  await expect(recentSessionLink).toContainText("100%");
  await recentSessionLink.click();
  await expect(page).toHaveURL(/\/exercises\/major-triad$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/progress$/);

  await page.getByRole("tab", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("heading", { name: "Practice Library", level: 1 })).toBeVisible();
  await expect(page.getByText(/1 \/ 12 exercises tried/)).toBeVisible();
});

test("groups repeated exercise attempts into one recent progress session", async ({ page }) => {
  await page.goto("/");
  await seedAttemptHistory(page, [
    browserAttemptRecord({
      id: "step-up-back-1",
      sessionId: "step-up-back-session",
      exerciseId: "step-up-back",
      createdAt: new Date(Date.UTC(2026, 5, 11, 22, 6, 0)).toISOString(),
      passed: true,
      status: "pass"
    }),
    browserAttemptRecord({
      id: "step-up-back-2",
      sessionId: "step-up-back-session",
      exerciseId: "step-up-back",
      createdAt: new Date(Date.UTC(2026, 5, 11, 22, 6, 10)).toISOString(),
      passed: true,
      status: "pass"
    }),
    browserAttemptRecord({
      id: "step-up-back-3",
      sessionId: "step-up-back-session",
      exerciseId: "step-up-back",
      createdAt: new Date(Date.UTC(2026, 5, 11, 22, 6, 20)).toISOString(),
      passed: false,
      status: "flat"
    })
  ]);

  await page.goto("/progress");

  const stepSessionLink = page.locator('.progress-session-link[href="/exercises/step-up-back"]');
  await expect(stepSessionLink).toHaveCount(1);
  await expect(stepSessionLink).toContainText("Step Up and Back");
  await expect(stepSessionLink).toContainText("3 attempts");
  await expect(stepSessionLink).toContainText("67%");
});

test("opens song mode directly without starting model download on unsupported browsers", async ({ page }) => {
  const requests: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      value: undefined,
      configurable: true
    });
  });
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/songs");

  await expect(page.getByRole("tab", { name: "Sing" })).toHaveAttribute("data-state", "active");
  await expect(page.getByRole("heading", { name: "Sing a Song" })).toBeVisible();
  await expect(page.getByText("Drop a song here")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a file" })).toBeVisible();
  await expect(page.getByText(/How it works/i)).toBeVisible();
  await expect(page.getByLabel("Song pitch timeline")).toHaveCount(0);
  await expect(page.getByText(/Song mode needs WebGPU/i)).toHaveCount(0);
  expect(requests.some((url) => url.includes("htdemucs_embedded.onnx"))).toBe(false);
});

test("keeps the exercise usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Good evening" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start practice/ })).toBeVisible();
  await page.getByRole("button", { name: /Start practice/ }).click();
  await expect(page).toHaveURL(/\/exercises\/major-triad$/);
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
});

test("uses the mock theme without exposing theme choices", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-name", "Pitch Coach Warm");
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toHaveCount(0);
});

test("shows and clears local attempt history", async ({ page }) => {
  await page.goto("/");
  await seedAttemptHistory(page, [browserAttemptRecord()]);
  await page.goto("/exercises/major-triad");

  await expect(page.getByLabel("Attempt history")).toContainText("Pass");
  await expect(page.getByLabel("Attempt history")).toContainText("Nice triad.");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear history" }).click();

  await expect(page.getByLabel("Attempt history")).toContainText("No attempts yet for this exercise.");
});

type BrowserAttemptSeed = {
  id: string;
  sessionId: string;
  exerciseId: string;
  createdAt: string;
  rootMidi: number;
  tempoBpm: number;
  toleranceCents: number;
  passed: boolean;
  summary: string;
  durationMs: number;
  segments: Array<{
    id: string;
    kind: "note";
    label: string;
    shortLabel: string;
    noteName: string;
    midi: number;
    offsetSemitones: number;
    status: string;
    medianCents: number;
    warnings: string[];
  }>;
};

async function seedAttemptHistory(page: import("@playwright/test").Page, records: BrowserAttemptSeed[]) {
  await page.evaluate(
    (attempts) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("pitch-coach-attempt-history", 2);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("attempts")) {
            request.result.createObjectStore("attempts", { keyPath: "id" });
          }
          if (!request.result.objectStoreNames.contains("sessions")) {
            request.result.createObjectStore("sessions", { keyPath: "id" });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(["attempts", "sessions"], "readwrite");
          const attemptStore = transaction.objectStore("attempts");
          const sessionStore = transaction.objectStore("sessions");
          const attemptsBySession = new Map<string, BrowserAttemptSeed[]>();

          attempts.forEach((record) => {
            attemptStore.put(record);
            attemptsBySession.set(record.sessionId, [
              ...(attemptsBySession.get(record.sessionId) ?? []),
              record
            ]);
          });
          attemptsBySession.forEach((sessionAttempts, sessionId) => {
            const sortedAttempts = [...sessionAttempts].sort(
              (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
            );
            const firstAttempt = sortedAttempts[0]!;
            const lastAttempt = sortedAttempts.at(-1)!;
            sessionStore.put({
              id: sessionId,
              exerciseId: firstAttempt.exerciseId,
              startedAt: firstAttempt.createdAt,
              lastAttemptAt: lastAttempt.createdAt
            });
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    records
  );
}

function browserAttemptRecord(
  overrides: Partial<{
    id: string;
    sessionId: string;
    exerciseId: string;
    createdAt: string;
    passed: boolean;
    status: string;
  }> = {}
): BrowserAttemptSeed {
  const exerciseId = overrides.exerciseId ?? "major-triad";
  const passed = overrides.passed ?? true;
  const status = overrides.status ?? (passed ? "pass" : "flat");
  return {
    id: overrides.id ?? `${exerciseId}-browser-seed`,
    sessionId: overrides.sessionId ?? `${exerciseId}-browser-session`,
    exerciseId,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    rootMidi: 57,
    tempoBpm: 80,
    toleranceCents: 35,
    passed,
    summary: passed ? "Nice triad." : "A3 was flat.",
    durationMs: 2400,
    segments: [
      {
        id: "root",
        kind: "note",
        label: "Root",
        shortLabel: "R",
        noteName: "A3",
        midi: 57,
        offsetSemitones: 0,
        status,
        medianCents: status === "flat" ? -42 : 0,
        warnings: []
      }
    ]
  };
}
