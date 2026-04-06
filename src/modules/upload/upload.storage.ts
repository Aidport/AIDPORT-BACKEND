import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';

const folder = process.env.CLOUDINARY_FOLDER || 'aidport';

/** Shared Multer storage for all upload endpoints (single, multiple, gallery). */
export const cloudinaryMulterStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder,
    allowed_formats: [
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
    ],
    resource_type: 'auto',
  } as Record<string, unknown>,
});

export const uploadLimits = { fileSize: 10 * 1024 * 1024 };
