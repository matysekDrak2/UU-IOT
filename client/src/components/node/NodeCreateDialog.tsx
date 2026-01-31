import React, { useEffect, useId, useMemo, useState } from "react";
import Modal from "../ui/Modal";

type DurationUnit = "minutes" | "hours" | "days";

function toIsoDuration(value: number, unit: DurationUnit): string {
  const v = Math.floor(value);
  if (!Number.isFinite(v) || v <= 0) return "";

  switch (unit) {
    case "minutes":
      return `PT${v}M`;
    case "hours":
      return `PT${v}H`;
    case "days":
      return `P${v}D`;
  }
}

type Payload = {
  name: string;
  note?: string;
  dataArchiving: string; // ISO 8601 duration (e.g. P30D)
  status: "active" | "inactive";
};

type Props = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: Payload) => Promise<void> | void;
  readonly initialName?: string;
};

export default function NodeCreateDialog({
  open,
  onClose,
  onSubmit,
  initialName = "",
}: Props) {
  const nameId = useId();
  const noteId = useId();
  const statusId = useId();
  const unitId = useId();
  const valueId = useId();

  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");

  // dataArchiving builder: unit -> value -> ISO 8601 duration
  const [archUnit, setArchUnit] = useState<DurationUnit | "">("");
  const [archValue, setArchValue] = useState<string>("");

  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setNote("");
    setArchUnit("");
    setArchValue("");
    setStatus("active");
    setError(null);
    setSubmitting(false);
  }, [open, initialName]);

  const archNumber = useMemo(() => {
    if (!archValue.trim()) return NaN;
    return Number(archValue);
  }, [archValue]);

  const dataArchiving = useMemo(() => {
    if (!archUnit) return "";
    if (!Number.isFinite(archNumber) || archNumber <= 0) return "";
    return toIsoDuration(archNumber, archUnit);
  }, [archNumber, archUnit]);

  const canSubmit = useMemo(() => {
    return !!name.trim() && !!dataArchiving && !submitting;
  }, [name, dataArchiving, submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) return;
    if (!dataArchiving) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: trimmed,
        note: note.trim() ? note.trim() : undefined,
        dataArchiving,
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create node");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Create new node"
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
            form="node-create-form"
            disabled={!canSubmit}
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
        id="node-create-form"
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
            placeholder="e.g. Garden Node"
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
            placeholder="e.g. Backyard sensors"
            disabled={submitting}
          />
        </div>

        <div className="field">
          <label htmlFor={statusId} className="field-label">
            Status:
          </label>
          <select
            id={statusId}
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            disabled={submitting}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor={unitId} className="field-label">
            Data archiving:
          </label>
          <select
            id={unitId}
            className="input"
            value={archUnit}
            onChange={(e) => {
              const next = e.target.value as DurationUnit | "";
              setArchUnit(next);
              setArchValue("");
            }}
            disabled={submitting}
          >
            <option value="">Select unit…</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>

        {archUnit && (
          <div className="field">
            <label htmlFor={valueId} className="field-label">
              Value:
            </label>
            <input
              id={valueId}
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={archValue}
              onChange={(e) => setArchValue(e.target.value)}
              placeholder={
                archUnit === "minutes"
                  ? "e.g. 30"
                  : archUnit === "hours"
                    ? "e.g. 12"
                    : "e.g. 30"
              }
              disabled={submitting}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
