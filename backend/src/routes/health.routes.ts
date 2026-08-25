import { Router, type Router as RouterType } from "express";
import { healthController } from "../controllers/health.controller.js";

const router: RouterType = Router();
router.get("/health", healthController);

export { router as healthRoutes };
