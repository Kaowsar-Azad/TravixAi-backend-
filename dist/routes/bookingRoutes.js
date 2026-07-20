import { Router } from "express";
import { createBooking, getBookingsByPlan, checkBooking, updateBookingStatus, getMyBookings, cancelBooking } from "../controllers/bookingController";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
const router = Router();
// Get current user's bookings
router.get("/my-bookings", requireAuth, getMyBookings);
// Cancel booking
router.delete("/:bookingId/cancel", requireAuth, cancelBooking);
// Travelers (and others) can create a booking
router.post("/", requireAuth, createBooking);
// Check if current user has booked a plan
router.get("/check/:planId", requireAuth, checkBooking);
// Only Agents and Admins can view bookings for a plan
router.get("/plan/:planId", requireRole(["travel_agent", "admin"]), getBookingsByPlan);
// Update status of a booking
router.put("/:bookingId/status", requireRole(["travel_agent", "admin"]), updateBookingStatus);
export default router;
