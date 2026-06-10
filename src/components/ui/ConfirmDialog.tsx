import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function ConfirmDialog({
  trigger,
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel,
  onConfirm,
  tone = "danger"
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: "danger" | "accent";
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="alert-dialog__overlay" />
        <AlertDialog.Content className="alert-dialog__content">
          <AlertDialog.Title className="alert-dialog__title">{title}</AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="alert-dialog__description">
              {description}
            </AlertDialog.Description>
          ) : null}
          <div className="alert-dialog__actions">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" size="md">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={tone === "danger" ? "danger" : "primary"}
                size="md"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
