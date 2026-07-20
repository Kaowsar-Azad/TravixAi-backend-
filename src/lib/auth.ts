import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { db } from "../config/db";

export const auth = betterAuth({
  plugins: [
    jwt(),
  ],
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ["http://localhost:3000"],
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
