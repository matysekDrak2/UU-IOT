import express from "express";
import dotenv from "dotenv";
import routes from "./routes";
import { checkDbConnection, getPool } from "./dao";

dotenv.config();

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    await getPool().query("SELECT 1");
    res.json({ status: "healthy", db: "connected" });
  } catch {
    res.status(503).json({ status: "unhealthy", db: "disconnected" });
  }
});

// mount routes under /api/V1 to match docs
app.use("/api/V1", routes);

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

let server: ReturnType<typeof app.listen>;

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log("HTTP server closed");
      getPool().end().then(() => {
        console.log("Database pool closed");
        process.exit(0);
      }).catch(() => process.exit(1));
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start-up logic: check DB and run DAO tests if DB is reachable
(async () => {
  await checkDbConnection();

  server = app.listen(port, () => {
    console.log(`API listening on http://0.0.0.0:${port}/api/V1`);
  });
})();

export default app;
