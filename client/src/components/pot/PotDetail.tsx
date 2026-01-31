import React, { useEffect, useState } from "react";
import type { Pot, Measurement } from "../../api/types";
import { getPot } from "../../api/enpoints/pot";
import { listMeasurements } from "../../api/enpoints/measurement";
import { useParams } from "react-router-dom";
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
  readonly onBack?: () => void;
};

function normalizeMeasurements(data: unknown): Measurement[] {
  return Array.isArray(data) ? (data as Measurement[]) : [];
}

function aggregateMeasurements(
  measurements: Measurement[],
  period: "day" | "week" | "month",
) {
  const result: { time: string; value: number }[] = [];

  const grouped: Record<string, number[]> = {};

  measurements.forEach((m) => {
    const d = new Date(m.timestamp);
    let key: string;
    if (period === "day")
      key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    else if (period === "week") {
      const week = Math.ceil(
        ((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 +
          new Date(d.getFullYear(), 0, 1).getDay() +
          1) /
          7,
      );
      key = `${d.getFullYear()}-W${week}`;
    } else key = `${d.getFullYear()}-${d.getMonth() + 1}`; // YYYY-MM
    grouped[key] = grouped[key] ?? [];
    grouped[key].push(m.value);
  });

  for (const key in grouped) {
    const vals = grouped[key];
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    result.push({ time: key, value: Number(avg.toFixed(2)) });
  }

  result.sort((a, b) => (a.time < b.time ? -1 : 1));

  return result;
}

export default function PotDetail({ onBack }: Props) {
  const { potId } = useParams<{ potId: string }>();
  if (!potId) return <div>Pot not found</div>;
  const [pot, setPot] = useState<Pot | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const potData = await getPot(potId);
        if (!potData) throw new Error("Pot not found");

        const measurementsData = await listMeasurements(potId);

        if (!cancelled) {
          setPot(potData);
          setMeasurements(normalizeMeasurements(measurementsData));
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

  const chartData = aggregateMeasurements(measurements, period);

  if (loading) return <p>Loading…</p>;
  if (error || !pot) return <p>{error ?? "Pot not found"}</p>;

  return (
    <div className="page" id="pot_detail_page">
      <button className="btn btn-secondary" onClick={onBack}>
        ← Back
      </button>

      <h1>{pot.name ?? "My Pot"}</h1>
      <p>Status: {pot.status}</p>

      {pot.note && (
        <div className="card">
          <h3>Note</h3>
          <p>{pot.note}</p>
        </div>
      )}

      <div className="card">
        <h3>Measurements</h3>
        <div style={{ marginBottom: 12 }}>
          <label>Period: </label>
          <select
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value as "day" | "week" | "month")
            }
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>

        {measurements.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No measurements yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
