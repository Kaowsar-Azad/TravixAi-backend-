import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/db";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import itemRoutes from "./routes/itemRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import adminRoutes from "./routes/adminRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import aiRoutes from "./routes/aiRoutes";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// Auth routes
app.all("/api/auth/*path", toNodeHandler(auth));

// API Routes
app.use("/api/items", itemRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ai", aiRoutes);

// Basic route
app.get("/", (req, res) => {
  res.send("TravelX AI Backend is running");
});

// Connect to DB on demand (MongoDB driver handles this automatically)
// Only listen on a port if not in production (Vercel sets NODE_ENV=production)
if (process.env.NODE_ENV !== "production") {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error("Failed to connect to database on startup:", err);
  });
} else {
  // In production, just connect to DB and let Vercel handle the request
  // Catch any errors to prevent unhandled promise rejection from crashing the Vercel function!
  connectDB().catch(err => {
    console.error("Vercel MongoDB Connection Error:", err);
  });
}

export default app;
