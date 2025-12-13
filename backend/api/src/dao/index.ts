import mysql from "mysql2/promise";
import { randomUUID } from "crypto";


function parseDatabaseUrl(url: string) {
  // basic mysql://user:pass@host:port/db
  const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):?(\d+)?\/(.+)/);
  if (!m) throw new Error("Invalid DATABASE_URL");
  return { user: m[1], password: m[2], host: m[3], port: m[4] ? Number(m[4]) : 3306, database: m[5] };
}

let pool: mysql.Pool | undefined = undefined;
export function getPool(): mysql.Pool {
  if (pool !== undefined) {return pool}

  const DATABASE_URL = process.env.DATABASE_URL || "mysql://user:password@localhost:3306/mydatabase";
  const cfg = parseDatabaseUrl(DATABASE_URL);

  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true
  })
  return pool;
}

/**
 * Run a trivial query to verify DB connectivity.
 * Sets dbConnected flag and logs result.
 */
export async function checkDbConnection() {
  await getPool().query("SELECT 1");
}

// Trigger the check on module import (startup)
checkDbConnection().catch((err) => {
  throw Error("Database connection: FAILED" + err && err.message ? err.message : err);
});

// DAO helpers (concise implementations)
export async function createUser(username: string, email: string, passwordHash: string) {
  const id = randomUUID();
  const execution = getPool().execute(
      "INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, NOW())",
      [id, username, email, passwordHash]
  )
  await execution
  return { id, username, email };
}

export async function findUserByEmail(email: string) {
  const [rows] = await getPool().execute<any[]>("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

export async function storeUserToken(userId: string, token: string, expiresAt: string) {
  await getPool().execute("INSERT INTO tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)", [
    randomUUID(),
    userId,
    token,
    expiresAt
  ]);
}

export async function findUserByToken(token: string) {
  const [rows] = await getPool().execute<any[]>(
    "SELECT u.* FROM users u JOIN tokens t ON t.user_id = u.id WHERE t.token = ? AND (t.expires_at IS NULL OR t.expires_at > NOW()) LIMIT 1",
    [token]
  );
  return rows[0] || null;
}

// Nodes & node tokens
export async function createNode(userId: string, name: string, note: string | null, status: string, dataArchiving: string | null) {
  const id = randomUUID();
  await getPool().execute(
    "INSERT INTO nodes (id, user_id, name, note, status, data_archiving, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [id, userId, name, note || "", status || "unknown", dataArchiving || null]
  );
  return { id, userId, name, note, status, dataArchiving };
}

export async function createNodeToken(nodeId: string, token: string) {
  await getPool().execute("INSERT INTO node_tokens (id, node_id, token, created_at) VALUES (?, ?, ?, NOW())", [randomUUID(), nodeId, token]);
}

export async function findNodeById(nodeId: string) {
  const [rows] = await getPool().execute<any[]>("SELECT * FROM nodes WHERE id = ? LIMIT 1", [nodeId]);
  return rows[0] || null;
}

export async function findNodeByToken(token: string) {
  const [rows] = await getPool().execute<any[]>(
    "SELECT n.* FROM nodes n JOIN node_tokens nt ON nt.node_id = n.id WHERE nt.token = ? LIMIT 1",
    [token]
  );
  return rows[0] || null;
}

// Pots
export async function createPot(nodeId: string, name: string, note: string | null, status: string, reportingTime: string | null) {
  const id = randomUUID();
  await getPool().execute(
    "INSERT INTO pots (id, node_id, name, note, status, reporting_time, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [id, nodeId, name, note || "", status || "unknown", reportingTime || null]
  );
  return { id, nodeId, name, note, status, reportingTime };
}

export async function listPotsByNode(nodeId: string) {
  const [rows] = await getPool().execute<any[]>("SELECT * FROM pots WHERE node_id = ?", [nodeId]);
  return rows;
}

export async function getPot(potId: string) {
  const [rows] = await getPool().execute<any[]>("SELECT * FROM pots WHERE id = ? LIMIT 1", [potId]);
  return rows[0] || null;
}

// Measurements
export async function createMeasurement(potId: string, timestamp: string, value: number, type: string) {
  const id = randomUUID();
  await getPool().execute("INSERT INTO measurements (id, pot_id, timestamp, value, type) VALUES (?, ?, ?, ?, ?)", [
    id,
    potId,
    timestamp,
    value,
    type
  ]);
  return { id, potId, timestamp, value, type };
}

export async function listMeasurements(potId: string, timeStart?: string, timeEnd?: string) {
  let sql = "SELECT * FROM measurements WHERE pot_id = ?";
  const params: any[] = [potId];
  if (timeStart) {
    sql += " AND timestamp >= ?";
    params.push(timeStart);
  }
  if (timeEnd) {
    sql += " AND timestamp <= ?";
    params.push(timeEnd);
  }
  sql += " ORDER BY timestamp DESC LIMIT 1000";
  const [rows] = await getPool().execute<any[]>(sql, params);
  return rows;
}

// Node errors
export async function reportNodeError(nodeId: string, code: string, message: string, severity: string, timestamp: string | null) {
  const id = randomUUID();
  await getPool().execute(
    "INSERT INTO node_errors (id, node_id, code, message, severity, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    [id, nodeId, code, message, severity || "medium", timestamp || new Date().toISOString()]
  );
  return { id, nodeId, code, message, severity, timestamp: timestamp || new Date().toISOString() };
}

export async function listNodeErrorsByUser(userId: string, nodeId?: string, timeStart?: string, timeEnd?: string) {
  const params: any[] = [userId];
  let sql =
    "SELECT ne.* FROM node_errors ne JOIN nodes n ON n.id = ne.node_id WHERE n.user_id = ?";

  if (nodeId) {
    sql += " AND ne.node_id = ?";
    params.push(nodeId);
  }
  if (timeStart) {
    sql += " AND ne.timestamp >= ?";
    params.push(timeStart);
  }
  if (timeEnd) {
    sql += " AND ne.timestamp <= ?";
    params.push(timeEnd);
  }
  sql += " ORDER BY ne.timestamp DESC LIMIT 1000";
  const [rows] = await getPool().execute<any[]>(sql, params);
  return rows;
}
