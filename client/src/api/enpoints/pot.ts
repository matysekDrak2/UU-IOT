import { api } from "../client";
import type { Pot, PotUpdate, PotCreate } from "../types";

// GET /node/{nodeId}/pot — list
export function listPotsByNode(nodeId: string) {
  return api<Pot[]>(`/node/${nodeId}/pot`, { method: "GET" });
}

// GET /pot/{potId}
export function getPot(potId: string) {
  return api<Pot>(`/pot/${potId}`, { method: "GET" });
}

// POST /pot — create
export async function createPot(payload: PotCreate): Promise<Pot> {
  return api<Pot>("/pot", { method: "POST", body: payload });
}

// PATCH /pot/{potId}
export function updatePot(potId: string, payload: PotUpdate) {
  return api<Pot>(`/pot/${potId}`, { method: "PATCH", body: payload });
}

// DELETE /pot/{potId}
export function deletePot(potId: string) {
  return api<void>(`/pot/${potId}`, { method: "DELETE" });
}
