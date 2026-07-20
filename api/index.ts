import { Request, Response } from 'express';
import app from '../dist/server.js';

export default (req: Request, res: Response) => {
  return app(req, res);
};
