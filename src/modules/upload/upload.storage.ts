import { CloudinaryStorage } from 'multer-storage-cloudinary';
import type { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';

const folder = process.env.CLOUDINARY_FOLDER || 'aidport';

function extFromOriginalname(name: string | undefined): string {
  if (!name) {
    return '';
  }
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/**
 * Used for non-PDF uploads. Do not rely on `resource_type: 'auto'` for PDF — Cloudinary maps
 * that to **raw**, which produces `/raw/upload/...` URLs and different delivery rules than PNGs.
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
  params: async (_req: Request, file: Express.Multer.File) => {
    const ext = extFromOriginalname(file.originalname);

    // Cloudinary treats delivered PDFs like other images: `/image/upload/...file.pdf`
    // (see https://cloudinary.com/blog/uploading_managing_and_delivering_pdfs). Uploading as
    // `image` avoids `auto` → raw, which broke “open like PNG” for many accounts/browsers.
    if (ext === 'pdf') {
      return {
        folder,
        resource_type: 'image' as const,
        format: 'pdf' as const,
        access_mode: 'public' as const,
        use_filename: true,
        unique_filename: true,
      };
    }

    return {
      folder,
      allowed_formats: [...ALLOWED_FORMATS],
      resource_type: 'auto',
      access_mode: 'public' as const,
    };
  },
});

export const uploadLimits = { fileSize: 10 * 1024 * 1024 };
