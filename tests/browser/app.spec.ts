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
  await expect(page.getByText("Recently practiced")).toBeVisible();
  await expect(page.getByText("0 / 12 done")).toBeVisible();
  await expect(page.getByText("Robin")).toHaveCount(0);

  await page.getByRole("button", { name: /Start practice/ }).click();
  await expect(page).toHaveURL(/\/exercises\/major-triad$/);
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tempo" })).toContainText("80 BPM");
  await expect(page.getByRole("button", { name: "Key" })).toContainText("A major");
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.locator(".exercise-roll-card .note-checkpoint-strip")).toHaveCSS("margin-top", "6px");
  await expect(page.locator(".exercise-roll-card .note-checkpoint-strip")).toHaveCSS("margin-bottom", "8px");
  await expect(page.locator(".exercise-roll-card .timeline-frame")).toHaveCSS("border-top-width", "1px");
  await expect(page.locator(".exercise-roll-card .timeline-frame")).toHaveCSS("border-radius", "16px");
  await expect(page.getByRole("button", { name: "Restart practice" })).toHaveCSS(
    "background-color",
    "rgb(255, 253, 249)"
  );
  await page.getByRole("button", { name: "Tempo" }).click();
  const tempoSettings = page.getByRole("dialog", { name: "Tempo settings" });
  await expect(tempoSettings).toBeVisible();
  const tempoSettingsBox = await tempoSettings.boundingBox();
  expect(tempoSettingsBox?.width).toBeLessThanOrEqual(300);
  await page.mouse.click(10, 10);

  await page.getByRole("combobox", { name: "Exercise" }).click();
  await page.getByRole("option", { name: "Single Note Match" }).click();
  await expect(page).toHaveURL(/\/exercises\/single-note-match$/);
  await expect(page.getByText("80 BPM")).toBeVisible();
  await expect(page.getByLabel("Attempt history")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Good evening" })).toBeVisible();
});

test("opens settings from the footer and applies practice defaults", async ({ page }) => {
  await seedOnboardedSettings(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Local practice.*Settings & profile/ }).click();
  await expect(page.getByRole("dialog", { name: "Voice" })).toBeVisible();

  await page.getByRole("button", { name: /Practice.*Tempo & strictness/ }).click();
  await expect(page.getByRole("dialog", { name: "Practice" })).toBeVisible();
  await expect(page.getByText("Default guide tempo")).toBeVisible();

  await page.getByRole("button", { name: "Slow" }).click();
  await expect(page.getByText("70 BPM")).toBeVisible();
  await page.getByRole("group", { name: "Strictness" }).getByRole("button", { name: "Strict" }).click();
  await expect(page.getByText(/within \+\/-22 cents/)).toBeVisible();

  await page.getByRole("dialog", { name: "Practice" }).getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: /Start practice/ }).click();
  await expect(page).toHaveURL(/\/exercises\/major-triad$/);
  await expect(page.getByText("70 BPM")).toBeVisible();
  await expect(page.getByRole("button", { name: "Strictness" })).toContainText("Strict");
});

test("opens exercise routes directly", async ({ page }) => {
  await seedOnboardedSettings(page);
  await page.goto("/exercises/major-triad");
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.getByRole("button", { name: "Key" })).toContainText("A major");
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

async function expectMobileViewportToFit(page: Page) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function expectMobileNavToMatchMock(page: Page) {
  const metrics = await page.evaluate(() => {
    const nav = document.querySelector(".pc-app-shell__mobile-nav");
    const list = document.querySelector(".bottom-nav__list");
    const triggers = [...document.querySelectorAll(".bottom-nav__trigger")];
    const activeTrigger = document.querySelector(".bottom-nav__trigger[data-state='active']");
    const firstLabel = document.querySelector(".bottom-nav__label");
    if (!nav || !list || triggers.length === 0 || !activeTrigger || !firstLabel) {
      return null;
    }

    const navBox = nav.getBoundingClientRect();
    const triggerBoxes = triggers.map((trigger) => trigger.getBoundingClientRect());
    const activeStyles = window.getComputedStyle(activeTrigger);
    const labelStyles = window.getComputedStyle(firstLabel);

    return {
      activeBackground: activeStyles.backgroundColor,
      labelFontSize: labelStyles.fontSize,
      listClientWidth: list.clientWidth,
      listScrollWidth: list.scrollWidth,
      navLeft: navBox.left,
      navRight: navBox.right,
      triggerCount: triggers.length,
      triggerWidths: triggerBoxes.map((box) => box.width),
      viewportWidth: window.innerWidth
    };
  });

  expect(metrics).not.toBeNull();
  if (!metrics) {
    throw new Error("Expected mobile navigation metrics");
  }

  expect(metrics.triggerCount).toBe(4);
  expect(metrics.listScrollWidth).toBeLessThanOrEqual(metrics.listClientWidth + 1);
  expect(metrics.navLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.navRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.activeBackground).toBe("rgba(0, 0, 0, 0)");
  expect(metrics.labelFontSize).toBe("10.5px");
  metrics.triggerWidths.forEach((width) => {
    expect(width).toBeLessThanOrEqual(metrics.viewportWidth / 4 + 1);
  });
}

async function expectMobileHomeToMatchMock(page: Page) {
  await expect(page.locator(".mobile-home")).toBeVisible();
  await expect(page.locator(".mock-home")).toHaveCount(0);
  await expect(page.locator(".mock-week-streak")).toHaveCount(0);
  await expect(page.locator(".mobile-streak-chip")).toBeVisible();
  await expect(page.locator(".mobile-resume-card .mock-pitch-preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practice modes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(page.locator(".mobile-mode-card")).toHaveCount(2);
  await expect(page.locator(".mobile-stat-card")).toHaveCount(4);

  const metrics = await page.evaluate(() => {
    const home = document.querySelector(".mobile-home");
    const header = document.querySelector(".mobile-home__header");
    const resume = document.querySelector(".mobile-resume-card");
    const preview = document.querySelector(".mobile-resume-card .mock-pitch-preview");
    const modeList = document.querySelector(".mobile-mode-list");
    const modeCards = [...document.querySelectorAll(".mobile-mode-card")];
    const statGrid = document.querySelector(".mobile-stat-grid");
    const statCards = [...document.querySelectorAll(".mobile-stat-card")];
    if (!home || !header || !resume || !preview || !modeList || !statGrid) {
      return null;
    }

    const homeBox = home.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    const resumeBox = resume.getBoundingClientRect();
    const previewBox = preview.getBoundingClientRect();
    const modeListStyles = window.getComputedStyle(modeList);
    const statGridStyles = window.getComputedStyle(statGrid);
    const statCardBoxes = statCards.map((card) => card.getBoundingClientRect());

    return {
      headerAboveResume: headerBox.bottom < resumeBox.top,
      modeCardCount: modeCards.length,
      modeDirection: modeListStyles.flexDirection,
      previewHeight: previewBox.height,
      resumeWidth: resumeBox.width,
      statCardCount: statCards.length,
      statColumnCount: statGridStyles.gridTemplateColumns.split(" ").filter(Boolean).length,
      statWidths: statCardBoxes.map((box) => box.width),
      viewportWidth: window.innerWidth,
      width: homeBox.width
    };
  });

  expect(metrics).not.toBeNull();
  if (!metrics) {
    throw new Error("Expected mobile home metrics");
  }

  expect(metrics.headerAboveResume).toBe(true);
  expect(metrics.previewHeight).toBeGreaterThanOrEqual(90);
  expect(metrics.previewHeight).toBeLessThanOrEqual(104);
  expect(metrics.resumeWidth).toBeLessThanOrEqual(metrics.viewportWidth - 32);
  expect(metrics.modeDirection).toBe("column");
  expect(metrics.modeCardCount).toBe(2);
  expect(metrics.statColumnCount).toBe(2);
  expect(metrics.statCardCount).toBe(4);
  metrics.statWidths.forEach((width) => {
    expect(width).toBeLessThanOrEqual(metrics.width / 2);
  });
}

async function expectMobileExerciseToMatchLatestMock(page: Page) {
  await expect(page.locator(".mobile-exercise-screen")).toBeVisible();
  await expect(page.locator(".exercise-screen")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
  await expect(page.locator(".mobile-exercise-header")).toBeVisible();
  await expect(page.getByRole("group", { name: "Practice mode" })).toBeVisible();
  await expect(page.locator(".mobile-exercise-coach")).toBeVisible();
  await expect(page.locator(".mobile-exercise-roll-card")).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expect(page.locator(".mobile-exercise-dock-chip")).toHaveCount(3);

  const metrics = await page.evaluate(() => {
    const screen = document.querySelector(".mobile-exercise-screen");
    const header = document.querySelector(".mobile-exercise-header");
    const mode = document.querySelector(".mobile-exercise-mode-segment");
    const coach = document.querySelector(".mobile-exercise-coach");
    const roll = document.querySelector(".mobile-exercise-roll-card");
    const timeline = document.querySelector(".mobile-exercise-roll-card .timeline-frame");
    const action = document.querySelector(".mobile-exercise-action");
    const dock = document.querySelector(".mobile-exercise-dock");
    if (!screen || !header || !mode || !coach || !roll || !timeline || !action || !dock) {
      return null;
    }

    const screenBox = screen.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    const modeBox = mode.getBoundingClientRect();
    const coachBox = coach.getBoundingClientRect();
    const rollBox = roll.getBoundingClientRect();
    const timelineBox = timeline.getBoundingClientRect();
    const actionBox = action.getBoundingClientRect();
    const dockBox = dock.getBoundingClientRect();

    return {
      actionAfterRoll: actionBox.top >= rollBox.bottom - 1,
      bodyScrollWidth: document.body.scrollWidth,
      coachAfterMode: coachBox.top >= modeBox.bottom - 1,
      dockBottom: dockBox.bottom,
      dockWidth: dockBox.width,
      headerAboveMode: headerBox.bottom <= modeBox.top + 1,
      rollAfterCoach: rollBox.top >= coachBox.bottom - 1,
      rollHeight: rollBox.height,
      screenWidth: screenBox.width,
      timelineHeight: timelineBox.height,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });

  expect(metrics).not.toBeNull();
  if (!metrics) {
    throw new Error("Expected mobile exercise metrics");
  }

  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.screenWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.headerAboveMode).toBe(true);
  expect(metrics.coachAfterMode).toBe(true);
  expect(metrics.rollAfterCoach).toBe(true);
  expect(metrics.actionAfterRoll).toBe(true);
  expect(metrics.rollHeight).toBeGreaterThanOrEqual(220);
  expect(metrics.timelineHeight).toBeGreaterThanOrEqual(130);
  expect(metrics.dockWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.dockBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
}

async function expectMobileExerciseSheetToAnimate(page: Page, name: string) {
  const sheet = page.locator(".mobile-exercise-sheet");
  await expect(page.getByRole("dialog", { name })).toBeVisible();
  await expect(sheet).toHaveAttribute("data-state", "open");

  const openAnimationNames = await sheet.evaluate((element) => {
    const panel = element.querySelector(".mobile-exercise-sheet__panel");
    const backdrop = element.querySelector(".mobile-exercise-sheet__backdrop");
    return {
      backdrop: backdrop ? window.getComputedStyle(backdrop).animationName : "",
      panel: panel ? window.getComputedStyle(panel).animationName : ""
    };
  });
  expect(openAnimationNames.panel).toContain("mobileExerciseSheetIn");
  expect(openAnimationNames.backdrop).toContain("mobileExerciseBackdropIn");

  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(sheet).toHaveAttribute("data-state", "closed");

  const closedAnimationNames = await sheet.evaluate((element) => {
    const panel = element.querySelector(".mobile-exercise-sheet__panel");
    const backdrop = element.querySelector(".mobile-exercise-sheet__backdrop");
    return {
      backdrop: backdrop ? window.getComputedStyle(backdrop).animationName : "",
      panel: panel ? window.getComputedStyle(panel).animationName : ""
    };
  });
  expect(closedAnimationNames.panel).toContain("mobileExerciseSheetOut");
  expect(closedAnimationNames.backdrop).toContain("mobileExerciseBackdropOut");
  await expect(sheet).toHaveCount(0);
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
  await expect(page.getByText(/1 \/ 12 exercises tried/)).toBeVisible();
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

  await expectMobileViewportToFit(page);
  await expectMobileHomeToMatchMock(page);
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Good evening" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start practice/ })).toBeVisible();
  await page.getByRole("button", { name: /Start practice/ }).click();
  await expect(page).toHaveURL(/\/exercises\/major-triad$/);
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
  await expectMobileExerciseToMatchLatestMock(page);
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByLabel("Pitch timeline")).toBeVisible();
  await expectMobileViewportToFit(page);
});

test("uses the latest mobile exercise screen components", async ({ page }) => {
  await seedOnboardedSettings(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/exercises/major-triad");

  await expectMobileExerciseToMatchLatestMock(page);
  await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();

  await page.locator(".mobile-exercise-dock-chip", { hasText: "Strictness" }).click();
  await expect(page.getByRole("button", { name: "Gentle ±50¢" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Standard ±35¢" })).toBeVisible();
  await expectMobileExerciseSheetToAnimate(page, "Strictness");

  await page.locator(".mobile-exercise-dock-chip", { hasText: "Tempo" }).click();
  await expect(page.getByRole("slider", { name: "Guide tempo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Medium 90 BPM" })).toBeVisible();
  await expectMobileExerciseSheetToAnimate(page, "Guide tempo");

  await page.locator(".mobile-exercise-dock-chip", { hasText: "Key" }).click();
  await expect(page.getByRole("button", { name: "Lower key" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Raise key" })).toBeVisible();
  await expectMobileExerciseSheetToAnimate(page, "Key & range");
  await expectMobileViewportToFit(page);
});

test("uses the mock mobile home components", async ({ page }) => {
  await seedOnboardedSettings(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectMobileHomeToMatchMock(page);
  await expect(page.getByText("Start with one short drill today.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Interval Training 12 drills · 0 of 12 tried" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sing a Song Upload a track, sing the real vocal" })).toBeVisible();
  await expectMobileViewportToFit(page);
});

test("uses bottom navigation across mobile top-level routes", async ({ page }) => {
  await seedOnboardedSettings(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNav).toBeVisible();
  await expect(page.locator(".pc-app-shell__sidebar")).toBeHidden();
  await expect(mobileNav.getByRole("tab", { name: "Home" })).toHaveAttribute("data-state", "active");
  await expectMobileHomeToMatchMock(page);
  await expectMobileNavToMatchMock(page);
  await expectMobileViewportToFit(page);

  await mobileNav.getByRole("tab", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("heading", { name: "Practice Library", level: 1 })).toBeVisible();
  await expect(mobileNav.getByRole("tab", { name: "Practice" })).toHaveAttribute("data-state", "active");
  await expectMobileNavToMatchMock(page);
  await expectMobileViewportToFit(page);

  await mobileNav.getByRole("tab", { name: "Sing" }).click();
  await expect(page).toHaveURL(/\/songs$/);
  await expect(page.getByRole("heading", { name: "Sing a Song" })).toBeVisible();
  await expect(mobileNav.getByRole("tab", { name: "Sing" })).toHaveAttribute("data-state", "active");
  await expectMobileNavToMatchMock(page);
  await expectMobileViewportToFit(page);

  await mobileNav.getByRole("tab", { name: "Progress" }).click();
  await expect(page).toHaveURL(/\/progress$/);
  await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible();
  await expect(mobileNav.getByRole("tab", { name: "Progress" })).toHaveAttribute("data-state", "active");
  await expectMobileNavToMatchMock(page);
  await expectMobileViewportToFit(page);
});

test("keeps the mobile range prompt above bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const prompt = page.getByRole("status", { name: "Default vocal range" });
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(prompt).toBeVisible();
  await expect(mobileNav).toBeVisible();

  const bounds = await page.evaluate(() => {
    const promptBox = document.querySelector(".range-setup-toast")?.getBoundingClientRect();
    const navBox = document.querySelector(".pc-app-shell__mobile-nav")?.getBoundingClientRect();
    if (!promptBox || !navBox) {
      return null;
    }
    return {
      navBottom: navBox.bottom,
      navTop: navBox.top,
      promptBottom: promptBox.bottom,
      promptWidth: promptBox.width,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });
  expect(bounds).not.toBeNull();
  if (!bounds) {
    throw new Error("Expected mobile prompt and navigation bounds");
  }
  expect(bounds.promptBottom).toBeLessThanOrEqual(bounds.navTop);
  expect(bounds.promptWidth).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.viewportHeight - bounds.navBottom).toBeLessThanOrEqual(1);
  await expectMobileViewportToFit(page);
});

test("keeps settings reachable on a mobile viewport", async ({ page }) => {
  await seedOnboardedSettings(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".pitch-shell .sidebar-nav__footer")).toBeHidden();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Voice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-test by singing" })).toBeVisible();
});

test("uses the mock theme without exposing theme choices", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-name", "Pitch Coach Warm");
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toHaveCount(0);
});

test("omits lower detail panels on the exercise mock", async ({ page }) => {
  await seedOnboardedSettings(page);
  await page.goto("/");
  await seedAttemptHistory(page, [browserAttemptRecord()]);
  await page.goto("/exercises/major-triad");

  await expect(page.getByLabel("Lesson controls and feedback")).toHaveCount(0);
  await expect(page.getByLabel("Attempt feedback")).toHaveCount(0);
  await expect(page.getByLabel("Attempt history")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear history" })).toHaveCount(0);
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
        defaultTempoBpm: 80,
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
