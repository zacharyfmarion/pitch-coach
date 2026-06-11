import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("opens a Radix alert dialog and confirms the action", async () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        trigger={<Button>Clear history</Button>}
        title="Clear local history?"
        description="This removes practice attempts saved on this device."
        confirmLabel="Clear"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("This removes practice attempts saved on this device.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
