import { Response } from "express";
import { db } from "../config/db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

export const getAdminStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Only admins can access this route
    if (req.user.role !== "admin") {
      res.status(403).json({ error: "Access denied. Admin only." });
      return;
    }

    const usersCollection = db.collection("user");
    const plansCollection = db.collection("travel_plans");

    // Fetch stats
    const totalUsers = await usersCollection.countDocuments();
    const totalTravelers = await usersCollection.countDocuments({ role: "traveler" });
    const totalAgents = await usersCollection.countDocuments({ role: "travel_agent" });
    const totalAdmins = await usersCollection.countDocuments({ role: "admin" });

    const totalPlans = await plansCollection.countDocuments();
    
    // Recent plans
    const recentPlans = await plansCollection.find().sort({ createdAt: -1 }).limit(5).toArray();
    
    // Top agents (aggregation to count plans per agent and fetch user details)
    const topAgents = await plansCollection.aggregate([
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
