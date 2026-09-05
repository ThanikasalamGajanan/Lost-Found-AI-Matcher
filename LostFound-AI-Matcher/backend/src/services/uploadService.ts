import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { supabaseAdmin } from '../db/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_BUCKET = 'item-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * Multer instance that stores files in memory and validates type/size.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(
        `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        400
      ));
    }
  },
});

/**
 * Optimise an image buffer with sharp (resize + webp conversion).
 */
async function optimiseImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()                                    // auto-orient from EXIF
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/**
 * Save processed image to local uploads/ directory (fallback for dev).
 */
async function saveLocally(processed: Buffer): Promise<string> {
  const fileName = `${uuid()}.webp`;
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'items');
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, processed);
  // Return full URL so it passes Joi URI validation
  const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`;
  return `${baseUrl}/uploads/items/${fileName}`;
}

/**
 * Upload to Supabase Storage bucket.
 */
async function uploadToSupabase(processed: Buffer): Promise<string> {
  const fileName = `${uuid()}.webp`;
  const filePath = `items/${fileName}`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, processed, {
      contentType: 'image/webp',
      cacheControl: '31536000',   // 1 year (immutable filename)
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase storage error: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Optimise an image buffer with sharp (resize + webp conversion)
 * and upload it. Tries Supabase Storage first, falls back to local
 * file system when storage is unavailable (e.g. local dev).
 */
export async function processAndUpload(
  buffer: Buffer,
  _originalMime: string
): Promise<string> {
  const processed = await optimiseImage(buffer);

  try {
    return await uploadToSupabase(processed);
  } catch (err) {
    console.warn('[UPLOAD] Supabase storage unavailable, saving locally:', (err as Error).message);
    return await saveLocally(processed);
  }
}
