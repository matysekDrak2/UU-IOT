import React, { useEffect, useMemo, useState } from "react";
import type { Pot, Measurement } from "../../api/types";
import { getPot } from "../../api/enpoints/pot";
import { listMeasurements } from "../../api/enpoints/measurement";
import { useNavigate, useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Props = {
  readonly potId?: string;
  readonly onBack?: () => void;
};

function normalizeMeasurements(data: unknown): Measurement[] {
  return Array.isArray(data) ? (data as Measurement[]) : [];
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0 ... Sun=6
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0); // last day of current month
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clampOrder(a: string, b: string) {
  const da = parseDateInput(a);
  const db = parseDateInput(b);
  if (!da || !db) return { from: a, to: b };
  return da.getTime() <= db.getTime() ? { from: a, to: b } : { from: b, to: a };
}

function rangeForPeriod(period: "day" | "week" | "month", anchor: Date) {
  if (period === "day") {
    const d = new Date(anchor);
    d.setHours(0, 0, 0, 0);
    const s = formatDateInput(d);
    return { from: s, to: s };
  }

  if (period === "week") {
    const mon = startOfWeekMonday(anchor);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(0, 0, 0, 0);
    return { from: formatDateInput(mon), to: formatDateInput(sun) };
  }

  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

type ChartPoint = { label: string; value: number | null };

function buildChartData(
  measurements: Measurement[],
  period: "day" | "week" | "month",
  fromDate: string,
  toDate: string,
): ChartPoint[] {
  const from = parseDateInput(fromDate);
  const to = parseDateInput(toDate);

  if (!from && !to) return [];

  const anchor = from ?? to!;
  const ms = measurements
    .map((m) => ({
      t: new Date(m.timestamp),
      v: m.value,
    }))
    .filter(({ t }) => Number.isFinite(t.getTime()));

  if (period === "day") {
    const day = new Date(anchor);
    day.setHours(0, 0, 0, 0);

    const grouped: Record<number, number[]> = {};
    for (const { t, v } of ms) {
      if (sameLocalDay(t, day)) {
        const h = t.getHours();
        (grouped[h] ??= []).push(v);
      }
    }

    return Array.from({ length: 24 }, (_, h) => {
      const vals = grouped[h];
      const avg =
        vals && vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;
      return {
        label: `${pad2(h)}:00`,
        value: avg ? Number(avg.toFixed(2)) : null,
      };
    });
  }

  if (period === "week") {
    const mon = startOfWeekMonday(anchor);
    const dayNames = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

    const byDay: Record<string, number[]> = {};
    for (const { t, v } of ms) {
      const key = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
      (byDay[key] ??= []).push(v);
    }

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      const vals = byDay[key];
      const avg =
        vals && vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;

      const dd = pad2(d.getDate());
      const mm = pad2(d.getMonth() + 1);
      return {
        label: `${dayNames[i]} ${dd}.${mm}`,
        value: avg ? Number(avg.toFixed(2)) : null,
      };
    });
  }

  // month
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDayOfMonth: Record<number, number[]> = {};
  for (const { t, v } of ms) {
    if (t.getFullYear() === year && t.getMonth() === month) {
      const day = t.getDate();
      (byDayOfMonth[day] ??= []).push(v);
    }
  }

  return Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const vals = byDayOfMonth[day];
    const avg =
      vals && vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : null;

    return {
      label: String(day),
      value: avg ? Number(avg.toFixed(2)) : null,
    };
  });
}

export default function PotDetail({ potId: potIdProp, onBack }: Props) {
  const { potId } = useParams<{ potId: string }>();
  const navigate = useNavigate();

  const [pot, setPot] = useState<Pot | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    if (!potId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const potData = await getPot(potId);
        if (!potData) throw new Error("Pot not found");

        const measurementsData = await listMeasurements(potId);
        const normalized = normalizeMeasurements(measurementsData);

        if (!cancelled) {
          setPot(potData);
          setMeasurements(normalized);

          // Initialize dates from measurement bounds (if empty)
          if (!fromDate || !toDate) {
            const times = normalized
              .map((m) => new Date(m.timestamp).getTime())
              .filter((t) => Number.isFinite(t))
              .sort((a, b) => a - b);

            if (times.length) {
              const min = new Date(times[0]);
              const max = new Date(times[times.length - 1]);
              const minStr = formatDateInput(min);
              const maxStr = formatDateInput(max);

              // Use previous if already set, otherwise bounds
              const initFrom = fromDate || minStr;
              const initTo = toDate || maxStr;
              const ordered = clampOrder(initFrom, initTo);

              setFromDate(ordered.from);
              setToDate(ordered.to);
            }
          } else {
            // Ensure order if both already present
            const ordered = clampOrder(fromDate, toDate);
            if (ordered.from !== fromDate) setFromDate(ordered.from);
            if (ordered.to !== toDate) setToDate(ordered.to);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setPot(null);
          setMeasurements([]);
          setError(e?.message ?? "Failed to load pot");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [potId]);

  // Keep from/to consistent when switching period
  useEffect(() => {
    const anchor =
      parseDateInput(fromDate) ?? parseDateInput(toDate) ?? new Date();

    const r = rangeForPeriod(period, anchor);
    const ordered = clampOrder(r.from, r.to);

    setFromDate(ordered.from);
    setToDate(ordered.to);
  }, [period]);

  // Also prevent manual "from > to" in week/month if user edits inputs
  useEffect(() => {
    if (period === "day") return;
    const a = parseDateInput(fromDate);
    const b = parseDateInput(toDate);
    if (!a || !b) return;
    if (a.getTime() > b.getTime()) {
      // swap
      setFromDate(toDate);
      setToDate(fromDate);
    }
  }, [fromDate, toDate, period]);

  // --- arrows navigation (day/week/month) ---
  function shiftRange(deltaDays: number, deltaMonths: number) {
    const anchor =
      parseDateInput(fromDate) ?? parseDateInput(toDate) ?? new Date();

    const n = new Date(anchor);
    if (deltaMonths !== 0) n.setMonth(n.getMonth() + deltaMonths);
    else n.setDate(n.getDate() + deltaDays);

    const r = rangeForPeriod(period, n);
    const ordered = clampOrder(r.from, r.to);

    setFromDate(ordered.from);
    setToDate(ordered.to);
  }

  function onPrev() {
    if (period === "day") shiftRange(-1, 0);
    if (period === "week") shiftRange(-7, 0);
    if (period === "month") shiftRange(0, -1);
  }

  function onNext() {
    if (period === "day") shiftRange(1, 0);
    if (period === "week") shiftRange(7, 0);
    if (period === "month") shiftRange(0, 1);
  }
  // --- END arrows navigation ---

  const chartData = useMemo(
    () => buildChartData(measurements, period, fromDate, toDate),
    [measurements, period, fromDate, toDate],
  );

  if (!potId) return <div>Pot not found</div>;
  if (loading) return <p>Loading…</p>;
  if (error || !pot) return <p>{error ?? "Pot not found"}</p>;

  return (
    <div className="page" id="pot_detail_page">
      <button
        className="btn btn-secondary"
        onClick={() => {
          onBack?.();
          navigate("/pots");
        }}
      >
        ← Back
      </button>

      <h1>{pot.name ?? "My Pot"}</h1>
      <p>Status: {pot.status}</p>

      <div className="card">
        <h3>Measurements</h3>

        <div
          style={{
            marginBottom: 12,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {period === "day" ? (
            <div>
              <label style={{ display: "block" }}>Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: "block" }}>From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block" }}>To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: "block" }}>Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onPrev}
              aria-label="Previous"
            >
              ←
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onNext}
              aria-label="Next"
            >
              →
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No measurements for chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                interval={period === "month" ? "preserveStartEnd" : 0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-header)",
                  border: "2px solid var(--color-border)",
                  borderRadius: 8,
                  color: "var(--color-border)",
                  fontSize: 14,
                }}
                labelStyle={{
                  color: "var(--color-border)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
                itemStyle={{
                  color: "var(--color-border)",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
