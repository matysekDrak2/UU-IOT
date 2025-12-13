import express from "express";


const router = express.Router();

/* Mount extracted user routes */
import userRouter from "./paths/user";
router.use("/user", userRouter);

/* Mount node and pot routers */
import nodeRouter from "./paths/node";
router.use("/node", nodeRouter);
import potRouter from "./paths/pot";
router.use("/pot", potRouter);

export default router;
