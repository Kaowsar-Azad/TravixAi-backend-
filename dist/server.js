// src/server.ts
import express from "express";
import cors from "cors";
import dotenv2 from "dotenv";

// src/config/db.ts
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();
var uri = process.env.MONGODB_URI || "mongodb://localhost:27017/travix-fallback";
if (!process.env.MONGODB_URI) {
  console.warn("WARNING: MONGODB_URI is not defined in environment variables!");
}
var mongoClient = new MongoClient(uri);
var db = mongoClient.db();
var connectDB = async () => {
  try {
    await mongoClient.connect();
    console.log("MongoDB Connected Successfully!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
};

// src/server.ts
import { toNodeHandler } from "better-auth/node";

// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
var auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "fallback_secret_for_vercel_build_only",
  baseURL: process.env.BETTER_AUTH_URL || "https://travix-ai-backend.vercel.app",
  plugins: [
    jwt()
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy_secret"
    }
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"]
    }
  },
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true
  },
  trustedOrigins: ["http://localhost:3000", "https://travix-ai-frontend.vercel.app"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "traveler"
      }
    }
  }
});

// src/routes/itemRoutes.ts
import { Router } from "express";

// src/controllers/itemController.ts
import { ObjectId } from "mongodb";
var collectionName = "travel_plans";
var createItem = async (req, res) => {
  try {
    const { title, shortDescription, fullDescription, price, duration, images, category } = req.body;
    if (!title || !shortDescription || !price || !duration) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const newItem = {
      title,
      shortDescription,
      fullDescription: fullDescription || "",
      price,
      duration,
      images: Array.isArray(images) ? images : images ? [images] : [],
      category: category || "Uncategorized",
      userId: req.user.id,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    const result = await db.collection(collectionName).insertOne(newItem);
    res.status(201).json({ message: "Travel plan created successfully", id: result.insertedId });
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({ error: "Failed to create travel plan" });
  }
};
var getAggregatePipeline = (matchQuery, skipNum, limitNum) => {
  const pipeline = [
    { $match: matchQuery },
    { $sort: { createdAt: -1 } }
  ];
  if (typeof skipNum === "number") {
    pipeline.push({ $skip: skipNum });
  }
  if (typeof limitNum === "number") {
    pipeline.push({ $limit: limitNum });
  }
  pipeline.push(
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "planId",
        as: "itemReviews"
      }
    },
    {
      $addFields: {
        reviewsCount: { $size: "$itemReviews" },
        averageRating: { $avg: "$itemReviews.rating" }
      }
    },
    {
      $project: {
        itemReviews: 0
      }
    }
  );
  return pipeline;
};
var getItems = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const query = { isCustomized: { $ne: true } };
    if (!page && !limit) {
      const items2 = await db.collection(collectionName).aggregate(getAggregatePipeline(query)).toArray();
      res.status(200).json(items2);
      return;
    }
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 9;
    const skip = (pageNum - 1) * limitNum;
    const { search: searchParam } = req.query;
    if (searchParam) {
      query.$or = [
        { title: { $regex: searchParam, $options: "i" } },
        { shortDescription: { $regex: searchParam, $options: "i" } }
      ];
    }
    const totalItems = await db.collection(collectionName).countDocuments(query);
    const items = await db.collection(collectionName).aggregate(getAggregatePipeline(query, skip, limitNum)).toArray();
    const totalPages = Math.ceil(totalItems / limitNum);
    res.status(200).json({
      items,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error("Get items error:", error);
    res.status(500).json({ error: "Failed to fetch travel plans" });
  }
};
var getItemById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }
    const items = await db.collection(collectionName).aggregate(getAggregatePipeline({ _id: new ObjectId(id) })).toArray();
    if (!items || items.length === 0) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }
    res.status(200).json(items[0]);
  } catch (error) {
    console.error("Get item by ID error:", error);
    res.status(500).json({ error: "Failed to fetch travel plan" });
  }
};
var deleteItem = async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }
    const item = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
    if (!item) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }
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
var getMyItems = async (req, res) => {
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
var updateItem = async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }
    const { title, shortDescription, fullDescription, price, duration, images, category } = req.body;
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
        ...title && { title },
        ...shortDescription && { shortDescription },
        ...fullDescription !== void 0 && { fullDescription },
        ...price && { price },
        ...duration && { duration },
        ...images !== void 0 && { images: Array.isArray(images) ? images : images ? [images] : [] },
        ...category && { category },
        updatedAt: /* @__PURE__ */ new Date()
      }
    };
    await db.collection(collectionName).updateOne({ _id: new ObjectId(id) }, updateDoc);
    res.status(200).json({ message: "Travel plan updated successfully" });
  } catch (error) {
    console.error("Update item error:", error);
    res.status(500).json({ error: "Failed to update travel plan" });
  }
};
var getRelatedItems = async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }
    const item = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
    if (!item) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }
    const category = item.category || "Uncategorized";
    const relatedItems = await db.collection(collectionName).aggregate(getAggregatePipeline({
      category,
      _id: { $ne: new ObjectId(id) },
      isCustomized: { $ne: true }
    }, void 0, 3)).toArray();
    if (relatedItems.length < 3) {
      const needed = 3 - relatedItems.length;
      const excludeIds = [new ObjectId(id), ...relatedItems.map((ri) => ri._id)];
      const fallbackItems = await db.collection(collectionName).aggregate(getAggregatePipeline({
        _id: { $nin: excludeIds },
        isCustomized: { $ne: true }
      }, void 0, needed)).toArray();
      relatedItems.push(...fallbackItems);
    }
    res.status(200).json(relatedItems);
  } catch (error) {
    console.error("Get related items error:", error);
    res.status(500).json({ error: "Failed to fetch related travel plans" });
  }
};
var getReviews = async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }
    const reviews = await db.collection("reviews").find({ planId: new ObjectId(id) }).sort({ createdAt: -1 }).toArray();
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
};
var createReview = async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }
    const { rating, comment } = req.body;
    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be a number between 1 and 5" });
      return;
    }
    if (!comment || typeof comment !== "string" || !comment.trim()) {
      res.status(400).json({ error: "Comment is required" });
      return;
    }
    const plan = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
    if (!plan) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }
    const planIdsToCheck = [new ObjectId(id)];
    if (plan.basePlanId) {
      planIdsToCheck.push(new ObjectId(plan.basePlanId));
    }
    const derivedPlans = await db.collection(collectionName).find({ basePlanId: new ObjectId(id) }).project({ _id: 1 }).toArray();
    derivedPlans.forEach((dp) => planIdsToCheck.push(dp._id));
    const confirmedBooking = await db.collection("bookings").findOne({
      planId: { $in: planIdsToCheck },
      userId: req.user.id,
      status: "Confirmed"
    });
    if (!confirmedBooking) {
      res.status(403).json({ error: "You can only review travel plans that you have booked and had confirmed by the agent" });
      return;
    }
    const existingReview = await db.collection("reviews").findOne({
      planId: new ObjectId(id),
      userId: req.user.id
    });
    if (existingReview) {
      res.status(400).json({ error: "You have already reviewed this travel plan" });
      return;
    }
    const newReview = {
      planId: new ObjectId(id),
      userId: req.user.id,
      userName: req.user.name || "Anonymous",
      userImage: req.user.image || "",
      rating,
      comment: comment.trim(),
      createdAt: /* @__PURE__ */ new Date()
    };
    await db.collection("reviews").insertOne(newReview);
    res.status(201).json({ message: "Review submitted successfully", review: newReview });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
};

// src/middleware/authMiddleware.ts
import { fromNodeHeaders } from "better-auth/node";
var requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });
    if (!session || !session.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
};
var requireRole = (roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      await requireAuth(req, res, () => {
      });
      if (res.headersSent) return;
    }
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Access denied. Insufficient permissions." });
      return;
    }
    next();
  };
};

// src/routes/itemRoutes.ts
var router = Router();
router.get("/", getItems);
router.get("/my-plans", requireAuth, getMyItems);
router.get("/:id/related", getRelatedItems);
router.get("/:id/reviews", getReviews);
router.get("/:id", getItemById);
router.post("/:id/reviews", requireAuth, createReview);
router.post("/", requireRole(["travel_agent", "admin"]), createItem);
router.put("/:id", requireRole(["travel_agent", "admin"]), updateItem);
router.delete("/:id", requireRole(["travel_agent", "admin"]), deleteItem);
var itemRoutes_default = router;

// src/routes/uploadRoutes.ts
import { Router as Router2 } from "express";
import multer from "multer";

// src/controllers/uploadController.ts
var uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      console.error("IMGBB_API_KEY is not defined in environment variables");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }
    const base64Image = req.file.buffer.toString("base64");
    const formData = new URLSearchParams();
    formData.append("image", base64Image);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("ImgBB upload error:", data);
      res.status(500).json({ error: "Failed to upload image to ImgBB" });
      return;
    }
    res.status(200).json({
      message: "Image uploaded successfully",
      url: data.data.url
    });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ error: "Internal server error during image upload" });
  }
};

// src/routes/uploadRoutes.ts
var router2 = Router2();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 32 * 1024 * 1024
    // 32 MB limit per ImgBB specs
  }
});
router2.post("/", upload.single("image"), uploadImage);
var uploadRoutes_default = router2;

// src/routes/adminRoutes.ts
import { Router as Router3 } from "express";

// src/controllers/adminController.ts
var getAdminStats = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      res.status(403).json({ error: "Access denied. Admin only." });
      return;
    }
    const usersCollection2 = db.collection("user");
    const plansCollection2 = db.collection("travel_plans");
    const totalUsers = await usersCollection2.countDocuments();
    const totalTravelers = await usersCollection2.countDocuments({ role: "traveler" });
    const totalAgents = await usersCollection2.countDocuments({ role: "travel_agent" });
    const totalAdmins = await usersCollection2.countDocuments({ role: "admin" });
    const totalPlans = await plansCollection2.countDocuments();
    const recentPlans = await plansCollection2.find().sort({ createdAt: -1 }).limit(5).toArray();
    const topAgents = await plansCollection2.aggregate([
      { $match: { userId: { $ne: null, $exists: true, $regex: /^[0-9a-fA-F]{24}$/ } } },
      { $group: { _id: "$userId", planCount: { $sum: 1 } } },
      {
        $lookup: {
          from: "user",
          let: { agentId: { $toObjectId: "$_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$agentId"] } } }
          ],
          as: "agentDetails"
        }
      },
      { $unwind: { path: "$agentDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          planCount: 1,
          name: "$agentDetails.name",
          email: "$agentDetails.email"
        }
      },
      { $sort: { planCount: -1 } },
      { $limit: 5 }
    ]).toArray();
    res.status(200).json({
      totalUsers,
      totalTravelers,
      totalAgents,
      totalAdmins,
      totalPlans,
      recentPlans,
      topAgents
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
};

// src/routes/adminRoutes.ts
var router3 = Router3();
router3.get("/stats", requireAuth, getAdminStats);
var adminRoutes_default = router3;

// src/routes/bookingRoutes.ts
import { Router as Router4 } from "express";

// src/controllers/bookingController.ts
import { ObjectId as ObjectId2 } from "mongodb";
var bookingsCollection = "bookings";
var plansCollection = "travel_plans";
var usersCollection = "user";
var createBooking = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId || !ObjectId2.isValid(planId)) {
      res.status(400).json({ error: "Invalid plan ID" });
      return;
    }
    const plan = await db.collection(plansCollection).findOne({ _id: new ObjectId2(planId) });
    if (!plan) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }
    const existingBooking = await db.collection(bookingsCollection).findOne({
      planId: new ObjectId2(planId),
      userId: req.user.id
    });
    if (existingBooking) {
      if (existingBooking.status === "Confirmed") {
        res.status(400).json({ error: "You have already booked this plan and it is confirmed" });
        return;
      }
      if (existingBooking.status === "Requested") {
        res.status(400).json({ error: "You have already requested to book this plan" });
        return;
      }
      if (existingBooking.status === "Rejected") {
        await db.collection(bookingsCollection).updateOne(
          { _id: existingBooking._id },
          { $set: { status: "Requested", bookingDate: /* @__PURE__ */ new Date() } }
        );
        res.status(200).json({ message: "Booking requested again successfully", bookingId: existingBooking._id });
        return;
      }
    }
    const newBooking = {
      planId: new ObjectId2(planId),
      planTitle: plan.title,
      userId: req.user.id,
      travelAgentId: plan.userId,
      // The creator of the plan
      bookingDate: /* @__PURE__ */ new Date(),
      status: "Requested"
    };
    const result = await db.collection(bookingsCollection).insertOne(newBooking);
    res.status(201).json({ message: "Booking successful", bookingId: result.insertedId });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
};
var getBookingsByPlan = async (req, res) => {
  try {
    const planId = req.params.planId;
    if (!ObjectId2.isValid(planId)) {
      res.status(400).json({ error: "Invalid plan ID format" });
      return;
    }
    const plan = await db.collection(plansCollection).findOne({ _id: new ObjectId2(planId) });
    if (!plan) {
      res.status(404).json({ error: "Travel plan not found" });
      return;
    }
    if (plan.userId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Access denied. You can only view bookings for your own plans." });
      return;
    }
    const customizedPlans = await db.collection(plansCollection).find({ basePlanId: new ObjectId2(planId) }).project({ _id: 1 }).toArray();
    const planIdsToMatch = [new ObjectId2(planId), ...customizedPlans.map((p) => p._id)];
    const bookings = await db.collection(bookingsCollection).aggregate([
      { $match: { planId: { $in: planIdsToMatch } } },
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
          planId: 1,
          planTitle: 1,
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
var checkBooking = async (req, res) => {
  try {
    const planId = req.params.planId;
    if (!ObjectId2.isValid(planId)) {
      res.status(400).json({ error: "Invalid plan ID format" });
      return;
    }
    const existingBooking = await db.collection(bookingsCollection).findOne({
      planId: new ObjectId2(planId),
      userId: req.user.id
    });
    res.status(200).json({
      hasBooked: !!existingBooking,
      status: existingBooking ? existingBooking.status : null,
      bookingId: existingBooking ? existingBooking._id : null
    });
  } catch (error) {
    console.error("Check booking error:", error);
    res.status(500).json({ error: "Failed to check booking status" });
  }
};
var updateBookingStatus = async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const { status } = req.body;
    if (!ObjectId2.isValid(bookingId)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }
    if (!["Confirmed", "Rejected"].includes(status)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }
    const booking = await db.collection(bookingsCollection).findOne({ _id: new ObjectId2(bookingId) });
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    const plan = await db.collection(plansCollection).findOne({ _id: new ObjectId2(booking.planId) });
    if (!plan) {
      res.status(404).json({ error: "Associated travel plan not found" });
      return;
    }
    if (plan.userId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Access denied. You can only update bookings for your own plans." });
      return;
    }
    await db.collection(bookingsCollection).updateOne(
      { _id: new ObjectId2(bookingId) },
      { $set: { status } }
    );
    res.status(200).json({ message: `Booking status updated to ${status}` });
  } catch (error) {
    console.error("Update booking status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
};
var getMyBookings = async (req, res) => {
  try {
    const bookings = await db.collection(bookingsCollection).aggregate([
      { $match: { userId: req.user.id } },
      {
        $lookup: {
          from: plansCollection,
          let: { planIdStr: "$planId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$planIdStr"] } } }
          ],
          as: "planDetails"
        }
      },
      {
        $unwind: { path: "$planDetails", preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 1,
          bookingDate: 1,
          status: 1,
          planId: 1,
          planTitle: 1,
          "plan.price": "$planDetails.price",
          "plan.duration": "$planDetails.duration",
          "plan.images": "$planDetails.images"
        }
      },
      { $sort: { bookingDate: -1 } }
    ]).toArray();
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Get my bookings error:", error);
    res.status(500).json({ error: "Failed to fetch your bookings" });
  }
};
var cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    if (!ObjectId2.isValid(bookingId)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }
    const booking = await db.collection(bookingsCollection).findOne({ _id: new ObjectId2(bookingId) });
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    if (booking.userId !== req.user.id) {
      res.status(403).json({ error: "Access denied. You can only cancel your own bookings." });
      return;
    }
    if (booking.status !== "Requested") {
      res.status(400).json({ error: `Cannot cancel booking with status: ${booking.status}` });
      return;
    }
    await db.collection(bookingsCollection).deleteOne({ _id: new ObjectId2(bookingId) });
    res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
};

// src/routes/bookingRoutes.ts
var router4 = Router4();
router4.get("/my-bookings", requireAuth, getMyBookings);
router4.delete("/:bookingId/cancel", requireAuth, cancelBooking);
router4.post("/", requireAuth, createBooking);
router4.get("/check/:planId", requireAuth, checkBooking);
router4.get("/plan/:planId", requireRole(["travel_agent", "admin"]), getBookingsByPlan);
router4.put("/:bookingId/status", requireRole(["travel_agent", "admin"]), updateBookingStatus);
var bookingRoutes_default = router4;

// src/routes/aiRoutes.ts
import { Router as Router5 } from "express";
import multer2 from "multer";

// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
var GeminiService = class {
  apiKeys;
  currentKeyIndex;
  instances;
  constructor() {
    const keysString = process.env.GEMINI_API_KEYS || "";
    this.apiKeys = keysString.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
    if (this.apiKeys.length === 0) {
      console.warn("\u26A0\uFE0F No GEMINI_API_KEYS provided in environment variables!");
    }
    this.currentKeyIndex = 0;
    this.instances = this.apiKeys.map((key) => new GoogleGenerativeAI(key));
  }
  /**
   * Internal function to attempt generating content with the current key.
   * If a 429 quota error occurs, it switches to the next key and retries.
   */
  async generateContentWithFallback(modelName, prompt, systemInstruction, attempts = 0) {
    if (this.instances.length === 0) {
      throw new Error("No Gemini API keys configured. Please add GEMINI_API_KEYS to .env");
    }
    if (attempts >= this.instances.length) {
      throw new Error("All Gemini API keys have exhausted their quota or failed.");
    }
    const ai = this.instances[this.currentKeyIndex];
    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction
    });
    try {
      console.log(`[GeminiService] Attempting with API Key index: ${this.currentKeyIndex} (Model: ${modelName})`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error(`[GeminiService] Error with API Key index ${this.currentKeyIndex}:`, error.message);
      const isRetryableError = error.status === 429 || error.status === 503 || error.status === 500 || error.message?.includes("429") || error.message?.includes("503") || error.message?.includes("500") || error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("limit") || error.message?.toLowerCase().includes("service unavailable") || error.message?.toLowerCase().includes("high demand") || error.message?.toLowerCase().includes("overloaded") || error.message?.toLowerCase().includes("temporary");
      if (isRetryableError) {
        console.warn(`[GeminiService] API Key at index ${this.currentKeyIndex} failed or exhausted. Switching to next key...`);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.instances.length;
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        return this.generateContentWithFallback(modelName, prompt, systemInstruction, attempts + 1);
      } else {
        throw error;
      }
    }
  }
  /**
   * Public method to generate a customized travel itinerary
   */
  async customizePlan(basePlanStr, userPreferences) {
    const prompt = `
You are a professional travel planner API. I will provide you with a base travel plan and a user's custom preferences.
Your task is to modify the base travel plan according to the preferences and output a highly detailed, personalized travel itinerary in MARKDOWN format.

### Base Plan Information:
${basePlanStr}

### User's Custom Preferences:
${userPreferences}

### Instructions:
1. Adjust the duration, days, and itinerary activities to strictly match the user's preferences.
2. If the user wants a cheaper budget, suggest budget-friendly accommodations and transport.
3. Output ONLY the new plan. Do not include any conversational filler.
4. Format the output clearly using Markdown headers (e.g., # Trip Title, ## Day 1: [Activity], etc.).
5. DO NOT provide any total cost estimate or budget information in the text output, as the budget is already displayed on the main card UI.
`;
    return this.generateContentWithFallback("gemini-2.5-flash", prompt);
  }
  /**
   * Public method for the AI Agent Chat
   */
  async chatWithAgent(chatHistory, userMessage, file, attempts = 0) {
    if (!this.instances || this.instances.length === 0) {
      throw new Error("No Gemini API keys configured. Please add GEMINI_API_KEYS to .env");
    }
    if (attempts >= this.instances.length) {
      throw new Error("All Gemini API keys have exhausted their quota, are overloaded, or failed.");
    }
    const ai = this.instances[this.currentKeyIndex];
    const systemInstruction = "You are Travix AI, a helpful, intelligent, and general-purpose AI assistant for a platform called Travix AI. While you specialize in travel planning, finding destinations, and giving travel advice, you are fully capable of answering any general knowledge questions, analyzing documents, and assisting with a wide variety of tasks like ChatGPT or Gemini. Be concise, polite, and use formatting where appropriate.";
    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction
    });
    try {
      const formattedHistory = chatHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));
      console.log(`[GeminiService] Chat Attempting with API Key index: ${this.currentKeyIndex}`);
      const chatSession = model.startChat({
        history: formattedHistory
      });
      let messageParts = userMessage;
      if (file) {
        messageParts = [
          { text: userMessage },
          { inlineData: { mimeType: file.mimeType, data: file.data } }
        ];
      }
      const result = await chatSession.sendMessage(messageParts);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error(`[GeminiService] Chat Error with API Key index ${this.currentKeyIndex}:`, error.message);
      const isRetryableError = error.status === 429 || error.status === 503 || error.status === 500 || error.message?.includes("429") || error.message?.includes("503") || error.message?.includes("500") || error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("limit") || error.message?.toLowerCase().includes("service unavailable") || error.message?.toLowerCase().includes("high demand") || error.message?.toLowerCase().includes("overloaded") || error.message?.toLowerCase().includes("temporary");
      if (isRetryableError) {
        console.warn(`[GeminiService] API Key at index ${this.currentKeyIndex} failed or overloaded. Switching to next key...`);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.instances.length;
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        return this.chatWithAgent(chatHistory, userMessage, file, attempts + 1);
      } else {
        throw error;
      }
    }
  }
};
var geminiService = new GeminiService();

// src/controllers/aiController.ts
import { ObjectId as ObjectId3 } from "mongodb";
var chatAgent = async (req, res) => {
  try {
    let { message, history } = req.body;
    if (typeof history === "string") {
      try {
        history = JSON.parse(history);
      } catch (e) {
        history = [];
      }
    }
    if (!message && !req.file) {
      return res.status(400).json({ error: "Message or file is required" });
    }
    let fileData = void 0;
    if (req.file) {
      fileData = {
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString("base64")
      };
    }
    const finalMessage = message || "Please analyze the attached file.";
    const aiResponse = await geminiService.chatWithAgent(history || [], finalMessage, fileData);
    return res.json({
      success: true,
      response: aiResponse
    });
  } catch (error) {
    console.error("Error in chatAgent:", error);
    return res.status(500).json({ error: "Failed to process AI chat request", details: error.message });
  }
};
var customizePlan = async (req, res) => {
  try {
    const { basePlanId, budget, days, nights, preferences } = req.body;
    if (!basePlanId) {
      return res.status(400).json({ error: "Base plan ID is required" });
    }
    const basePlan = await db.collection("travel_plans").findOne({ _id: new ObjectId3(basePlanId) });
    if (!basePlan) {
      return res.status(404).json({ error: "Base plan not found" });
    }
    const basePlanStr = `
Title: ${basePlan.title}
Short Description: ${basePlan.shortDescription}
Full Description: ${basePlan.fullDescription}
Budget: ${basePlan.price}
Duration: ${basePlan.duration}
`;
    const formattedPreferences = `
    - Target Budget: ${budget ? `${budget} BDT` : "Keep similar to base plan"}
    - Target Duration: ${days && nights ? `${days} Days, ${nights} Nights` : "Keep same as base plan"}
    - Additional Requests: ${preferences || "None"}
    
    Please ensure the output strictly follows the target duration (e.g. exactly ${days || "base"} days) and fits within the target budget.
    `;
    const customizedMarkdown = await geminiService.customizePlan(basePlanStr, formattedPreferences);
    const newPlan = {
      title: `${basePlan.title} (Customized for you)`,
      shortDescription: `AI Customized Plan based on your preferences: ${preferences ? preferences.substring(0, 50) : "Customized"}...`,
      fullDescription: customizedMarkdown,
      price: budget ? `${budget} BDT` : basePlan.price,
      duration: days && nights ? `${days} Days, ${nights} Nights` : basePlan.duration,
      imageUrl: basePlan.imageUrl,
      // keep same image
      images: basePlan.images,
      // preserve the entire images array
      agentEmail: basePlan.agentEmail,
      userId: basePlan.userId,
      // keep the original agent as the owner
      isCustomized: true,
      // flag
      basePlanId: basePlan.basePlanId ? basePlan.basePlanId : basePlan._id,
      createdAt: /* @__PURE__ */ new Date()
    };
    const result = await db.collection("travel_plans").insertOne(newPlan);
    return res.status(201).json({
      success: true,
      message: "Customized plan generated successfully",
      newPlanId: result.insertedId
    });
  } catch (error) {
    console.error("Error in customizePlan:", error);
    return res.status(500).json({ error: "Failed to customize travel plan", details: error.message });
  }
};

// src/routes/aiRoutes.ts
var upload2 = multer2({ storage: multer2.memoryStorage() });
var router5 = Router5();
router5.post("/chat", upload2.single("file"), chatAgent);
router5.post("/customize", customizePlan);
var aiRoutes_default = router5;

// src/server.ts
dotenv2.config();
var app = express();
var PORT = process.env.PORT || 5e3;
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://travix-ai-frontend.vercel.app",
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json());
app.all("/api/auth/*path", toNodeHandler(auth));
app.use("/api/items", itemRoutes_default);
app.use("/api/upload", uploadRoutes_default);
app.use("/api/admin", adminRoutes_default);
app.use("/api/bookings", bookingRoutes_default);
app.use("/api/ai", aiRoutes_default);
app.get("/", (req, res) => {
  res.send("TravelX AI Backend is running");
});
if (process.env.NODE_ENV !== "production") {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error("Failed to connect to database on startup:", err);
  });
} else {
  connectDB().catch((err) => {
    console.error("Vercel MongoDB Connection Error:", err);
  });
}
var server_default = app;
export {
  server_default as default
};
