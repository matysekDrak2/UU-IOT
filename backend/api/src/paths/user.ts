import express from "express";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { randomUUID } from "crypto";
import * as dao from "../dao";
import * as crypto from "node:crypto";

const router = express.Router();

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// validator factory (local to user routes)
function validateSchema(schema: object) {
  const validate = ajv.compile(schema);
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const valid = validate(req.body);
    if (!valid) return res.status(400).json({ error: "InvalidInput", details: validate.errors });
    next();
  };
}

// simple user auth (local copy)
async function requireUserAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const h = req.header("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return res.status(401).json({ error: "Unauthorized", message: "Missing token" });
  const token = m[1];
  const user = await dao.findUserByToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
  (req as any).user = user;
  next();
}

/* Schemas for user endpoints */
const userCreateSchema = {
  type: "object",
  properties: {
    username: { type: "string", minLength: 3, maxLength: 30 },
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 64 } // expecting sha512
  },
  required: ["username", "email", "password"],
  additionalProperties: false
};

const userLoginSchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 64 }
  },
  required: ["email", "password"],
  additionalProperties: false
};

/* User endpoints moved here */

// create user
router.put("/", validateSchema(userCreateSchema), async (req, res) => {
  const { username, email, password } = req.body;
  const existing = await dao.findUserByEmail(email);
  if (existing) return res.status(400).json({ error: "CreationFailed", message: "Email already used" });
  const user = await dao.createUser(username, email, password);
  if (!user) return res.status(500).json({ error: "CreationFailed", message: "Could not create user" });
  res.status(201).json(user);
});

// login -> create token (simple token = uuid, expires in 30d)
router.post("/", validateSchema(userLoginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await dao.findUserByEmail(email);
  if (!user || !crypto.timingSafeEqual(user.password_hash, password)) return res.status(401).json({ error: "AuthenticationFailed", message: "Invalid credentials" });
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  await dao.storeUserToken(user.id, token, expiresAt);
  res.status(200).json({ userId: user.id, token, expiration: expiresAt });
});

// get user info
router.get("/", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({ username: user.username, email: user.email });
});

// patch user
router.patch("/", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const { username, email, password } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (username) { updates.push("username = ?"); params.push(username); }
  if (email) { updates.push("email = ?"); params.push(email); }
  if (password) { updates.push("password_hash = ?"); params.push(password); }
  if (updates.length === 0) return res.status(400).json({ error: "InvalidInput", message: "No updatable fields provided" });

  try {
    const result = await dao.getPool().execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [...params, user.id]);
    const header = (result as any)[0] as { affectedRows?: number };
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return res.status(500).json({ error: "UpdateFailed", message: "User update failed" });
    }
  } catch (err) {
    return res.status(500).json({ error: "UpdateFailed", message: "Database error" });
  }

  try {
    const [rows] = await dao.getPool().execute<any[]>("SELECT id, username, email FROM users WHERE id = ? LIMIT 1", [user.id]);
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "ReadFailed", message: "Could not read updated user" });
  }
});

// delete user
router.delete("/", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const result = await dao.getPool().execute("DELETE FROM users WHERE id = ?", [user.id]);
    const header = (result as any)[0] as { affectedRows?: number };
    if (!header || typeof header.affectedRows !== "number" || header.affectedRows !== 1) {
      return res.status(500).json({ error: "DeleteFailed", message: "Could not delete user" });
    }
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "DeleteFailed", message: "Database error" });
  }
});

export default router;
