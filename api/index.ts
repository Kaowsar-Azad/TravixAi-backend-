import { Request, Response } from 'express';

export default (req: Request, res: Response) => {
  try {
    // Use synchronous require so Vercel's esbuild statically bundles it
    const app = require('../src/server').default;
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
