import { expect, test, type Page } from "@playwright/test";

test("renders the pitch coach workspace", async ({ page }) => {
  await seedOnboardedSettings(page);
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
  await seedOnboardedSettings(page);
  await page.goto("/exercises/major-triad");
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.getByText("A3 major")).toBeVisible();
});

test("shows range setup from Start lesson without a detail-page prompt", async ({ page }) => {
  await page.goto("/exercises/major-triad");

  await expect(page.getByRole("status", { name: "Default vocal range" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Set your vocal range" })).toHaveCount(0);

  await page.getByRole("button", { name: "Start lesson" }).click();
  await expect(page.getByRole("dialog", { name: "Set your vocal range" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Range keyboard from C3 to C5" })).toBeVisible();

  await page.getByRole("button", { name: "Bass" }).click();
  await expect(page.getByRole("img", { name: "Range keyboard from E2 to E4" })).toBeVisible();

  await page.getByRole("button", { name: "Save range" }).click();
  await expect(page.getByRole("dialog", { name: "Range saved" })).toBeVisible();
  await expect(page.getByText(/between E2 and E4/)).toBeVisible();
});

test("shows the compact default range prompt on home while range is unset", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Good evening" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Set your vocal range" })).toHaveCount(0);

  const prompt = await expectBottomFloatingDefaultRangePrompt(page);

  await prompt.getByRole("button", { name: "Set my range" }).click();
  await expect(page.getByRole("dialog", { name: "Set your vocal range" })).toBeVisible();
});

test("shows the compact default range prompt on the practice list while range is unset", async ({ page }) => {
  await page.goto("/practice");

  await expect(page.getByRole("heading", { name: "Practice Library" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Set your vocal range" })).toHaveCount(0);

  const prompt = await expectBottomFloatingDefaultRangePrompt(page);

  await prompt.getByRole("button", { name: "Set my range" }).click();
  await expect(page.getByRole("dialog", { name: "Set your vocal range" })).toBeVisible();
});

async function expectBottomFloatingDefaultRangePrompt(page: Page) {
  const prompt = page.getByRole("status", { name: "Default vocal range" });
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText("Using a default range");
  await expect(prompt).toContainText("C3");
  await expect(prompt).toContainText("C5");
  await expect(prompt.getByRole("button", { name: "Set my range" })).toBeVisible();
  await expect(page.locator(".range-prompt-floating")).toHaveCount(1);

  const box = await page.locator(".range-setup-toast").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    throw new Error("Expected default range prompt bounds");
  }
  expect(box.width).toBeLessThanOrEqual(560);
  expect(box.height).toBeLessThanOrEqual(70);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) {
    throw new Error("Expected viewport dimensions");
  }
  expect(box.y).toBeGreaterThan(viewport.height * 0.7);
  expect(viewport.height - (box.y + box.height)).toBeLessThanOrEqual(40);

  return prompt;
}

test("navigates the shell and renders progress from local history", async ({ page }) => {
  await seedOnboardedSettings(page);
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
  await expect(page.getByText(/1 \/ 8 exercises tried/)).toBeVisible();
});

test("groups repeated exercise attempts into one recent progress session", async ({ page }) => {
  await seedOnboardedSettings(page);
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
  await seedOnboardedSettings(page);
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
  await seedOnboardedSettings(page);
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
  notes: Array<{
    degree: number;
    label: string;
    midi: number;
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

async function seedOnboardedSettings(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "pitch-coach-settings-v1",
      JSON.stringify({
        range: {
          lowestMidi: 48,
          highestMidi: 72
        },
        rangeSetup: {
          status: "completed",
          source: "manual",
          completedAt: "2026-06-11T20:00:00.000Z"
        },
        tempoBpm: 80,
        toleranceCents: 35,
        exerciseId: "major-triad",
        saveLocalClips: false,
        timingMode: "pitch-first",
        themePreference: {
          mode: "system"
        }
      })
    );
  });
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
    notes: [
      {
        degree: 1,
        label: "A3",
        midi: 57,
        status,
        medianCents: status === "flat" ? -42 : 0,
        warnings: []
      }
    ]
  };
}
