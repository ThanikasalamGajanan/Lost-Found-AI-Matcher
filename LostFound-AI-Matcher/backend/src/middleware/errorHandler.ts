import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  // Handle multer errors (file too large, unexpected field, etc.)
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum size is 5 MB.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected upload field. Use "photo" as the field name.'
          : err.message;
    res.status(400).json({ status: 'error', message });
    return;
  }

    console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'An unexpected error occurred',
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
