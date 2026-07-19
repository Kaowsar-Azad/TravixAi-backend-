import { Response } from "express";
import { db } from "../config/db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { ObjectId } from "mongodb";

const bookingsCollection = "bookings";
const plansCollection = "travel_plans";
const usersCollection = "user";

export const createBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;
    if (!planId || !ObjectId.isValid(planId)) {
      res.status(400).json({ error: "Invalid plan ID" });
      return;
    }

    const plan = await db.collection(plansCollection).findOne({ _id: new ObjectId(planId) });
    if (!plan) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }

    // Optional: check if user already booked
    const existingBooking = await db.collection(bookingsCollection).findOne({
      planId: new ObjectId(planId),
      userId: req.user.id
    });

    if (existingBooking) {
      res.status(400).json({ error: "You have already booked this plan" });
      return;
    }

    const newBooking = {
      planId: new ObjectId(planId),
      planTitle: plan.title,
      userId: req.user.id,
      travelAgentId: plan.userId, // The creator of the plan
      bookingDate: new Date(),
      status: "Requested"
    };

    const result = await db.collection(bookingsCollection).insertOne(newBooking);
    res.status(201).json({ message: "Booking successful", bookingId: result.insertedId });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
};

export const getBookingsByPlan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const planId = req.params.planId as string;
    if (!ObjectId.isValid(planId)) {
      res.status(400).json({ error: "Invalid plan ID format" });
      return;
    }

    // Verify ownership of the plan
    const plan = await db.collection(plansCollection).findOne({ _id: new ObjectId(planId) });
    if (!plan) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }

    if (plan.userId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Access denied. You can only view bookings for your own plans." });
      return;
    }

    // Fetch bookings and join with user data
    const bookings = await db.collection(bookingsCollection).aggregate([
      { $match: { planId: new ObjectId(planId) } },
      {
        $lookup: {
          from: usersCollection,
          let: { searchId: { $toObjectId: "$userId" } }, 
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$searchId"] } } }
          ],
          as: "userDetails"
        }
      },
      {
        $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 1,
          bookingDate: 1,
          status: 1,
          "user.name": "$userDetails.name",
          "user.email": "$userDetails.email",
          "user.image": "$userDetails.image"
        }
      },
      { $sort: { bookingDate: -1 } }
    ]).toArray();

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
};

export const checkBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const planId = req.params.planId as string;
    if (!ObjectId.isValid(planId)) {
      res.status(400).json({ error: "Invalid plan ID format" });
      return;
    }

    const existingBooking = await db.collection(bookingsCollection).findOne({
      planId: new ObjectId(planId),
      userId: req.user.id
    });

    res.status(200).json({ hasBooked: !!existingBooking });
  } catch (error) {
    console.error("Check booking error:", error);
    res.status(500).json({ error: "Failed to check booking status" });
  }
};

export const updateBookingStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const bookingId = req.params.bookingId as string;
    const { status } = req.body; // should be "Confirmed" or "Rejected"

    if (!ObjectId.isValid(bookingId)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }

    if (!["Confirmed", "Rejected"].includes(status)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    const booking = await db.collection(bookingsCollection).findOne({ _id: new ObjectId(bookingId) });
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Verify ownership of the plan associated with the booking
    const plan = await db.collection(plansCollection).findOne({ _id: new ObjectId(booking.planId) });
    if (!plan) {
      res.status(404).json({ error: "Associated travel plan not found" });
      return;
    }

    if (plan.userId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Access denied. You can only update bookings for your own plans." });
      return;
    }

    await db.collection(bookingsCollection).updateOne(
      { _id: new ObjectId(bookingId) },
      { $set: { status: status } }
    );

    res.status(200).json({ message: `Booking status updated to ${status}` });
  } catch (error) {
    console.error("Update booking status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
};
