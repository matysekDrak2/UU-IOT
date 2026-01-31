import express from "express";
import { randomUUID, randomBytes } from "crypto";
import * as dao from "../dao";
import { validateSchema, requireUserAuth, requireNodeAuth } from "../lib/middleware";

const router = express.Router();

const nodeCreateSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 50, minLength: 3 },
    note: { type: "string", maxLength: 200 },
    status: { type: "string", enum: ["active", "inactive", "unknown"] },
    dataArchiving: { type: "string" }
  },
  required: ["name"],
  additionalProperties: false
};
const heartbeatSchema = {
  type: "object",
  properties: {
    timestamp: { type: "string", format: "date-time" },
    uptimeSec: { type: "integer", minimum: 0 },
    rssi: { type: "integer" }
  },
  required: ["timestamp", "uptimeSec"],
  additionalProperties: false
};


const nodeUpdateSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 50, minLength: 3 },
    note: { type: "string", maxLength: 200 },
    status: { type: "string", enum: ["active", "inactive", "unknown"] },
    dataArchiving: { type: "string" }
  },
  additionalProperties: false
};

const nodeClaimSchema = {
  type: "object",
  properties: {
    token: { type: "string", minLength: 16, maxLength: 200 }
  },
  required: ["token"],
  additionalProperties: false
};

const nodeErrorSchema = {
  type: "object",
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    timestamp: { type: "string", format: "date-time" }
  },
  required: ["code", "message"],
  additionalProperties: false
};


/**
 * PUT /api/V1/node
 * Device registration - returns node token
 */
router.put("/", async (req, res) => {
  const { userId, name } = req.body ?? {};

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "InvalidInput", message: "userId is required" });
  }

  // ověř, že user existuje
  const [users] = await dao.getPool().execute<any[]>(
    "SELECT id FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  if (!users || users.length === 0) {
    return res.status(404).json({ error: "NotFound", message: "User not found" });
  }

  const nodeId = randomUUID();
  const token = randomBytes(32).toString("hex"); // 64 hex
  const nodeName = (typeof name === "string" && name.length >= 3) ? name : `node-${nodeId}`;

  // vytvoř node a přiřaď userovi
  await dao.getPool().execute(
    "INSERT INTO nodes (id, user_id, name, note, status, created_at) VALUES (?, ?, ?, '', 'unknown', NOW())",
    [nodeId, userId, nodeName]
  );

  // vytvoř node token
  await dao.createNodeToken(nodeId, token);

  // default pot pro node (ať má ESP kam posílat)
  const potId = randomUUID();
  await dao.getPool().execute(
    "INSERT INTO pots (id, node_id, name, note, status, reporting_time, created_at) VALUES (?, ?, ?, '', 'active', NULL, NOW())",
    [potId, nodeId, "pot-1"]
  );

  return res.status(201).json({ nodeId, token, potId });
});


/**
 * POST /api/V1/node
 * User creates node
 */
router.post("/", requireUserAuth, validateSchema(nodeCreateSchema), async (req, res) => {
  const user = (req as any).user;
  const { name, note, status, dataArchiving } = req.body;

  const node = await dao.createNode(
    user.id,
    name,
    note || "",
    status || "unknown",
    dataArchiving || null
  );

  return res.status(201).json(node);
});

/**
 * GET /api/V1/node
 * List nodes for user
 */
router.get("/", requireUserAuth, async (req, res) => {
  const user = (req as any).user;

  const [rows] = await dao.getPool().execute<any[]>(
    "SELECT * FROM nodes WHERE user_id = ?",
    [user.id]
  );

  return res.json(rows);
});

/**
 * GET /api/V1/node/error
 * MUST be before GET "/:nodeId"
 */
router.get("/error", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const nodeId = req.query.nodeId as string | undefined;
  const timeStart = req.query.timeStart as string | undefined;
  const timeEnd = req.query.timeEnd as string | undefined;

  const list = await dao.listNodeErrorsByUser(user.id, nodeId, timeStart, timeEnd);
  return res.json(list);
});

/**
 * GET /api/V1/node/:nodeId
 * Node detail (frontend NodeDetail)
 */
router.get("/:nodeId", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;

  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) {
    return res.status(404).json({ error: "NotFound", message: "Node not found" });
  }

  return res.json(node);
});

/**
 * PATCH /api/V1/node/:nodeId
 */
router.patch("/:nodeId", requireUserAuth, validateSchema(nodeUpdateSchema), async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;

  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) {
    return res.status(404).json({ error: "NotFound", message: "Node not found" });
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (req.body.name !== undefined) { fields.push("name = ?"); params.push(req.body.name); }
  if (req.body.note !== undefined) { fields.push("note = ?"); params.push(req.body.note); }
  if (req.body.status !== undefined) { fields.push("status = ?"); params.push(req.body.status); }
  if (req.body.dataArchiving !== undefined) { fields.push("data_archiving = ?"); params.push(req.body.dataArchiving); }

  if (fields.length === 0) {
    return res.status(400).json({ error: "InvalidInput", message: "No updatable fields" });
  }

  await dao.getPool().execute(
    `UPDATE nodes SET ${fields.join(", ")} WHERE id = ?`,
    [...params, nodeId]
  );

  const [rows] = await dao.getPool().execute<any[]>(
    "SELECT * FROM nodes WHERE id = ? LIMIT 1",
    [nodeId]
  );

  return res.json(rows[0]);
});

/**
 * DELETE /api/V1/node/:nodeId
 */
router.delete("/:nodeId", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;

  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) {
    return res.status(404).json({ error: "NotFound", message: "Node not found" });
  }

  await dao.getPool().execute("DELETE FROM nodes WHERE id = ?", [nodeId]);
  return res.status(204).send();
});

/**
 * POST /api/V1/node/:nodeId/heartbeat
 */
router.post("/heartbeat", requireNodeAuth, validateSchema(heartbeatSchema), async (req, res) => {
  const node = (req as any).node;

  console.log("[HEARTBEAT]", {
    nodeId: node?.id,
    timestamp: req.body.timestamp,
    uptimeSec: req.body.uptimeSec,
    rssi: req.body.rssi
  });

  return res.status(204).send();
});


/**
 * POST /api/V1/node/:nodeId/error
 */
router.post("/:nodeId/error", requireNodeAuth, validateSchema(nodeErrorSchema), async (req, res) => {
  const node = (req as any).node;

  if (!node || node.id !== req.params.nodeId) {
    return res.status(404).json({ error: "NotFound", message: "Node not found" });
  }

  const e = await dao.reportNodeError(
    node.id,
    req.body.code,
    req.body.message,
    req.body.severity || "medium",
    req.body.timestamp || null
  );

  return res.status(201).json(e);
});

/**
 * POST /api/V1/node/:nodeId/claim
 */
router.post("/:nodeId/claim", requireUserAuth, validateSchema(nodeClaimSchema), async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const { token } = req.body;

  const tokenNode = await dao.findNodeByToken(token);
  if (!tokenNode || tokenNode.id !== nodeId) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid node token for this nodeId" });
  }

  if (tokenNode.user_id && tokenNode.user_id !== user.id) {
    return res.status(409).json({ error: "Conflict", message: "Node is already claimed by another user" });
  }

  await dao.getPool().execute("UPDATE nodes SET user_id = ? WHERE id = ?", [user.id, nodeId]);

  const [rows] = await dao.getPool().execute<any[]>(
    "SELECT * FROM nodes WHERE id = ? LIMIT 1",
    [nodeId]
  );

  return res.status(200).json(rows[0] || { nodeId, userId: user.id });
});

export default router;
