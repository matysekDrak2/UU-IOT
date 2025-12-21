import React, { useEffect, useId, useState } from "react";
import Modal from "../ui/Modal";

type Payload = {
  name: string;
  note?: string;
};

type Props = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: Payload) => Promise<void> | void;
  readonly initialName?: string;
};

export default function PotCreateDialog({
  open,
  onClose,
  onSubmit,
  initialName = "",
}: Props) {
  const nameId = useId();
  const noteId = useId();

  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setNote("");
    setError(null);
    setSubmitting(false);
  }, [open, initialName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: trimmed,
        note: note.trim() ? note.trim() : undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create pot");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Create new pot"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            form="pot-create-form"
            disabled={submitting || !name.trim()}
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          <div className="alert-title">Error</div>
          <div>{error}</div>
        </div>
      )}

      <form
        id="pot-create-form"
        onSubmit={handleSubmit}
        className="create_form"
      >
        <div className="field">
          <label htmlFor={nameId} className="field-label">
            Name:
          </label>
          <input
            id={nameId}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Basil"
            autoFocus
            disabled={submitting}
          />
        </div>

        <div className="field">
          <label htmlFor={noteId} className="field-label">
            Note (optional):
          </label>
          <input
            id={noteId}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Kitchen window"
            disabled={submitting}
          />
        </div>
      </form>
    </Modal>
  );
}
