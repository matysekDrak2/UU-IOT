export type ApiErrorBody = {
  error: string;
  message: string;
};

// User
export type User = {
  id?: string;
  username: string;
  email: string;
  password?: string;
};

export type TokenResponse = {
  userId: string;
  token: string;
  expiration: string;
};

// Node
export type NodeStatus = "active" | "inactive" | "unknown";

export type Node = {
  id: string;
  userId?: string;
  name?: string;
  note?: string;
  status: NodeStatus;
  dataArchiving?: string;
};

export type NodeCreate = {
  name: string;
  note?: string;
  status?: NodeStatus;
  dataArchiving?: string;
};

export type NodeUpdate = {
  name?: string;
  note?: string;
  dataArchiving?: string;
};

export type NodeToken = {
  nodeId: string;
  token: string;
};

// Pot
export type Pot = {
  id: string;
  nodeId: string;
  name?: string;
  note?: string;
  status: NodeStatus;
};

export type PotUpdate = {
  name?: string;
  note?: string;
};

// Measurement
export type MeasurementType = "moisture" | string;

export type Measurement = {
  id: string;
  potId: string;
  timestamp: string;
  value: number;
  type: MeasurementType;
};

export type MeasurementCreate = Omit<Measurement, "id" | "potId">;
