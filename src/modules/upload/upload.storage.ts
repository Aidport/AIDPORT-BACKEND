import { CloudinaryStorage } from 'multer-storage-cloudinary';
import type { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';

const folder = process.env.CLOUDINARY_FOLDER || 'aidport';

/**
 * Single upload path for all allowed types (including PDF). Using `resource_type: 'auto'`
 * lets Cloudinary store PDFs like images (`/image/upload/...pdf`) so public links open in
 * the browser the same way as PNGs. The old `raw`-only path for PDFs produced `/raw/upload/...`
 * URLs that often failed to open or preview like normal image assets.
 */
const ALLOWED_FORMATS = [
  'jpg',
  'jpeg',
  'png',
  'svg',
  'webp',
  'gif',
  'mp4',
  'webm',
  'mov',
  'pdf',
  'doc',
  'docx',
] as const;

/** Shared Multer storage for all upload endpoints (single, multiple, gallery). */
export const cloudinaryMulterStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Request, _file: Express.Multer.File) => ({
    folder,
    allowed_formats: [...ALLOWED_FORMATS],
    resource_type: 'auto',
    access_mode: 'public' as const,
  }),
});

export const uploadLimits = { fileSize: 10 * 1024 * 1024 };
