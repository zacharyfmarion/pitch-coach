import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";
import { Card, CardDescription, CardHeader, CardTitle } from "./Card";
import { Chip } from "./Chip";
import { StatCard } from "./StatCard";
import { StatusPill } from "./StatusPill";

describe("design primitives", () => {
  it("composes card and chip classes from typed variants", () => {
    render(
      <Card variant="interactive" tone="accent" padding="lg">
        <CardHeader>
          <CardTitle>Major Third</CardTitle>
          <CardDescription>Lock in the landing.</CardDescription>
        </CardHeader>
        <Chip tone="success">Ready</Chip>
      </Card>
    );

    const card = screen.getByText("Major Third").closest(".ui-card");
    expect(card?.className).toContain("ui-card--interactive");
    expect(card?.className).toContain("ui-card--accent");
    expect(screen.getByText("Ready").className).toContain("ui-chip--success");
  });

  it("marks active status as polite live feedback", () => {
    render(<StatusPill tone="active" pulse>Listening</StatusPill>);

    const pill = screen.getByText("Listening").closest(".ui-status-pill");
    expect(pill?.getAttribute("aria-live")).toBe("polite");
    expect(pill?.className).toContain("ui-status-pill--pulse");
  });

  it("provides shell and stat card layout primitives", () => {
    render(
      <AppShell sidebar={<span>Navigation</span>} header={<span>Header</span>}>
        <StatCard label="Accuracy" value={87} unit="%" detail="Last 10 sessions" />
      </AppShell>
    );

    expect(screen.getByText("Navigation").closest(".pc-app-shell__sidebar")).toBeTruthy();
    expect(screen.getByText("Header").closest(".pc-app-shell__header")).toBeTruthy();
    expect(screen.getByText("Accuracy").closest(".stat-card")).toBeTruthy();
  });
});
