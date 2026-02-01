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
    decimalNumbers: true,
    connectTimeout: 10000
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
  throw Error("Database connection: FAILED - " + (err && err.message ? err.message : err));
});

// DAO helpers (concise implementations)
export async function createUser(username: string, email: string, passwordHash: string) {
  const id = randomUUID();
  try {
    const result = await getPool().execute(
      "INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, NOW())",
      [id, username, email, passwordHash]
    );
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }
    return { id, username, email };
  } catch (e) {
    return null;
  }
}

export async function findUserByEmail(email: string) {
  try {
    const [rows] = await getPool().execute<any[]>("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

export async function storeUserToken(userId: string, token: string, expiresAt: string) {
  const id = randomUUID();
  // Convert ISO string to MySQL datetime format
  const mysqlDatetime = expiresAt.replace("T", " ").replace("Z", "").split(".")[0];
  try {
    const result = await getPool().execute(
      "INSERT INTO tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
      [id, userId, token, mysqlDatetime]
    );
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }
    return { id, userId, token, expiresAt };
  } catch (e) {
    console.error("storeUserToken error:", e);
    return null;
  }
}

export async function findUserByToken(token: string) {
  try {
    const [rows] = await getPool().execute<any[]>(
      "SELECT u.* FROM users u JOIN tokens t ON t.user_id = u.id WHERE t.token = ? AND (t.expires_at IS NULL OR t.expires_at > NOW()) LIMIT 1",
      [token]
    );
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

// Nodes & node tokens
export async function createNode(userId: string, name: string, note: string | null, status: string, dataArchiving: string | null) {
  const id = randomUUID();
  try {
    const result = await getPool().execute(
      "INSERT INTO nodes (id, user_id, name, note, status, data_archiving, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [id, userId, name, note || "", status || "unknown", dataArchiving || null]
    );
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }
    return { id, userId, name, note, status, dataArchiving };
  } catch (e) {
    return null;
  }
}

export async function createNodeToken(nodeId: string, token: string) {
  const id = randomUUID();
  try {
    const result = await getPool().execute("INSERT INTO node_tokens (id, node_id, token, created_at) VALUES (?, ?, ?, NOW())", [id, nodeId, token]);
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }
    return { id, nodeId, token };
  } catch (e) {
    return null;
  }
}

export async function findNodeById(nodeId: string) {
  try {
    const [rows] = await getPool().execute<any[]>("SELECT * FROM nodes WHERE id = ? LIMIT 1", [nodeId]);
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

export async function findNodeByToken(token: string) {
  try {
    const [rows] = await getPool().execute<any[]>(
      "SELECT n.* FROM nodes n JOIN node_tokens nt ON nt.node_id = n.id WHERE nt.token = ? LIMIT 1",
      [token]
    );
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

// Pots
export async function createPot(nodeId: string, name: string, note: string | null, status: string, reportingTime: string | null) {
  const id = randomUUID();
  try {
    const result = await getPool().execute(
      "INSERT INTO pots (id, node_id, name, note, status, reporting_time, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [id, nodeId, name, note || "", status || "unknown", reportingTime || null]
    );
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }
    return { id, nodeId, name, note, status, reportingTime };
  } catch (e) {
    return null;
  }
}

export async function listPotsByNode(nodeId: string) {
  try {
    const [rows] = await getPool().execute<any[]>("SELECT * FROM pots WHERE node_id = ?", [nodeId]);
    return rows;
  } catch (e) {
    return null;
  }
}

export async function listNodesWithStats(userId: string) {
  try {
    const [rows] = await getPool().execute<any[]>(
      `SELECT n.*, COUNT(p.id) AS pot_count
       FROM nodes n
       LEFT JOIN pots p ON p.node_id = n.id
       WHERE n.user_id = ?
       GROUP BY n.id`,
      [userId]
    );
    return rows;
  } catch (e) {
    return null;
  }
}

export async function listPotsWithLatestMeasurement(nodeId: string) {
  try {
    const [rows] = await getPool().execute<any[]>(
      `SELECT p.*, lm.type AS latest_type, lm.value AS latest_value, lm.timestamp AS latest_timestamp
       FROM pots p
       LEFT JOIN (
         SELECT pot_id, type, value, timestamp
         FROM (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY pot_id ORDER BY timestamp DESC) AS rn
           FROM measurements
         ) ranked WHERE rn = 1
       ) lm ON lm.pot_id = p.id
       WHERE p.node_id = ?`,
      [nodeId]
    );
    return rows;
  } catch (e) {
    return null;
  }
}

export async function getPot(potId: string) {
  try {
    const [rows] = await getPool().execute<any[]>("SELECT * FROM pots WHERE id = ? LIMIT 1", [potId]);
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

// Measurements
function toMySQLDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export type Threshold = {
  min?: number;
  max?: number;
};

export type Thresholds = Record<string, Threshold>;

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

export async function createMeasurement(potId: string, timestamp: string, value: number, type: string) {
  const id = randomUUID();
  const mysqlTimestamp = toMySQLDateTime(timestamp);
  try {
    const result = await getPool().execute("INSERT INTO measurements (id, pot_id, timestamp, value, type) VALUES (?, ?, ?, ?, ?)", [
      id,
      potId,
      mysqlTimestamp,
      value,
      type
    ]);
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }

    // Check thresholds and create warnings if breached
    const pot = await getPot(potId);
    if (pot && pot.thresholds) {
      let thresholds: Thresholds;
      try {
        thresholds = typeof pot.thresholds === 'string' ? JSON.parse(pot.thresholds) : pot.thresholds;
      } catch {
        thresholds = {};
      }

      const threshold = thresholds[type];
      if (threshold) {
        if (threshold.min !== undefined && value < threshold.min) {
          await createPotWarning(potId, type, 'min', threshold.min, value, id);
        }
        if (threshold.max !== undefined && value > threshold.max) {
          await createPotWarning(potId, type, 'max', threshold.max, value, id);
        }
      }
    }

    return { id, potId, timestamp, value, type };
  } catch (e) {
    return null;
  }
}

export async function listMeasurements(potId: string, timeStart?: string, timeEnd?: string) {
  const params: any[] = [potId];
  let sql = "SELECT * FROM measurements WHERE pot_id = ?";

  if (timeStart) {
    sql += " AND timestamp >= ?";
    params.push(timeStart);
  }
  if (timeEnd) {
    sql += " AND timestamp <= ?";
    params.push(timeEnd);
  }
  sql += " ORDER BY timestamp DESC LIMIT 10000";

  try {
    const [rows] = await getPool().execute<any[]>(sql, params);
    return rows;
  } catch (e) {
    return null;
  }
}

export async function getLatestMeasurements(potId: string) {
  const sql = `SELECT id, pot_id, timestamp, value, type, created_at FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY type ORDER BY timestamp DESC) as rn
    FROM measurements WHERE pot_id = ?
  ) ranked WHERE rn = 1`;

  try {
    const [rows] = await getPool().execute<any[]>(sql, [potId]);
    return rows;
  } catch (e) {
    return null;
  }
}

// Node errors
export async function reportNodeError(nodeId: string, code: string, message: string, severity: string, timestamp: string | null) {
  const id = randomUUID();
  const ts = toMySQLDateTime(timestamp || new Date().toISOString());
  try {
    const result = await getPool().execute(
      "INSERT INTO node_errors (id, node_id, code, message, severity, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [id, nodeId, code, message, severity || "medium", ts]
    );
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }
    return { id, nodeId, code, message, severity, timestamp: ts };
  } catch (e) {
    return null;
  }
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
  try {
    const [rows] = await getPool().execute<any[]>(sql, params);
    return rows;
  } catch (e) {
    return null;
  }
}

// Pot thresholds
export async function updatePotThresholds(potId: string, thresholds: Thresholds | null) {
  try {
    const result = await getPool().execute(
      "UPDATE pots SET thresholds = ? WHERE id = ?",
      [thresholds ? JSON.stringify(thresholds) : null, potId]
    );
    const header = result[0] as mysql.ResultSetHeader;
    return header && typeof header.affectedRows === "number" && header.affectedRows === 1;
  } catch (e) {
    return false;
  }
}

// Pot warnings
export async function createPotWarning(
  potId: string,
  measurementType: string,
  thresholdType: 'min' | 'max',
  thresholdValue: number,
  measuredValue: number,
  measurementId: string
) {
  const id = randomUUID();
  try {
    const result = await getPool().execute(
      "INSERT INTO pot_warnings (id, pot_id, measurement_type, threshold_type, threshold_value, measured_value, measurement_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, potId, measurementType, thresholdType, thresholdValue, measuredValue, measurementId]
    );
    const header = result[0] as mysql.ResultSetHeader;
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return null;
    }
    return { id, potId, measurementType, thresholdType, thresholdValue, measuredValue, measurementId };
  } catch (e) {
    return null;
  }
}

export async function listActiveWarnings(potId: string): Promise<PotWarning[] | null> {
  try {
    const [rows] = await getPool().execute<any[]>(
      "SELECT id, pot_id, measurement_type, threshold_type, threshold_value, measured_value, measurement_id, created_at, dismissed_at FROM pot_warnings WHERE pot_id = ? AND dismissed_at IS NULL ORDER BY created_at DESC",
      [potId]
    );
    return rows.map(row => ({
      id: row.id,
      potId: row.pot_id,
      measurementType: row.measurement_type,
      thresholdType: row.threshold_type,
      thresholdValue: row.threshold_value,
      measuredValue: row.measured_value,
      measurementId: row.measurement_id,
      createdAt: row.created_at,
      dismissedAt: row.dismissed_at
    }));
  } catch (e) {
    return null;
  }
}

export async function listActiveWarningsByNode(nodeId: string): Promise<PotWarning[] | null> {
  try {
    const [rows] = await getPool().execute<any[]>(
      `SELECT pw.id, pw.pot_id, pw.measurement_type, pw.threshold_type, pw.threshold_value, pw.measured_value, pw.measurement_id, pw.created_at, pw.dismissed_at
       FROM pot_warnings pw
       JOIN pots p ON p.id = pw.pot_id
       WHERE p.node_id = ? AND pw.dismissed_at IS NULL
       ORDER BY pw.created_at DESC`,
      [nodeId]
    );
    return rows.map(row => ({
      id: row.id,
      potId: row.pot_id,
      measurementType: row.measurement_type,
      thresholdType: row.threshold_type,
      thresholdValue: row.threshold_value,
      measuredValue: row.measured_value,
      measurementId: row.measurement_id,
      createdAt: row.created_at,
      dismissedAt: row.dismissed_at
    }));
  } catch (e) {
    return null;
  }
}

export async function dismissWarning(warningId: string): Promise<boolean> {
  try {
    const result = await getPool().execute(
      "UPDATE pot_warnings SET dismissed_at = NOW() WHERE id = ? AND dismissed_at IS NULL",
      [warningId]
    );
    const header = result[0] as mysql.ResultSetHeader;
    return header && typeof header.affectedRows === "number" && header.affectedRows === 1;
  } catch (e) {
    return false;
  }
}

export async function dismissAllWarnings(potId: string): Promise<boolean> {
  try {
    const result = await getPool().execute(
      "UPDATE pot_warnings SET dismissed_at = NOW() WHERE pot_id = ? AND dismissed_at IS NULL",
      [potId]
    );
    const header = result[0] as mysql.ResultSetHeader;
    return header && typeof header.affectedRows === "number" && header.affectedRows >= 0;
  } catch (e) {
    return false;
  }
}

export async function getWarning(warningId: string): Promise<PotWarning | null> {
  try {
    const [rows] = await getPool().execute<any[]>(
      "SELECT id, pot_id, measurement_type, threshold_type, threshold_value, measured_value, measurement_id, created_at, dismissed_at FROM pot_warnings WHERE id = ? LIMIT 1",
      [warningId]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: row.id,
      potId: row.pot_id,
      measurementType: row.measurement_type,
      thresholdType: row.threshold_type,
      thresholdValue: row.threshold_value,
      measuredValue: row.measured_value,
      measurementId: row.measurement_id,
      createdAt: row.created_at,
      dismissedAt: row.dismissed_at
    };
  } catch (e) {
    return null;
  }
}
