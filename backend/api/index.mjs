#!/usr/bin/env node

// javascript
// Minimal JS API mapped to your OpenAPI. In-memory stores for demo only.

import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const app = express();
app.use(express.json());

// Add this middleware so requests to /api/V1/... are routed to the existing handlers.
// It strips the leading '/api/V1' from req.url so current app.<method> routes continue to work.
app.use((req, res, next) => {
  const prefix = '/api/V1';
  if (req.path.startsWith(prefix)) {
    // rewrite url so downstream route matching sees the path without the prefix
    req.url = req.url.slice(prefix.length) || '/';
  }
  next();
});

/* --- Ajv validator setup (new) --- */
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

function makeValidator(schema) {
  return ajv.compile(schema);
}

function validateSchema(schema) {
  const validator = makeValidator(schema);
  return (req, res, next) => {
    const valid = validator(req.body);
    if (valid) return next();
    const errors = (validator.errors || []).map(e => ({
      path: e.instancePath || e.schemaPath,
      message: e.message
    }));
    return res.status(400).json({ error: 'InvalidInput', message: 'Request body validation failed', details: errors });
  };
}

/* --- Schemas (new) --- */
const userCreateSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 30 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 } // accept plain or hash; enforce non-empty
  },
  required: ['username', 'email', 'password'],
  additionalProperties: false
};

const userLoginSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 }
  },
  required: ['email', 'password'],
  additionalProperties: false
};

const nodeClaimSchema = {
  type: 'object',
  properties: {
    token: { type: 'string', minLength: 1 }
  },
  required: ['token'],
  additionalProperties: false
};


const nodeCreateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 50 },
    note: { type: 'string' },
    dataArchiving: { type: 'string' },
    status: { type: 'string' }
  },
  required: ['name'],
  additionalProperties: false
};

const nodePatchSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 50 },
    note: { type: 'string' },
    dataArchiving: { type: 'string' }
  },
  required: [],
  additionalProperties: false
};

const potCreateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 50 },
    note: { type: 'string' },
    status: { type: 'string' }
  },
  required: ['name'],
  additionalProperties: false
};

const potPatchSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 50 },
    note: { type: 'string' }
  },
  required: [],
  additionalProperties: false
};

const measurementSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'string' },
    value: { type: 'number', minimum: 0, maximum: 100 },
    type: { type: 'string' }
  },
  required: ['timestamp', 'value', 'type'],
  additionalProperties: false
};

/* --- In-memory "DB" --- */
const users = new Map(); // userId -> { id, username, email, passwordHash }
const userTokens = new Map(); // tokenHash -> { userId, expires }
const nodes = new Map(); // nodeId -> { id, userId, name, note, status, dataArchiving }
const nodeTokens = new Map(); // tokenHash -> { nodeId, expires }
const pots = new Map(); // potId -> { id, nodeId, name, note, status }
const measurements = []; // array of { id, potId, timestamp, value, type }

/* --- Helpers --- */
const hash = (s) => crypto.createHash('sha512').update(s).digest('hex');
const nowPlusDays = (days) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

function generateRawToken() {
    return crypto.randomBytes(32).toString('hex');
}

function parseBearer(header) {
    if (!header) return null;
    const m = header.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}

/* --- Auth middleware --- */
// ApiKeyAuth: user tokens
function requireUserAuth(req, res, next) {
    const raw = parseBearer(req.header('Authorization'));
    if (!raw) return res.status(401).json({ error: 'Unauthorized', message: 'Missing token' });
    const h = hash(raw);
    const entry = userTokens.get(h);
    if (!entry || (entry.expires && new Date(entry.expires) < new Date())) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
    req.userId = entry.userId;
    next();
}

// ApiKeyAuthNode: node tokens (device writes)
function requireNodeAuth(req, res, next) {
    const raw = parseBearer(req.header('Authorization'));
    if (!raw) return res.status(401).json({ error: 'Unauthorized', message: 'Missing node token' });
    const h = hash(raw);
    const entry = nodeTokens.get(h);
    if (!entry || (entry.expires && new Date(entry.expires) < new Date())) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired node token' });
    }
    req.nodeId = entry.nodeId;
    next();
}

/* --- User endpoints --- */
// PUT /user  - create user
app.put('/user', validateSchema(userCreateSchema), (req, res) => {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'InvalidInput', message: 'username, email and password required' });
    }
    // simple uniqueness check
    for (const u of users.values()) {
        if (u.email === email) return res.status(400).json({ error: 'InvalidInput', message: 'Email already exists' });
    }
    const id = uuidv4();
    const passwordHash = hash(password);
    const user = { id, username, email, passwordHash };
    users.set(id, user);
    return res.status(200).json({ id, username, email });
});

// POST /user - login, return raw token (user token)
app.post('/user', validateSchema(userLoginSchema), (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'InvalidInput', message: 'email and password required' });
    const user = Array.from(users.values()).find((u) => u.email === email);
    if (!user || user.passwordHash !== hash(password)) {
        return res.status(401).json({ error: 'AuthenticationFailed', message: 'Email or password is incorrect.' });
    }
    const rawToken = generateRawToken();
    const tokenHash = hash(rawToken);
    const expires = nowPlusDays(30);
    userTokens.set(tokenHash, { userId: user.id, expires });
    return res.status(200).json({ userId: user.id, token: rawToken, expiration: expires });
});

// GET /user - get user info
app.get('/user', requireUserAuth, (req, res) => {
    const u = users.get(req.userId);
    if (!u) return res.status(404).json({ error: 'NotFound', message: 'User not found' });
    return res.status(200).json({ username: u.username, email: u.email });
});

/* --- Node endpoints --- */
// PUT /node - (device creation) -- keep as stub returning a token-like response (per docs it is not for user)
app.put('/node', (req, res) => {
    // This endpoint was marked "Not intended for user Access" in docs; create stub node and return NodeToken-like response
    const id = uuidv4();
    nodes.set(id, { id, userId: null, name: 'unnamed', note: '', status: 'unknown', dataArchiving: 'P14D' });
    const raw = generateRawToken();
    const tokenHash = hash(raw);
    nodeTokens.set(tokenHash, { nodeId: id, expires: nowPlusDays(365) });
    return res.status(200).json({ nodeId: id, token: raw });
});

// POST /node/:nodeId/claim - user claims a device-created node using node token
app.post('/node/:nodeId/claim', requireUserAuth, validateSchema(nodeClaimSchema), (req, res) => {
  const { nodeId } = req.params;
  const { token } = req.body || {};

  // token is RAW node token; nodeTokens map stores hash(token) -> { nodeId, expires }
  const tokenHash = hash(token);
  const entry = nodeTokens.get(tokenHash);

  if (!entry || entry.nodeId !== nodeId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid node token for this nodeId' });
  }

  const node = nodes.get(nodeId);
  if (!node) {
    return res.status(404).json({ error: 'NotFound', message: 'Node not found.' });
  }

  // if already claimed by someone else
  if (node.userId && node.userId !== req.userId) {
    return res.status(409).json({ error: 'Conflict', message: 'Node is already claimed by another user' });
  }

  node.userId = req.userId;
  nodes.set(nodeId, node);

  return res.status(200).json(node);
});


// GET /node - list nodes owned by authenticated user
app.get('/node', requireUserAuth, (req, res) => {
    const owned = Array.from(nodes.values()).filter((n) => n.userId === req.userId);
    return res.status(200).json(owned);
});

// POST /node - register node for authenticated user
app.post('/node', requireUserAuth, validateSchema(nodeCreateSchema), (req, res) => {
    const { name, note, dataArchiving, status } = req.body || {};
    if (!name) return res.status(400).json({ error: 'InvalidInput', message: 'name required' });
    const id = uuidv4();
    const node = { id, userId: req.userId, name, note: note || '', status: status || 'unknown', dataArchiving: dataArchiving || 'P14D' };
    nodes.set(id, node);
    return res.status(201).json(node);
});

// POST /node/:nodeId/token - create long-lived node token (user-authenticated) and return raw once
app.post('/node/:nodeId/token', requireUserAuth, (req, res) => {
    const node = nodes.get(req.params.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Not found or not owned by user' });
    const raw = generateRawToken();
    const tokenHash = hash(raw);
    const expires = nowPlusDays(365);
    nodeTokens.set(tokenHash, { nodeId: node.id, expires });
    return res.status(201).json({ nodeId: node.id, token: raw, expiration: expires });
});

// Node by id endpoints (GET, PATCH, DELETE) - user auth + ownership
app.get('/node/:nodeId', requireUserAuth, (req, res) => {
    const node = nodes.get(req.params.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Node not found.' });
    return res.status(200).json(node);
});

app.patch('/node/:nodeId', requireUserAuth, validateSchema(nodePatchSchema), (req, res) => {
    const node = nodes.get(req.params.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Node not found.' });
    const { name, note, dataArchiving } = req.body || {};
    if (name !== undefined) node.name = name;
    if (note !== undefined) node.note = note;
    if (dataArchiving !== undefined) node.dataArchiving = dataArchiving;
    nodes.set(node.id, node);
    return res.status(200).json(node);
});

app.delete('/node/:nodeId', requireUserAuth, (req, res) => {
    const node = nodes.get(req.params.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Node not found.' });
    // delete node, its pots and node tokens
    for (const [k, v] of pots) if (v.nodeId === node.id) pots.delete(k);
    for (const [h, v] of nodeTokens) if (v.nodeId === node.id) nodeTokens.delete(h);
    nodes.delete(node.id);
    return res.status(204).send();
});

/* --- Pot endpoints --- */
// GET /node/:nodeId/pot - list pots under a node (user authenticated + node ownership)
app.get('/node/:nodeId/pot', requireUserAuth, (req, res) => {
    const node = nodes.get(req.params.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Node not found.' });
    const list = Array.from(pots.values()).filter((p) => p.nodeId === node.id);
    return res.status(200).json(list);
});

// GET /pot/:potId
app.get('/pot/:potId', requireUserAuth, (req, res) => {
    const p = pots.get(req.params.potId);
    if (!p) return res.status(404).json({ error: 'NotFound', message: 'Pot not found' });
    const node = nodes.get(p.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    return res.status(200).json(p);
});

// PATCH /pot/:potId
app.patch('/pot/:potId', requireUserAuth, validateSchema(potPatchSchema), (req, res) => {
    const p = pots.get(req.params.potId);
    if (!p) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    const node = nodes.get(p.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    const { name, note } = req.body || {};
    if (name !== undefined) p.name = name;
    if (note !== undefined) p.note = note;
    pots.set(p.id, p);
    return res.status(200).json(p);
});

// DELETE /pot/:potId
app.delete('/pot/:potId', requireUserAuth, (req, res) => {
    const p = pots.get(req.params.potId);
    if (!p) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    const node = nodes.get(p.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    pots.delete(p.id);
    return res.status(204).send();
});

/* --- Measurement endpoints --- */
// PUT /pot/:potId/measurement - create measurement (device authenticates with node token)
app.put('/pot/:potId/measurement', requireNodeAuth, validateSchema(measurementSchema), (req, res) => {
    const potId = req.params.potId;
    const pot = pots.get(potId);
    if (!pot) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    // check node ownership of pot - node token must match pot's node
    if (pot.nodeId !== req.nodeId) return res.status(404).json({ error: 'NotFound', message: 'Pot not found or not owned by node' });
    const { timestamp, value, type } = req.body || {};
    if (!timestamp || value === undefined || !type) return res.status(400).json({ error: 'InvalidInput', message: 'timestamp, value and type required' });
    if (typeof value !== 'number' || value < 0 || value > 100) return res.status(400).json({ error: 'InvalidInput', message: 'value out of range' });
    const id = uuidv4();
    const m = { id, potId, timestamp, value, type };
    measurements.push(m);
    return res.status(201).json(m);
});

// GET /pot/:potId/measurement - list measurements for pot (user auth)
app.get('/pot/:potId/measurement', requireUserAuth, (req, res) => {
    const potId = req.params.potId;
    const pot = pots.get(potId);
    if (!pot) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    const node = nodes.get(pot.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Pot not found.' });
    const { timeStart, timeEnd } = req.query;
    let result = measurements.filter((m) => m.potId === potId);
    if (timeStart) result = result.filter((m) => new Date(m.timestamp) >= new Date(timeStart));
    if (timeEnd) result = result.filter((m) => new Date(m.timestamp) <= new Date(timeEnd));
    return res.status(200).json(result);
});

/* --- Utility endpoints for demo: create pot under node (user) --- */
app.post('/node/:nodeId/pot', requireUserAuth, validateSchema(potCreateSchema), (req, res) => {
    const node = nodes.get(req.params.nodeId);
    if (!node || node.userId !== req.userId) return res.status(404).json({ error: 'NotFound', message: 'Node not found.' });
    const { name, note, status } = req.body || {};
    if (!name) return res.status(400).json({ error: 'InvalidInput', message: 'name required' });
    const id = uuidv4();
    const p = { id, nodeId: node.id, name, note: note || '', status: status || 'unknown' };
    pots.set(id, p);
    return res.status(201).json(p);
});

/* --- Start server --- */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
    console.log(`Docs base path: / (map to your OpenAPI paths)`);
});
