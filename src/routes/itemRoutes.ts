import { Router } from "express";
import { createItem, getItems, getItemById, deleteItem } from "../controllers/itemController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

// Public routes
router.get("/", getItems);
router.get("/:id", getItemById);

// Protected routes
router.post("/", requireAuth as any, createItem as any);
router.delete("/:id", requireAuth as any, deleteItem as any);

export default router;
