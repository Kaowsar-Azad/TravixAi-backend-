import { Router } from "express";
import { createBooking, getBookingsByPlan, checkBooking, updateBookingStatus, getMyBookings } from "../controllers/bookingController";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

// Get current user's bookings
router.get("/my-bookings", requireAuth as any, getMyBookings as any);

// Travelers (and others) can create a booking
router.post("/", requireAuth as any, createBooking as any);

// Check if current user has booked a plan
router.get("/check/:planId", requireAuth as any, checkBooking as any);

// Only Agents and Admins can view bookings for a plan
router.get("/plan/:planId", requireRole(["travel_agent", "admin"]) as any, getBookingsByPlan as any);

// Update status of a booking
router.put("/:bookingId/status", requireRole(["travel_agent", "admin"]) as any, updateBookingStatus as any);

export default router;
