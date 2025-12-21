import express from "express";
import { randomUUID } from "crypto";
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

const nodePatchSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 50, minLength: 3 },
    note: { type: "string", maxLength: 200 },
    dataArchiving: { type: "string" }
  },
  additionalProperties: false
  // No "required" array
};

const potCreateSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 50, minLength: 3 },
    note: { type: "string", maxLength: 200 },
    status: { type: "string", enum: ["active", "inactive", "unknown"] },
    reportingTime: { type: "string" }
  },
  required: ["name"],
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

// device registration - returns node token
router.put("/", async (req, res) => {
  const nodeId = randomUUID();
  const token = randomUUID();
  try {
    const ins = await dao.getPool().execute("INSERT INTO nodes (id, user_id, name, note, status, created_at) VALUES (?, NULL, ?, '', 'unknown', NOW())", [nodeId, `node-${nodeId}`]);
    const header = (ins as any)[0] as { affectedRows?: number };
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return res.status(500).json({ error: "CreationFailed", message: "Could not register node" });
    }
  } catch (err) {
    return res.status(500).json({ error: "CreationFailed", message: "Database error" });
  }

  const t = await dao.createNodeToken(nodeId, token);
  if (!t) {
    // token creation failed; report error
    return res.status(500).json({ error: "CreationFailed", message: "Could not create node token" });
  }
  res.status(201).json({ nodeId, token });
});

// register node for user
router.post("/", requireUserAuth, validateSchema(nodeCreateSchema), async (req, res) => {
  const user = (req as any).user;
  const { name, note, status, dataArchiving } = req.body;
  const node = await dao.createNode(user.id, name, note || "", status || "unknown", dataArchiving || null);
  if (!node) return res.status(500).json({ error: "CreationFailed", message: "Could not create node" });
  res.status(201).json(node);
});

// get list nodes for user
router.get("/", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const [rows] = await dao.getPool().execute<any[]>("SELECT * FROM nodes WHERE user_id = ?", [user.id]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "ReadFailed", message: "Could not list nodes" });
  }
});

// node patch
router.patch("/:nodeId", requireUserAuth, validateSchema(nodePatchSchema), async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const fields: string[] = []; const params: any[] = [];
  if (req.body.name) { fields.push("name = ?"); params.push(req.body.name); }
  if (req.body.note !== undefined) { fields.push("note = ?"); params.push(req.body.note); }
  if (req.body.dataArchiving !== undefined) { fields.push("data_archiving = ?"); params.push(req.body.dataArchiving); }
  if (fields.length === 0) return res.status(400).json({ error: "InvalidInput", message: "No updatable fields" });

  try {
    const result = await dao.getPool().execute(`UPDATE nodes SET ${fields.join(", ")} WHERE id = ?`, [...params, nodeId]);
    const header = (result as any)[0] as { affectedRows?: number };
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return res.status(500).json({ error: "UpdateFailed", message: "Could not update node" });
    }
  } catch (err) {
    return res.status(500).json({ error: "UpdateFailed", message: "Database error" });
  }

  try {
    const [rows] = await dao.getPool().execute<any[]>("SELECT * FROM nodes WHERE id = ? LIMIT 1", [nodeId]);
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "ReadFailed", message: "Could not read node" });
  }
});

// delete node
router.delete("/:nodeId", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  try {
    const result = await dao.getPool().execute("DELETE FROM nodes WHERE id = ?", [nodeId]);
    const header = (result as any)[0] as { affectedRows?: number };
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return res.status(500).json({ error: "DeleteFailed", message: "Could not delete node" });
    }
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "DeleteFailed", message: "Database error" });
  }
});

// create pot under node (user-auth)
router.post("/:nodeId/pot", requireUserAuth, validateSchema(potCreateSchema), async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const p = await dao.createPot(nodeId, req.body.name, req.body.note || "", req.body.status || "unknown", req.body.reportingTime || null);
  if (!p) return res.status(500).json({ error: "CreationFailed", message: "Could not create pot" });
  res.status(201).json(p);
});

// list pots under node
router.get("/:nodeId/pot", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const pots = await dao.listPotsByNode(nodeId);
  if (pots === null) return res.status(500).json({ error: "ReadFailed", message: "Could not list pots" });
  res.json(pots);
});

// node heartbeat: authenticated by node token, return node and its pots
router.post("/:nodeId/heartbeat", requireNodeAuth, async (req, res) => {
  const node = (req as any).node;
  if (node.id !== req.params.nodeId) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const pots = await dao.listPotsByNode(node.id);
  if (pots === null) return res.status(500).json({ error: "ReadFailed", message: "Could not list pots" });
  res.json({ node, pots });
});

// node reports error
router.post("/:nodeId/error", requireNodeAuth, validateSchema(nodeErrorSchema), async (req, res) => {
  const node = (req as any).node;
  if (node.id !== req.params.nodeId) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const e = await dao.reportNodeError(node.id, req.body.code, req.body.message, req.body.severity || "medium", req.body.timestamp || null);
  if (!e) return res.status(500).json({ error: "CreationFailed", message: "Could not record node error" });
  res.status(201).json(e);
});

// user lists errors for their nodes
router.get("/error", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const nodeId = req.query.nodeId as string | undefined;
  const timeStart = req.query.timeStart as string | undefined;
  const timeEnd = req.query.timeEnd as string | undefined;
  const list = await dao.listNodeErrorsByUser(user.id, nodeId, timeStart, timeEnd);
  if (list === null) return res.status(500).json({ error: "ReadFailed", message: "Could not list node errors" });
  res.json(list);
});

// get node details
router.get("/:nodeId", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  res.json(node);
});

export default router;
