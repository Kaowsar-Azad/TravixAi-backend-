import { Router } from "express";
import { createItem, getItems, getItemById, deleteItem, getMyItems, updateItem, getRelatedItems, getReviews, createReview } from "../controllers/itemController";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
const router = Router();
// Public routes
router.get("/", getItems);
router.get("/my-plans", requireAuth, getMyItems);
router.get("/:id/related", getRelatedItems);
router.get("/:id/reviews", getReviews);
router.get("/:id", getItemById);
// Protected routes
router.post("/:id/reviews", requireAuth, createReview);
router.post("/", requireRole(["travel_agent", "admin"]), createItem);
router.put("/:id", requireRole(["travel_agent", "admin"]), updateItem);
router.delete("/:id", requireRole(["travel_agent", "admin"]), deleteItem);
export default router;
