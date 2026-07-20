import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/travix-fallback";
if (!process.env.MONGODB_URI) {
    console.warn("WARNING: MONGODB_URI is not defined in environment variables!");
}
export const mongoClient = new MongoClient(uri);
// Select the database
export const db = mongoClient.db();
export const connectDB = async () => {
    try {
        await mongoClient.connect();
        console.log("MongoDB Connected Successfully!");
    }
    catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw error;
    }
};
