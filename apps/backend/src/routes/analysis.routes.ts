import { Router, type Router as RouterType } from "express";
import { analysisController } from "../controllers/analysis.controller.js";
import { rateLimit } from "../middleware/rate-limit.js";

const router: RouterType = Router();
router.use(rateLimit);
router.post("/context", analysisController("context"));
router.post("/claim", analysisController("claim"));

export { router as analysisRoutes };
