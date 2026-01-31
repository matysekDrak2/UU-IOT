import { api } from "../client";
import type { Node, NodeCreate, NodeToken, NodeUpdate } from "../types";

function asArray<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

// PUT /node — create token
export async function createNodeToken(): Promise<NodeToken> {
  return api<NodeToken>("/node", { method: "PUT" });
}

// GET /node — list
export async function listNodes(): Promise<Node[]> {
  const raw = await api<unknown>("/node", { method: "GET" });
  return asArray<Node>(raw);
}
// POST /node — register
export async function createNode(payload: NodeCreate): Promise<Node> {
  return api<Node>("/node", { method: "POST", body: payload });
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
