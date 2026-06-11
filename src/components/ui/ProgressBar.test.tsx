import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders an accessible Radix progress indicator with clamped values", () => {
    render(<ProgressBar aria-label="Song analysis" value={140} max={100} tone="song" />);

    const progress = screen.getByRole("progressbar", { name: "Song analysis" });
    expect(progress.getAttribute("aria-valuemax")).toBe("100");
    expect(progress.getAttribute("aria-valuenow")).toBe("100");
    expect(progress.className).toContain("ui-progress--song");

    const indicator = progress.querySelector(".ui-progress__indicator") as HTMLElement | null;
    expect(indicator?.style.transform).toBe("translateX(-0%)");
  });
});
