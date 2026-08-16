import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

interface JwtPayload {
  sub: string;
  role: string;
  email: string;
}

/**
 * Verify JWT token from Authorization header.
 * Attaches userId and userRole to the request.
 */
export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
};

/**
 * Require admin role — must be used after authenticate middleware.
 */
export const requireAdmin = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  if (req.userRole !== 'admin') {
    throw new AppError('Admin access required', 403);
  }
  next();
};
