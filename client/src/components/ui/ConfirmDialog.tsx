import React from "react";
import Modal from "./Modal";

type Props = {
  readonly open: boolean;
  readonly title?: string;
  readonly message: React.ReactNode;

  readonly confirmText?: string;
  readonly cancelText?: string;

  readonly onConfirm: () => void;
  readonly onCancel: () => void;

  readonly loading?: boolean;
};

export default function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmText = "Yes",
  cancelText = "No",
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Please wait…" : confirmText}
          </button>
        </>
      }
    >
      <div style={{ lineHeight: 1.4 }}>{message}</div>
    </Modal>
  );
}
