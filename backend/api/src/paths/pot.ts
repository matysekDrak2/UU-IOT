import express from "express";
import * as dao from "../dao";
import { validateSchema, requireUserAuth, requireNodeAuth } from "../lib/middleware";

const router = express.Router();

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

const measurementSchema = {
  type: "object",
  properties: {
    timestamp: { type: "string", format: "date-time" },
    value: { type: "number", minimum: 0, maximum: 100 },
    type: { type: "string" }
  },
  required: ["timestamp", "value", "type"],
  additionalProperties: false
};

// create pot under node (user-auth)
router.post("/node/:nodeId/pot", requireUserAuth, validateSchema(potCreateSchema), async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const p = await dao.createPot(nodeId, req.body.name, req.body.note || "", req.body.status || "unknown", req.body.reportingTime || null);
  res.status(201).json(p);
});

// list pots under node
router.get("/node/:nodeId/pot", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { nodeId } = req.params;
  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Node not found" });
  const pots = await dao.listPotsByNode(nodeId);
  res.json(pots);
});

// get pot
router.get("/pot/:potId", requireUserAuth, async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = await dao.findNodeById(pot.node_id);
  if (!node) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const user = (req as any).user;
  if (node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  res.json(pot);
});

// patch pot
router.patch("/pot/:potId", requireUserAuth, validateSchema(potCreateSchema), async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = await dao.findNodeById(pot.node_id);
  const user = (req as any).user;
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const fields: string[] = []; const params: any[] = [];
  if (req.body.name) { fields.push("name = ?"); params.push(req.body.name); }
  if (req.body.note !== undefined) { fields.push("note = ?"); params.push(req.body.note); }
  if (req.body.reportingTime !== undefined) { fields.push("reporting_time = ?"); params.push(req.body.reportingTime); }
  if (fields.length === 0) return res.status(400).json({ error: "InvalidInput", message: "No updatable fields" });
  await dao.getPool().execute(`UPDATE pots SET ${fields.join(", ")} WHERE id = ?`, [...params, req.params.potId]);
  const updated = await dao.getPot(req.params.potId);
  res.json(updated);
});

// delete pot
router.delete("/pot/:potId", requireUserAuth, async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = await dao.findNodeById(pot.node_id);
  const user = (req as any).user;
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  await dao.getPool().execute("DELETE FROM pots WHERE id = ?", [req.params.potId]);
  res.status(204).send();
});

// node-auth measurement create
router.put("/pot/:potId/measurement", requireNodeAuth, validateSchema(measurementSchema), async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = (req as any).node;
  if (pot.node_id !== node.id) return res.status(404).json({ error: "NotFound", message: "Pot not owned by node" });
  const m = await dao.createMeasurement(req.params.potId, req.body.timestamp, req.body.value, req.body.type);
  res.status(201).json(m);
});

// list measurements (user)
router.get("/pot/:potId/measurement", requireUserAuth, async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = await dao.findNodeById(pot.node_id);
  const user = (req as any).user;
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const data = await dao.listMeasurements(req.params.potId, req.query.timeStart as string | undefined, req.query.timeEnd as string | undefined);
  res.json(data);
});

export default router;
