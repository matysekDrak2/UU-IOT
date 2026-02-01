import { api } from "../client";
import type { Node, NodeToken, NodeUpdate, PotWarning } from "../types";

function asArray<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

// PUT /node — device registration (creates node token)
export async function createNodeToken(): Promise<NodeToken> {
  return api<NodeToken>("/node", { method: "PUT" });
}

// GET /node — list with pot counts
export async function listNodes(): Promise<Node[]> {
  const raw = await api<unknown>("/node", { method: "GET" });
  return asArray<any>(raw).map((n) => ({
    ...n,
    potCount: n.pot_count,
  }));
}

// GET /node/{nodeId}
export async function getNode(nodeId: string): Promise<Node | null> {
  try {
    const raw = await api<unknown>(`/node/${nodeId}`, { method: "GET" });
    return raw && typeof raw === "object" ? (raw as Node) : null;
  } catch {
    return null;
  }
}

// PATCH /node/{nodeId}
export async function updateNode(
  nodeId: string,
  payload: NodeUpdate,
): Promise<Node | null> {
  try {
    const raw = await api<unknown>(`/node/${nodeId}`, {
      method: "PATCH",
      body: payload,
    });
    return raw && typeof raw === "object" ? (raw as Node) : null;
  } catch {
    return null;
  }
}

// DELETE /node/{nodeId}
export async function deleteNode(nodeId: string): Promise<boolean> {
  try {
    await api<void>(`/node/${nodeId}`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}

// GET /node/{nodeId}/warning — list active warnings for all pots under node
export async function listNodeWarnings(nodeId: string): Promise<PotWarning[]> {
  try {
    const raw = await api<unknown>(`/node/${nodeId}/warning`, { method: "GET" });
    return Array.isArray(raw) ? (raw as PotWarning[]) : [];
  } catch {
    return [];
  }
}
