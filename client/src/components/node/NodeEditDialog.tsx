import React, { useEffect, useId, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import type { Node, NodeUpdate } from "../../api/types";
import { useTranslation } from "react-i18next";

type DurationUnit = "minutes" | "hours" | "days";

type Props = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSave: (payload: NodeUpdate) => Promise<void> | void;
  readonly node: Node;
};

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

function parseIsoDuration(iso: string | undefined): { unit: DurationUnit | ""; value: string } {
  if (!iso) return { unit: "", value: "" };

  // Match patterns like PT15M, PT2H, P3D
  const minutesMatch = iso.match(/^PT(\d+)M$/i);
  if (minutesMatch) return { unit: "minutes", value: minutesMatch[1] };

  const hoursMatch = iso.match(/^PT(\d+)H$/i);
  if (hoursMatch) return { unit: "hours", value: hoursMatch[1] };

  const daysMatch = iso.match(/^P(\d+)D$/i);
  if (daysMatch) return { unit: "days", value: daysMatch[1] };

  return { unit: "", value: "" };
}

export default function NodeEditDialog({
  open,
  onClose,
  onSave,
  node,
}: Props) {
  const { t } = useTranslation();
  const nameId = useId();
  const noteId = useId();
  const unitId = useId();
  const valueId = useId();

  const [name, setName] = useState(node.name ?? "");
  const [note, setNote] = useState(node.note ?? "");

  const [archiveUnit, setArchiveUnit] = useState<DurationUnit | "">("");
  const [archiveValue, setArchiveValue] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setName(node.name ?? "");
    setNote(node.note ?? "");
    const parsed = parseIsoDuration(node.dataArchiving);
    setArchiveUnit(parsed.unit);
    setArchiveValue(parsed.value);
    setError(null);
    setSubmitting(false);
  }, [open, node]);

  const archiveNumber = useMemo(() => {
    if (!archiveValue.trim()) return NaN;
    return Number(archiveValue);
  }, [archiveValue]);

  const dataArchivingIso = useMemo(() => {
    if (!archiveUnit) return undefined;
    if (!Number.isFinite(archiveNumber) || archiveNumber <= 0) return undefined;
    return toIsoDuration(archiveNumber, archiveUnit);
  }, [archiveNumber, archiveUnit]);

  const isFormValid = useMemo(() => {
    return !!name.trim() && !submitting;
  }, [name, submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSave({
        name: trimmedName,
        note: note.trim() || undefined,
        dataArchiving: dataArchivingIso,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? t("NOTIFICATION.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t("UI.edit_node")}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {t("ACTION.cancel")}
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            form="node-edit-form"
            disabled={!isFormValid}
          >
            {submitting ? t("NOTIFICATION.loading") : t("ACTION.save")}
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          <div className="alert-title">{t("NOTIFICATION.error")}</div>
          <div>{error}</div>
        </div>
      )}

      <form
        id="node-edit-form"
        onSubmit={handleSubmit}
        className="create_form"
      >
        <div className="field">
          <label htmlFor={nameId} className="field-label">
            {t("NODE.name")}:
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
          <label htmlFor={unitId} className="field-label">
            {t("NODE.data_archiving")}:
          </label>

          <select
            id={unitId}
            className="input"
            value={archiveUnit}
            onChange={(e) => {
              const next = e.target.value as DurationUnit | "";
              setArchiveUnit(next);
              if (!next) setArchiveValue("");
            }}
            disabled={submitting}
          >
            <option value="">{t("NODE.select_unit")}</option>
            <option value="minutes">{t("NODE.minutes")}</option>
            <option value="hours">{t("NODE.hours")}</option>
            <option value="days">{t("NODE.days")}</option>
          </select>
        </div>

        {archiveUnit && (
          <div className="field">
            <label htmlFor={valueId} className="field-label">
              {t("NODE.value")}:
            </label>
            <input
              id={valueId}
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={archiveValue}
              onChange={(e) => setArchiveValue(e.target.value)}
              placeholder={
                archiveUnit === "minutes"
                  ? "e.g. 15"
                  : archiveUnit === "hours"
                    ? "e.g. 2"
                    : "e.g. 3"
              }
              disabled={submitting}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor={noteId} className="field-label">
            {t("NODE.note")}:
          </label>
          <input
            id={noteId}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Front yard sensor"
            disabled={submitting}
          />
        </div>
      </form>
    </Modal>
  );
}
