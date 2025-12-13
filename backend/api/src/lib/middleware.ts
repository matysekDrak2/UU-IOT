import Ajv from "ajv";
import addFormats from "ajv-formats";
import express from "express";
import * as dao from "../dao";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export function validateSchema(schema: object) {
  const validate = ajv.compile(schema);
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const valid = validate(req.body);
    if (!valid) return res.status(400).json({ error: "InvalidInput", details: validate.errors });
    next();
  };
}

export async function requireUserAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const h = req.header("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return res.status(401).json({ error: "Unauthorized", message: "Missing token" });
  const token = m[1];
  const user = await dao.findUserByToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
  (req as any).user = user;
  next();
}

export async function requireNodeAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const h = req.header("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return res.status(401).json({ error: "Unauthorized", message: "Missing node token" });
  const token = m[1];
  const node = await dao.findNodeByToken(token);
  if (!node) return res.status(401).json({ error: "Unauthorized", message: "Invalid node token" });
  (req as any).node = node;
  next();
}
