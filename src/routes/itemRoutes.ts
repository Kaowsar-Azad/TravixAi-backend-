import { Router } from "express";
import { createItem, getItems, getItemById, deleteItem, getMyItems, updateItem } from "../controllers/itemController";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

// Public routes
router.get("/", getItems);
router.get("/my-plans", requireAuth as any, getMyItems as any);
router.get("/:id", getItemById);

// Protected routes
router.post("/", requireRole(["travel_agent", "admin"]) as any, createItem as any);
router.put("/:id", requireRole(["travel_agent", "admin"]) as any, updateItem as any);
router.delete("/:id", requireRole(["travel_agent", "admin"]) as any, deleteItem as any);

export default router;
