import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("emits checked state changes through a switch control", () => {
    const onChange = vi.fn();

    render(<Toggle aria-label="Local clips" checked={false} onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Local clips" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
