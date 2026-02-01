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
  potCount?: number;
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

// Threshold per measurement type
export type Threshold = {
  min?: number;
  max?: number;
};

export type Thresholds = Record<string, Threshold>;

// Latest measurement for display
export type LatestMeasurement = {
  type: string;
  value: number;
  timestamp: string;
};

// Pot
export type Pot = {
  id: string;
  nodeId: string;
  name?: string;
  note?: string;
  status: NodeStatus;
  reportingTime?: string;
  thresholds?: Thresholds;
  latestMeasurement?: LatestMeasurement | null;
};

export type PotUpdate = {
  name?: string;
  note?: string;
  reportingTime?: string;
  thresholds?: Thresholds;
};

// Warning from threshold breach
export type PotWarning = {
  id: string;
  potId: string;
  measurementType: string;
  thresholdType: 'min' | 'max';
  thresholdValue: number;
  measuredValue: number;
  measurementId: string;
  createdAt: string;
  dismissedAt?: string | null;
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
