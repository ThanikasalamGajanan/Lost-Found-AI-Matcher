import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { supabaseAdmin } from '../db/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

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
 * Optimise an image buffer with sharp (resize + webp conversion)
 * and upload it to the Supabase Storage bucket.
 * Returns the public URL of the uploaded file.
 */
export async function processAndUpload(
  buffer: Buffer,
  _originalMime: string
): Promise<string> {
  // Normalise to webp, cap at 1280px wide (preserves aspect ratio)
  const processed = await sharp(buffer)
    .rotate()                                    // auto-orient from EXIF
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

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
    throw new AppError(`Storage upload failed: ${error.message}`, 500);
  }

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}
