import { Router } from "express";
import { createItem, getItems, getItemById, deleteItem, getMyItems, updateItem, getRelatedItems, getReviews, createReview } from "../controllers/itemController";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

// Public routes
router.get("/", getItems);
router.get("/my-plans", requireAuth as any, getMyItems as any);
router.get("/:id/related", getRelatedItems);
router.get("/:id/reviews", getReviews);
router.get("/:id", getItemById);

// Protected routes
router.post("/:id/reviews", requireAuth as any, createReview as any);
router.post("/", requireRole(["travel_agent", "admin"]) as any, createItem as any);
router.put("/:id", requireRole(["travel_agent", "admin"]) as any, updateItem as any);
router.delete("/:id", requireRole(["travel_agent", "admin"]) as any, deleteItem as any);

export default router;
