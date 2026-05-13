import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dropdown } from "./Dropdown";

describe("Dropdown", () => {
  it("selects an option through a Radix combobox trigger", async () => {
    const onValueChange = vi.fn();

    render(
      <Dropdown
        ariaLabel="Exercise"
        value="single-note-match"
        options={[
          { value: "single-note-match", label: "Single Note Match" },
          { value: "major-triad", label: "Major Triad" }
        ]}
        onValueChange={onValueChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Exercise" });
    expect(trigger.tagName).toBe("BUTTON");

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1, pointerType: "mouse" });
    const option = await screen.findByRole("option", { name: "Major Triad" });
    fireEvent.click(option);

    expect(onValueChange).toHaveBeenCalledWith("major-triad");
  });
});
