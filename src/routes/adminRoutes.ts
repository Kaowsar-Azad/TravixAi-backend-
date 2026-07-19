import { Router } from "express";
import { getAdminStats } from "../controllers/adminController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/stats", requireAuth as any, getAdminStats as any);

export default router;
