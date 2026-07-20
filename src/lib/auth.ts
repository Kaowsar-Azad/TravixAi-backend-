import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { db } from "../config/db";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "fallback_secret_for_vercel_build_only",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  plugins: [
    jwt(),
  ],
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ["http://localhost:3000", "https://travix-ai-frontend.vercel.app"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "traveler",
      }
    }
  }
});
