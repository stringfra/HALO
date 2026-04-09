"use client";

import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmingLabel?: string;
  confirmTone?: "danger" | "primary";
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  confirmingLabel = "Eliminazione...",
  confirmTone = "danger",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const canUseDom = typeof window !== "undefined" && typeof document !== "undefined";
  if (!open || !canUseDom) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-base font-semibold">
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">{description}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="halo-btn-secondary px-4 py-2 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`${confirmTone === "primary" ? "halo-btn-primary" : "halo-btn-danger"} px-4 py-2 text-sm`}
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
