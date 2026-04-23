const folder = process.env.CLOUDINARY_FOLDER || 'aidport';

function extFromOriginalname(name: string | undefined): string {
  if (!name) {
    return '';
  }
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

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

export function buildCloudinaryUploadParams(originalname: string): Record<string, unknown> {
  const ext = extFromOriginalname(originalname);

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
}

/** Max multipart file size (bytes) before Multer rejects the request. */
export const uploadLimits = { fileSize: 10 * 1024 * 1024 };
