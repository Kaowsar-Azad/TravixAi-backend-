import { ObjectId } from "mongodb";

export interface TravelPlan {
  _id?: ObjectId;
  title: string;
  shortDescription: string;
  fullDescription: string;
  price: string;
  duration: string;
  imageUrl: string;
  category: string;
  userId: string; // the Better Auth user ID (string)
  createdAt: Date;
  updatedAt: Date;
}
