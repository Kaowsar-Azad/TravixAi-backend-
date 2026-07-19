import { Request, Response } from "express";

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
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

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString("base64");

    // Use native fetch to call ImgBB API
    const formData = new URLSearchParams();
    formData.append("image", base64Image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
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
