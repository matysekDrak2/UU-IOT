import { api } from "../client";
import type { Measurement, MeasurementCreate } from "../types";

// GET /pot/{potId}/measurement?timeStart=&timeEnd=
export function listMeasurements(
  potId: string,
  params?: { timeStart?: string; timeEnd?: string },
) {
  const qs = new URLSearchParams();
  if (params?.timeStart) qs.set("timeStart", params.timeStart);
  if (params?.timeEnd) qs.set("timeEnd", params.timeEnd);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api<Measurement[]>(`/pot/${potId}/measurement${suffix}`, {
    method: "GET",
  });
}

// PUT /pot/{potId}/measurement — node-token
export function createMeasurementAsNode(
  potId: string,
  payload: MeasurementCreate,
  nodeToken: string,
) {
  return api<Measurement>(`/pot/${potId}/measurement`, {
    method: "PUT",
    body: payload,
    token: nodeToken,
  });
}
