import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import itemRoutes from "./routes/itemRoutes";
import uploadRoutes from "./routes/uploadRoutes";

dotenv.config();

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

// Basic route
app.get("/", (req, res) => {
  res.send("TravelX AI Backend is running");
});

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();
