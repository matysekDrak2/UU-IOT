import { api } from "../client";
import type { Pot, PotUpdate, PotWarning } from "../types";

// GET /node/{nodeId}/pot — list with latest measurement
export async function listPotsByNode(nodeId: string): Promise<Pot[]> {
  const raw = await api<any[]>(`/node/${nodeId}/pot`, { method: "GET" });
  return (raw || []).map((p) => ({
    ...p,
    latestMeasurement: p.latest_type ? {
      type: p.latest_type,
      value: p.latest_value,
      timestamp: p.latest_timestamp,
    } : null,
  }));
}

// GET /pot/{potId}
export function getPot(potId: string) {
  return api<Pot>(`/pot/${potId}`, { method: "GET" });
}

// PATCH /pot/{potId}
export function updatePot(potId: string, payload: PotUpdate) {
  return api<Pot>(`/pot/${potId}`, { method: "PATCH", body: payload });
}

// DELETE /pot/{potId}
export function deletePot(potId: string) {
  return api<void>(`/pot/${potId}`, { method: "DELETE" });
}

// GET /pot/{potId}/warning — list active warnings
export function listPotWarnings(potId: string) {
  return api<PotWarning[]>(`/pot/${potId}/warning`, { method: "GET" });
}

// POST /pot/{potId}/warning/{warningId}/dismiss
export function dismissWarning(potId: string, warningId: string) {
  return api<void>(`/pot/${potId}/warning/${warningId}/dismiss`, { method: "POST" });
}

// POST /pot/{potId}/warning/dismiss-all
export function dismissAllWarnings(potId: string) {
  return api<void>(`/pot/${potId}/warning/dismiss-all`, { method: "POST" });
}
