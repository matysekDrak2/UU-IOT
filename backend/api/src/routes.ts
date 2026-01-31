import express from "express";

const router = express.Router();

/* Mount extracted user routes */
import userRouter from "./paths/user";
router.use("/user", userRouter);

/* Node router under /node */
import nodeRouter from "./paths/node";
router.use("/node", nodeRouter);

/* Pot router at root (contains /node/:nodeId/pot and /pot/:potId...) */
import potRouter from "./paths/pot";
router.use("/", potRouter);

export default router;
