import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
  try {
    // Dynamically import the app to catch initialization errors (e.g., DB connect or dotenv)
    const appModule = await import('../src/server');
    const app = appModule.default;
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Function Crash Error:", err);
    res.status(500).json({
      error: "Vercel Function Initialization Error",
      message: err.message,
      stack: err.stack,
      name: err.name
    });
  }
};
