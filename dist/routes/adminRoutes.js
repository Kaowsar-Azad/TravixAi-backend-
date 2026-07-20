import { Router } from "express";
import { getAdminStats } from "../controllers/adminController";
import { requireAuth } from "../middleware/authMiddleware";
const router = Router();
router.get("/stats", requireAuth, getAdminStats);
export default router;
