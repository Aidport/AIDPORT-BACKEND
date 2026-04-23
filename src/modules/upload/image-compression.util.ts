import sharp from 'sharp';

function extFromOriginalname(name: string | undefined): string {
  if (!name) {
    return '';
  }
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function replaceExtension(filename: string, newExtWithDot: string): string {
  const i = filename.lastIndexOf('.');
  if (i <= 0) {
    return `${filename}${newExtWithDot}`;
  }
  return `${filename.slice(0, i)}${newExtWithDot}`;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** JPEG / PNG / WebP only — GIF (animation) and SVG are left unchanged. */
const RASTER_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

/**
 * For large photos, re-encode to WebP (smaller) and cap longest edge so uploads are ~≤ target bytes when possible.
 * PDFs, videos, Office docs pass through unchanged.
 */
export async function maybeCompressRasterForUpload(
  buffer: Buffer,
  originalname: string,
): Promise<{ buffer: Buffer; effectiveName: string }> {
  const minBytes = parsePositiveInt(process.env.UPLOAD_COMPRESS_MIN_BYTES, 1024 * 1024);
  const targetBytes = parsePositiveInt(process.env.UPLOAD_COMPRESS_TARGET_BYTES, 1024 * 1024);

  const ext = extFromOriginalname(originalname);
  if (!RASTER_EXT.has(ext) || buffer.length <= minBytes) {
    return { buffer, effectiveName: originalname };
  }

  let edge = parsePositiveInt(process.env.UPLOAD_COMPRESS_MAX_EDGE_PX, 2048);
  const minEdge = 960;

  try {
    let quality = 82;
    let out = await sharp(buffer)
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();

    while (out.length > targetBytes && quality > 42) {
      quality -= 8;
      out = await sharp(buffer)
        .rotate()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toBuffer();
    }

    while (out.length > targetBytes && edge > minEdge) {
      edge = Math.max(minEdge, Math.floor(edge * 0.85));
      out = await sharp(buffer)
        .rotate()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: Math.max(quality, 55), effort: 6 })
        .toBuffer();
    }

    const effectiveName = replaceExtension(originalname, '.webp');
    return { buffer: out, effectiveName };
  } catch {
    return { buffer, effectiveName: originalname };
  }
}
