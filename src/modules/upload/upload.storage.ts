import { CloudinaryStorage } from 'multer-storage-cloudinary';
import type { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';

const folder = process.env.CLOUDINARY_FOLDER || 'aidport';

/** PDFs / Office docs as `raw` → `/raw/upload/...` URLs; browsers embed more reliably than `/image/upload/...pdf`. */
const RAW_DOCUMENT_EXT = new Set(['pdf', 'doc', 'docx']);

function extFromOriginalname(name: string | undefined): string {
  if (!name) {
    return '';
  }
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

const IMAGE_AND_MEDIA_FORMATS = [
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
  params: async (_req: Request, file: Express.Multer.File) => {
    const ext = extFromOriginalname(file.originalname);
    if (RAW_DOCUMENT_EXT.has(ext)) {
      return {
        folder,
        resource_type: 'raw' as const,
        /** Anyone with the HTTPS link can open it — same as normal public file hosting. */
        access_mode: 'public' as const,
      };
    }
    return {
      folder,
      allowed_formats: [...IMAGE_AND_MEDIA_FORMATS],
      resource_type: 'auto',
      access_mode: 'public' as const,
    };
  },
});

export const uploadLimits = { fileSize: 10 * 1024 * 1024 };
