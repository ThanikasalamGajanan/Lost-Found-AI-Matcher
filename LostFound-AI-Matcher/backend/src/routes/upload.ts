import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { supabaseAdmin } from '../db/supabase.js';

export const uploadRoutes = Router();

// All upload routes require authentication
uploadRoutes.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('Only image files are allowed', 400));
      return;
    }
    cb(null, true);
  },
});

// ────────────────────────────────────────────────
// POST /api/upload
// ────────────────────────────────────────────────
uploadRoutes.post(
  '/',
  upload.single('photo'),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.file) {
      throw new AppError('No image file provided (field name: "photo")', 400);
    }

    const originalExt = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const fileName = `${uuidv4()}${originalExt}`;

    // Resize image to max 800px width while keeping aspect ratio
    const resizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .toBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from('item-photos')
      .upload(fileName, resizedBuffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new AppError(`Upload failed: ${uploadError.message}`, 500);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('item-photos')
      .getPublicUrl(fileName);

    res.status(201).json({
      url: publicUrlData.publicUrl,
      fileName,
    });
  })
);
