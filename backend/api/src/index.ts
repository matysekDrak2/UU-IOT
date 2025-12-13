import express from "express";
import dotenv from "dotenv";
import routes from "./routes";
import { checkDbConnection } from "./dao";

dotenv.config();

const app = express();
app.use(express.json());

// mount routes under /api/V1 to match docs
app.use("/api/V1", routes);

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

// Start-up logic: check DB and run DAO tests if DB is reachable
(async () => {

  await checkDbConnection();

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://0.0.0.0:${port}/api/V1`);
  });
})();

app.get("/test", (req, res) => {
  console.log("Test endpoint hit");
  res.json({ message: "Welcome to the API. Please use /api/V1 for all endpoints." });
})
app.get("/api/V1/test", (req, res) => {
  console.log("Test endpoint hit");
  res.json({ message: "Welcome to the API. Please use /api/V1 for all endpoints. testing the V1" });
})

export default app;
