import { useEffect, useRef } from "react";

type Props = {
  readonly open: boolean;
  readonly title?: string;
  readonly children: React.ReactNode;
  readonly onClose: () => void;
  readonly footer?: React.ReactNode;
};

export default function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} onClose={onClose} className="modal">
      <div className="modal-header">
        <div className="modal-title">{title}</div>
        <button
          className="btn-secondary"
          onClick={onClose}
          aria-label="Close"
          id="btn-action"
        >
          ✕
        </button>
      </div>

      <div className="modal-body">{children}</div>

      {footer && <div className="modal-footer">{footer}</div>}
    </dialog>
  );
}
