import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  sourcemap: false,
  splitting: false,
  bundle: true,
  // Don't bundle node_modules — let Vercel install them
  external: [
    "express",
    "cors",
    "dotenv",
    "better-auth",
    "mongodb",
    "multer",
    "pdf-parse",
    "@google/generative-ai",
  ],
});
