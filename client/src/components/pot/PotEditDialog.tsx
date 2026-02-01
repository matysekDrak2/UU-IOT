import React, { useEffect, useId, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import type { Pot, PotUpdate } from "../../api/types";
import { useTranslation } from "react-i18next";

type DurationUnit = "minutes" | "hours" | "days";

type Props = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSave: (payload: PotUpdate) => Promise<void> | void;
  readonly pot: Pot;
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

export default function PotEditDialog({
  open,
  onClose,
  onSave,
  pot,
}: Props) {
  const { t } = useTranslation();
  const nameId = useId();
  const noteId = useId();
  const unitId = useId();
  const valueId = useId();

  const [name, setName] = useState(pot.name ?? "");
  const [note, setNote] = useState(pot.note ?? "");

  const [reportingUnit, setReportingUnit] = useState<DurationUnit | "">("");
  const [reportingValue, setReportingValue] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setName(pot.name ?? "");
    setNote(pot.note ?? "");
    const parsed = parseIsoDuration(pot.reportingTime);
    setReportingUnit(parsed.unit);
    setReportingValue(parsed.value);
    setError(null);
    setSubmitting(false);
  }, [open, pot]);

  const reportingNumber = useMemo(() => {
    if (!reportingValue.trim()) return NaN;
    return Number(reportingValue);
  }, [reportingValue]);

  const reportingTimeIso = useMemo(() => {
    if (!reportingUnit) return undefined;
    if (!Number.isFinite(reportingNumber) || reportingNumber <= 0) return undefined;
    return toIsoDuration(reportingNumber, reportingUnit);
  }, [reportingNumber, reportingUnit]);

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
        reportingTime: reportingTimeIso,
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
      title={t("UI.edit_pot")}
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
            form="pot-edit-form"
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
        id="pot-edit-form"
        onSubmit={handleSubmit}
        className="create_form"
      >
        <div className="field">
          <label htmlFor={nameId} className="field-label">
            {t("POT.name")}:
          </label>
          <input
            id={nameId}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tomato Pot"
            autoFocus
            disabled={submitting}
          />
        </div>

        <div className="field">
          <label htmlFor={unitId} className="field-label">
            {t("POT.reporting_time")}:
          </label>

          <select
            id={unitId}
            className="input"
            value={reportingUnit}
            onChange={(e) => {
              const next = e.target.value as DurationUnit | "";
              setReportingUnit(next);
              if (!next) setReportingValue("");
            }}
            disabled={submitting}
          >
            <option value="">{t("POT.select_unit")}</option>
            <option value="minutes">{t("POT.minutes")}</option>
            <option value="hours">{t("POT.hours")}</option>
            <option value="days">{t("POT.days")}</option>
          </select>
        </div>

        {reportingUnit && (
          <div className="field">
            <label htmlFor={valueId} className="field-label">
              {t("POT.value")}:
            </label>
            <input
              id={valueId}
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={reportingValue}
              onChange={(e) => setReportingValue(e.target.value)}
              placeholder={
                reportingUnit === "minutes"
                  ? "e.g. 15"
                  : reportingUnit === "hours"
                    ? "e.g. 2"
                    : "e.g. 3"
              }
              disabled={submitting}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor={noteId} className="field-label">
            {t("POT.note")}:
          </label>
          <input
            id={noteId}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Front yard planter"
            disabled={submitting}
          />
        </div>
      </form>
    </Modal>
  );
}
