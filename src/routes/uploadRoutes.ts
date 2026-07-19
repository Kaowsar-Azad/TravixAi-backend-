import { Router } from "express";
import multer from "multer";
import { uploadImage } from "../controllers/uploadController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

// Configure multer to store files in memory as buffers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 32 * 1024 * 1024, // 32 MB limit per ImgBB specs
  },
});

router.post("/", requireAuth as any, upload.single("image"), uploadImage as any);

export default router;
