import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError, asyncHandler } from './errorHandler.js';
import { queryOne } from '../db/pool.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userEmail?: string;
}

interface JwtPayload {
  sub: string;
  role: string;
  email: string;
}

/**
 * Verify JWT token from Authorization header.
 * Attaches userId, userRole and userEmail to the request.
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
    req.userEmail = decoded.email;
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
};

/**
 * Require admin role — must be used after authenticate middleware.
 * Verifies the role against the database, not just the JWT claim.
 */
export const requireAdmin = asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  if (!req.userId) {
    throw new AppError('Authentication required', 401);
  }

  const user = await queryOne<{ role: string }>(
    'SELECT role FROM users WHERE id = $1',
    [req.userId]
  );

  if (user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  next();
});
