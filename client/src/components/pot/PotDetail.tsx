import { useEffect, useMemo, useState } from "react";
import type { Pot, Measurement, PotUpdate } from "../../api/types";
import { getPot, updatePot } from "../../api/enpoints/pot";
import { listMeasurements } from "../../api/enpoints/measurement";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import PotEditDialog from "./PotEditDialog";

type Props = {
  readonly potId?: string;
  readonly onBack?: () => void;
};

type IntervalOption = "auto" | "5min" | "15min" | "1hour" | "6hour" | "1day" | "1week";

const INTERVALS: Record<Exclude<IntervalOption, "auto">, { ms: number }> = {
  "5min": { ms: 5 * 60 * 1000 },
  "15min": { ms: 15 * 60 * 1000 },
  "1hour": { ms: 60 * 60 * 1000 },
  "6hour": { ms: 6 * 60 * 60 * 1000 },
  "1day": { ms: 24 * 60 * 60 * 1000 },
  "1week": { ms: 7 * 24 * 60 * 60 * 1000 },
};

// Generate a consistent color from a string (type name)
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

function normalizeMeasurements(data: unknown): Measurement[] {
  return Array.isArray(data) ? (data as Measurement[]) : [];
}

function calculateAutoInterval(rangeMs: number): number {
  const hours = rangeMs / 3600000;
  const days = hours / 24;

  if (hours <= 3) return 5 * 60000;      // 5 min
  if (hours <= 24) return 15 * 60000;    // 15 min
  if (days <= 7) return 60 * 60000;      // 1 hour
  if (days <= 30) return 6 * 3600000;    // 6 hours
  if (days <= 180) return 86400000;      // 1 day
  return 604800000;                       // 1 week
}

function aggregateByInterval(
  measurements: Measurement[],
  intervalOption: IntervalOption
): { timestamp: number; value: number }[] {
  if (!measurements.length) return [];

  // Sort by timestamp
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate actual interval
  const first = new Date(sorted[0].timestamp).getTime();
  const last = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const rangeMs = last - first;

  const intervalMs = intervalOption === "auto"
    ? calculateAutoInterval(rangeMs)
    : INTERVALS[intervalOption].ms;

  // Group by interval bucket
  const buckets = new Map<number, number[]>();
  for (const m of sorted) {
    const t = new Date(m.timestamp).getTime();
    const bucket = Math.floor((t - first) / intervalMs) * intervalMs + first;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(m.value);
  }

  // Calculate averages
  return Array.from(buckets.entries())
    .map(([timestamp, values]) => ({
      timestamp,
      value: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export default function PotDetail({ potId: potIdProp, onBack }: Props) {
  const { potId: potIdParam } = useParams<{ potId: string }>();
  const potId = potIdProp ?? potIdParam;
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [pot, setPot] = useState<Pot | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<IntervalOption>("auto");
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set());
  const [editOpen, setEditOpen] = useState(false);

  // Extract all unique measurement types
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const m of measurements) {
      if (m.type) types.add(m.type);
    }
    return Array.from(types).sort();
  }, [measurements]);

  // Initialize enabledTypes when availableTypes changes
  useEffect(() => {
    if (availableTypes.length > 0 && enabledTypes.size === 0) {
      setEnabledTypes(new Set(availableTypes));
    }
  }, [availableTypes, enabledTypes.size]);

  // Generate colors for each type
  const typeColors = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const type of availableTypes) {
      colors[type] = stringToColor(type);
    }
    return colors;
  }, [availableTypes]);

  const toggleType = (type: string) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  async function handleSavePot(payload: PotUpdate) {
    if (!potId) return;
    const updated = await updatePot(potId, payload);
    if (updated) {
      setPot(updated);
    } else {
      throw new Error(t("NOTIFICATION.error"));
    }
  }

  function formatReportingTime(iso: string | undefined): string {
    if (!iso) return "-";
    const minutesMatch = iso.match(/^PT(\d+)M$/i);
    if (minutesMatch) return `${minutesMatch[1]} ${t("POT.minutes").toLowerCase()}`;
    const hoursMatch = iso.match(/^PT(\d+)H$/i);
    if (hoursMatch) return `${hoursMatch[1]} ${t("POT.hours").toLowerCase()}`;
    const daysMatch = iso.match(/^P(\d+)D$/i);
    if (daysMatch) return `${daysMatch[1]} ${t("POT.days").toLowerCase()}`;
    return iso;
  }

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
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setPot(null);
          setMeasurements([]);
          setError(e instanceof Error ? e.message : "Failed to load pot");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [potId]);

  // Group measurements by type and create series for each enabled type
  const chartSeries = useMemo(() => {
    const series: { name: string; data: { x: number; y: number }[] }[] = [];

    for (const type of availableTypes) {
      if (!enabledTypes.has(type)) continue;

      const typeMeasurements = measurements.filter(m => m.type === type);
      const aggregated = aggregateByInterval(typeMeasurements, interval);

      series.push({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        data: aggregated.map(m => ({
          x: m.timestamp,
          y: m.value
        }))
      });
    }

    return series;
  }, [measurements, interval, availableTypes, enabledTypes]);

  // Get colors array for enabled types (in same order as series)
  const seriesColors = useMemo(() => {
    return availableTypes
      .filter(type => enabledTypes.has(type))
      .map(type => typeColors[type]);
  }, [availableTypes, enabledTypes, typeColors]);

  // Calculate initial selection range for brush chart (last 7 days or full range)
  const selectionRange = useMemo(() => {
    const allData = chartSeries.flatMap(s => s.data);
    if (allData.length === 0) {
      return { min: Date.now() - 7 * 86400000, max: Date.now() };
    }
    const timestamps = allData.map(d => d.x);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const rangeMs = max - min;

    // If range is more than 7 days, select last 7 days
    if (rangeMs > 7 * 86400000) {
      return { min: max - 7 * 86400000, max };
    }
    return { min, max };
  }, [chartSeries]);

  const chartOptions: ApexOptions = useMemo(() => ({
    chart: {
      id: 'main-chart',
      type: 'area',
      height: 350,
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true
      },
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
        autoSelected: 'zoom'
      },
      background: 'transparent'
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.2,
        stops: [0, 100]
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        style: { colors: '#8bee58' }
      },
      axisBorder: { color: '#8bee58' },
      axisTicks: { color: '#8bee58' }
    },
    yaxis: {
      min: 0,
      max: 100,
      title: { text: '%', style: { color: '#8bee58' } },
      labels: { style: { colors: '#8bee58' } }
    },
    tooltip: {
      x: { format: 'dd MMM yyyy HH:mm' },
      theme: 'dark'
    },
    grid: {
      borderColor: '#40861b',
      strokeDashArray: 3
    },
    colors: seriesColors,
    legend: {
      show: false
    },
    theme: { mode: 'dark' }
  }), [seriesColors]);

  const brushOptions: ApexOptions = useMemo(() => ({
    chart: {
      id: 'brush-chart',
      height: 130,
      type: 'area',
      brush: {
        target: 'main-chart',
        enabled: true
      },
      selection: {
        enabled: true,
        xaxis: {
          min: selectionRange.min,
          max: selectionRange.max
        }
      },
      background: 'transparent'
    },
    colors: seriesColors,
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: 0.5,
        opacityTo: 0.1
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        style: { colors: '#8bee58' }
      },
      axisBorder: { color: '#8bee58' },
      axisTicks: { color: '#8bee58' }
    },
    yaxis: {
      show: false
    },
    grid: {
      borderColor: '#40861b'
    },
    legend: {
      show: false
    },
    theme: { mode: 'dark' }
  }), [selectionRange, seriesColors]);

  const hasData = chartSeries.some(s => s.data.length > 0);

  if (!potId) return <div>Pot not found</div>;
  if (loading) return <p>{t("NOTIFICATION.loading")}...</p>;
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
        {`\u2190 ${t("ACTION.back")}`}
      </button>

      <h1>{pot.name ?? "My Pot"}</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{t("POT.pot_info")}</h3>
          <button
            className="btn btn-secondary"
            onClick={() => setEditOpen(true)}
          >
            {t("ACTION.edit")}
          </button>
        </div>
        <p><strong>{t("POT.name")}:</strong> {pot.name ?? "-"}</p>
        <p><strong>{t("POT.reporting_time")}:</strong> {formatReportingTime(pot.reportingTime)}</p>
        <p><strong>{t("POT.note")}:</strong> {pot.note ?? "-"}</p>
        <p><strong>Status:</strong> {pot.status}</p>
      </div>

      <div className="card">
        <h3>{t("CHART.measurements")}</h3>

        <div
          style={{
            marginBottom: 12,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label style={{ display: "block" }}>{t("CHART.interval")}</label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as IntervalOption)}
            >
              <option value="auto">{t("CHART.interval_auto")}</option>
              <option value="5min">{t("CHART.interval_5min")}</option>
              <option value="15min">{t("CHART.interval_15min")}</option>
              <option value="1hour">{t("CHART.interval_1hour")}</option>
              <option value="6hour">{t("CHART.interval_6hour")}</option>
              <option value="1day">{t("CHART.interval_1day")}</option>
              <option value="1week">{t("CHART.interval_1week")}</option>
            </select>
          </div>

          {availableTypes.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ opacity: 0.8 }}>{t("CHART.types")}:</span>
              {availableTypes.map(type => (
                <label
                  key={type}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: enabledTypes.has(type) ? "rgba(255,255,255,0.1)" : "transparent",
                    border: `2px solid ${typeColors[type]}`,
                    opacity: enabledTypes.has(type) ? 1 : 0.5,
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabledTypes.has(type)}
                    onChange={() => toggleType(type)}
                    style={{ display: "none" }}
                  />
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: enabledTypes.has(type) ? typeColors[type] : "transparent",
                      border: `2px solid ${typeColors[type]}`,
                    }}
                  />
                  <span style={{ textTransform: "capitalize" }}>{type}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {!hasData ? (
          <p style={{ opacity: 0.7 }}>{t("CHART.no_data")}</p>
        ) : (
          <>
            <Chart
              options={chartOptions}
              series={chartSeries}
              type="area"
              height={350}
            />
            <Chart
              options={brushOptions}
              series={chartSeries}
              type="area"
              height={130}
            />
          </>
        )}
      </div>

      <PotEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSavePot}
        pot={pot}
      />
    </div>
  );
}
