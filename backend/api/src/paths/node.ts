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
router.put("/node", async (req, res) => {
  const nodeId = randomUUID();
  const token = randomUUID();
  await dao.getPool().execute("INSERT INTO nodes (id, user_id, name, note, status, created_at) VALUES (?, NULL, ?, '', 'unknown', NOW())", [nodeId, `node-${nodeId}`]);
  await dao.createNodeToken(nodeId, token);
  res.status(201).json({ nodeId, token });
});

// register node for user
router.post("/node", requireUserAuth, validateSchema(nodeCreateSchema), async (req, res) => {
  const user = (req as any).user;
  const { name, note, status, dataArchiving } = req.body;
  const node = await dao.createNode(user.id, name, note || "", status || "unknown", dataArchiving || null);
  res.status(201).json(node);
});

// get list nodes for user
router.get("/node", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const [rows] = await dao.getPool().execute<any[]>("SELECT * FROM nodes WHERE user_id = ?", [user.id]);
  res.json(rows);
});

// node patch
router.patch("/node/:nodeId", requireUserAuth, validateSchema(nodeCreateSchema), async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const fields: string[] = []; const params: any[] = [];
  if (req.body.name) { fields.push("name = ?"); params.push(req.body.name); }
  if (req.body.note !== undefined) { fields.push("note = ?"); params.push(req.body.note); }
  if (req.body.dataArchiving !== undefined) { fields.push("data_archiving = ?"); params.push(req.body.dataArchiving); }
  if (fields.length === 0) return res.status(400).json({ error: "InvalidInput", message: "No updatable fields" });
  await dao.getPool().execute(`UPDATE nodes SET ${fields.join(", ")} WHERE id = ?`, [...params, nodeId]);
  const [rows] = await dao.getPool().execute<any[]>("SELECT * FROM nodes WHERE id = ? LIMIT 1", [nodeId]);
  res.json(rows[0]);
});

// delete node
router.delete("/node/:nodeId", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  await dao.getPool().execute("DELETE FROM nodes WHERE id = ?", [nodeId]);
  res.status(204).send();
});

// node heartbeat: authenticated by node token, return node and its pots
router.post("/node/:nodeId/heartbeat", requireNodeAuth, async (req, res) => {
  const node = (req as any).node;
  if (node.id !== req.params.nodeId) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const pots = await dao.listPotsByNode(node.id);
  res.json({ node, pots });
});

// node reports error
router.post("/node/:nodeId/error", requireNodeAuth, validateSchema(nodeErrorSchema), async (req, res) => {
  const node = (req as any).node;
  if (node.id !== req.params.nodeId) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const e = await dao.reportNodeError(node.id, req.body.code, req.body.message, req.body.severity || "medium", req.body.timestamp || null);
  res.status(201).json(e);
});

// user lists errors for their nodes
router.get("/node/error", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const nodeId = req.query.nodeId as string | undefined;
  const timeStart = req.query.timeStart as string | undefined;
  const timeEnd = req.query.timeEnd as string | undefined;
  const list = await dao.listNodeErrorsByUser(user.id, nodeId, timeStart, timeEnd);
  res.json(list);
});

export default router;
