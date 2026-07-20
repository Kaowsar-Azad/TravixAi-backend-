import { Request, Response } from 'express';
import app from '../src/server';

export default (req: Request, res: Response) => {
  return app(req, res);
};
