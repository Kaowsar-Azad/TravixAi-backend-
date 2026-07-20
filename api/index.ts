import { Request, Response } from 'express';
import app from '../src/server.js';

export default (req: Request, res: Response) => {
  return app(req, res);
};
