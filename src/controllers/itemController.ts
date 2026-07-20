import { Request, Response } from "express";
import { db } from "../config/db";
import { TravelPlan } from "../types/item";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { ObjectId } from "mongodb";

const collectionName = "travel_plans";

export const createItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, shortDescription, fullDescription, price, duration, images, category } = req.body;
    
    // Basic validation
    if (!title || !shortDescription || !price || !duration) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const newItem: TravelPlan = {
      title,
      shortDescription,
      fullDescription: fullDescription || "",
      price,
      duration,
      images: Array.isArray(images) ? images : (images ? [images] : []),
      category: category || "Uncategorized",
      userId: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(collectionName).insertOne(newItem);
    res.status(201).json({ message: "Travel plan created successfully", id: result.insertedId });
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({ error: "Failed to create travel plan" });
  }
};

export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await db.collection(collectionName).find({ isCustomized: { $ne: true } }).sort({ createdAt: -1 }).toArray();
    res.status(200).json(items);
  } catch (error) {
    console.error("Get items error:", error);
    res.status(500).json({ error: "Failed to fetch travel plans" });
  }
};

export const getItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }

    const item = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
    if (!item) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }

    res.status(200).json(item);
  } catch (error) {
    console.error("Get item by ID error:", error);
    res.status(500).json({ error: "Failed to fetch travel plan" });
  }
};

export const deleteItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }

    const item = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
    if (!item) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }

    // Only allow the creator to delete
    if (item.userId !== req.user.id) {
      res.status(403).json({ error: "You do not have permission to delete this travel plan" });
      return;
    }

    await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ message: "Travel plan deleted successfully" });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ error: "Failed to delete travel plan" });
  }
};

export const getMyItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const items = await db.collection(collectionName).aggregate([
      { $match: { userId: req.user.id, isCustomized: { $ne: true } } },
      {
        $lookup: {
          from: "travel_plans",
          localField: "_id",
          foreignField: "basePlanId",
          as: "derivedPlans"
        }
      },
      {
        $lookup: {
          from: "bookings",
          let: { planIds: { $concatArrays: [["$_id"], "$derivedPlans._id"] } },
          pipeline: [
            { $match: { $expr: { $in: ["$planId", "$$planIds"] } } }
          ],
          as: "bookings"
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          shortDescription: 1,
          fullDescription: 1,
          price: 1,
          duration: 1,
          images: 1,
          category: 1,
          createdAt: 1,
          updatedAt: 1,
          userId: 1,
          totalBookings: { $size: "$bookings" },
          pendingRequests: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $eq: ["$$booking.status", "Requested"] }
              }
            }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]).toArray();
    res.status(200).json(items);
  } catch (error) {
    console.error("Get my items error:", error);
    res.status(500).json({ error: "Failed to fetch your travel plans" });
  }
};

export const updateItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }

    const { title, shortDescription, fullDescription, price, duration, images, category } = req.body;
    
    // Check if it exists and belongs to the user
    const item = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
    if (!item) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }

    if (item.userId !== req.user.id) {
      res.status(403).json({ error: "You do not have permission to edit this travel plan" });
      return;
    }

    const updateDoc = {
      $set: {
        ...(title && { title }),
        ...(shortDescription && { shortDescription }),
        ...(fullDescription !== undefined && { fullDescription }),
        ...(price && { price }),
        ...(duration && { duration }),
        ...(images !== undefined && { images: Array.isArray(images) ? images : (images ? [images] : []) }),
        ...(category && { category }),
        updatedAt: new Date()
      }
    };

    await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, updateDoc);
    res.status(200).json({ message: "Travel plan updated successfully" });
  } catch (error) {
    console.error("Update item error:", error);
    res.status(500).json({ error: "Failed to update travel plan" });
  }
};
