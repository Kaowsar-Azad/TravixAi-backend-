import { Request, Response } from 'express';

export default (req: Request, res: Response) => {
  try {
    // Use dynamic require so Vercel's esbuild DOES NOT hoist the execution!
    // We already included `src/**` in vercel.json, so the file will be there.
    const serverPath = '../src/server';
    const app = require(serverPath).default;
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Module Load Crash Error:", err);
    res.status(500).json({
      error: "Vercel Module Load Error",
      message: err.message,
      stack: err.stack,
      name: err.name
    });
  }
};
