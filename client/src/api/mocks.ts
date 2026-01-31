import type { Node, Pot, Measurement } from "./types";
export const mockUser = {
  username: "john_doe",
  email: "john_doe+ourApp@gmail.com",
};

export const mockNodes: Node[] = [
  {
    id: "8b3f4c1d-2a7b-4f9a-b2d3-e5f6a7b8c901",
    userId: "123e4567-e89b-12d3-a456-426614174000",
    name: "Garden Node",
    note: "Backyard sensors",
    status: "active",
    dataArchiving: "P30D",
  },
  {
    id: "6f1e2b8a-1e2d-4c3b-8c9b-a3b14f0c1234",
    userId: "123e4567-e89b-12d3-a456-426614174000",
    name: "Living Room Node",
    note: "Main gateway",
    status: "unknown",
    dataArchiving: "P14D",
  },
];

export const mockPots: Pot[] = [
  {
    id: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    nodeId: "8b3f4c1d-2a7b-4f9a-b2d3-e5f6a7b8c901",
    name: "Front Porch Pot",
    note: "Ivy pot",
    status: "active",
  },
  {
    id: "a0a0a0a0-1111-2222-3333-bbbbbbbbbbbb",
    nodeId: "8b3f4c1d-2a7b-4f9a-b2d3-e5f6a7b8c901",
    name: "Kitchen Basil",
    note: "",
    status: "inactive",
  },
];

export const mockMeasurements: Measurement[] = [
  {
    id: "m-2026-01-01",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-01T12:00:00Z",
    value: 45.6,
    type: "moisture",
  },
  {
    id: "m-2026-01-02",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-02T12:00:00Z",
    value: 44.8,
    type: "moisture",
  },
  {
    id: "m-2026-01-03",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-03T12:00:00Z",
    value: 44.1,
    type: "moisture",
  },
  {
    id: "m-2026-01-04",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-04T12:00:00Z",
    value: 43.5,
    type: "moisture",
  },
  {
    id: "m-2026-01-05",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-05T12:00:00Z",
    value: 42.9,
    type: "moisture",
  },
  {
    id: "m-2026-01-06",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-06T12:00:00Z",
    value: 43.3,
    type: "moisture",
  },
  {
    id: "m-2026-01-07",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-07T12:00:00Z",
    value: 44.0,
    type: "moisture",
  },
  {
    id: "m-2026-01-08",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-08T12:00:00Z",
    value: 44.6,
    type: "moisture",
  },
  {
    id: "m-2026-01-09",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-09T12:00:00Z",
    value: 45.1,
    type: "moisture",
  },
  {
    id: "m-2026-01-10",
    potId: "d3f1a2b4-5c6d-7890-ab12-cd34ef567890",
    timestamp: "2026-01-10T12:00:00Z",
    value: 45.8,
    type: "moisture",
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockHandler(
  path: string,
  method: string,
): Promise<unknown> {
  await sleep(200);

  // USER
  if (path === "/user" && method === "GET") return mockUser;

  // NODES
  if (path === "/node" && method === "GET") return mockNodes;

  const nodeMatch = path.match(/^\/node\/([^/]+)$/);
  if (nodeMatch && method === "GET") {
    const node = mockNodes.find((n) => n.id === nodeMatch[1]);
    return node ?? null;
  }

  const potsByNodeMatch = path.match(/^\/node\/([^/]+)\/pot$/);
  if (potsByNodeMatch && method === "GET") {
    const nodeId = potsByNodeMatch[1];
    return mockPots.filter((p) => p.nodeId === nodeId);
  }

  // POTS
  const potMatch = path.match(/^\/pot\/([^/]+)$/);
  if (potMatch && method === "GET") {
    const pot = mockPots.find((p) => p.id === potMatch[1]);
    return pot ?? null;
  }

  // MEASUREMENTS
  const measMatch = path.match(/^\/pot\/([^/]+)\/measurement$/);
  if (measMatch && method === "GET") {
    const potId = measMatch[1];
    return mockMeasurements.filter((m) => m.potId === potId);
  }

  return "NOT_IMPLEMENTED";
}
