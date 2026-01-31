import express from "express";
import * as dao from "../dao";
import { validateSchema, requireUserAuth, requireNodeAuth } from "../lib/middleware";

const router = express.Router();

const potCreateSchema = {
  type: "object",
  properties: {
    nodeId: { type: "string", format: "uuid" },
    name: { type: "string", maxLength: 50, minLength: 3 },
    note: { type: "string", maxLength: 200 },
    status: { type: "string", enum: ["active", "inactive", "unknown"] },
    reportingTime: { type: "string" }
  },
  required: ["nodeId", "name"],
  additionalProperties: false
};

const potUpdateSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 50, minLength: 3 },
    note: { type: "string", maxLength: 200 },
    status: { type: "string", enum: ["active", "inactive", "unknown"] },
    reportingTime: { type: "string" }
  },
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


// create pot
router.post("/", requireUserAuth, validateSchema(potCreateSchema), async (req, res) => {
  const user = (req as any).user;
  const { nodeId, name, note, status, reportingTime } = req.body;

  const node = await dao.findNodeById(nodeId);
  if (!node || node.user_id !== user.id) {
    return res.status(404).json({ error: "NotFound", message: "Node not found" });
  }

  const pot = await dao.createPot(nodeId, name, note || null, status || "unknown", reportingTime || null);
  if (!pot) {
    return res.status(500).json({ error: "CreationFailed", message: "Could not create pot" });
  }

  return res.status(201).json(pot);
});

// get pot
router.get("/:potId", requireUserAuth, async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = await dao.findNodeById(pot.node_id);
  if (!node) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const user = (req as any).user;
  if (node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  res.json(pot);
});

// patch pot
router.patch("/:potId", requireUserAuth, validateSchema(potUpdateSchema), async (req, res) => {
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

  try {
    const result = await dao.getPool().execute(`UPDATE pots SET ${fields.join(", ")} WHERE id = ?`, [...params, req.params.potId]);
    const header = (result as any)[0] as { affectedRows?: number };
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return res.status(500).json({ error: "UpdateFailed", message: "Could not update pot" });
    }
  } catch (err) {
    return res.status(500).json({ error: "UpdateFailed", message: "Database error" });
  }

  const updated = await dao.getPot(req.params.potId);
  if (!updated) return res.status(500).json({ error: "ReadFailed", message: "Could not read updated pot" });
  res.json(updated);
});

// delete pot
router.delete("/:potId", requireUserAuth, async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = await dao.findNodeById(pot.node_id);
  const user = (req as any).user;
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  try {
    const result = await dao.getPool().execute("DELETE FROM pots WHERE id = ?", [req.params.potId]);
    const header = (result as any)[0] as { affectedRows?: number };
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return res.status(500).json({ error: "DeleteFailed", message: "Could not delete pot" });
    }
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "DeleteFailed", message: "Database error" });
  }
});

// node-auth measurement create
router.put("/:potId/measurement", requireNodeAuth, validateSchema(measurementSchema), async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = (req as any).node;
  if (pot.node_id !== node.id) return res.status(404).json({ error: "NotFound", message: "Pot not owned by node" });
  const m = await dao.createMeasurement(req.params.potId, req.body.timestamp, req.body.value, req.body.type);
  if (!m) return res.status(500).json({ error: "CreationFailed", message: "Could not create measurement" });
  res.status(201).json(m);
});

// list measurements (user)
router.get("/:potId/measurement", requireUserAuth, async (req, res) => {
  const pot = await dao.getPot(req.params.potId);
  if (!pot) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const node = await dao.findNodeById(pot.node_id);
  const user = (req as any).user;
  if (!node || node.user_id !== user.id) return res.status(404).json({ error: "NotFound", message: "Pot not found" });
  const data = await dao.listMeasurements(req.params.potId, req.query.timeStart as string | undefined, req.query.timeEnd as string | undefined);
  if (data === null) return res.status(500).json({ error: "ReadFailed", message: "Could not list measurements" });
  res.json(data);
});

export default router;
