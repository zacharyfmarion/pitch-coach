import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarTabs } from "./SidebarTabs";

describe("SidebarTabs", () => {
  it("uses Radix tabs semantics for navigation choices", () => {
    const onValueChange = vi.fn();

    render(
      <SidebarTabs
        ariaLabel="Primary navigation"
        value="home"
        onValueChange={onValueChange}
        items={[
          { value: "home", label: "Home" },
          { value: "practice", label: "Practice" },
          { value: "sing", label: "Sing" }
        ]}
      />
    );

    const home = screen.getByRole("tab", { name: "Home" });
    expect(home.getAttribute("data-state")).toBe("active");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Practice" }), {
      button: 0,
      ctrlKey: false
    });

    expect(onValueChange).toHaveBeenCalledWith("practice");
  });
});
