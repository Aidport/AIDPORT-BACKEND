/**
 * Parse Cloudinary delivery URLs (res.cloudinary.com/{cloud}/.../upload/...).
 * Returns public_id as stored (path after version segment) and resource type for API calls.
 */
export type CloudinaryParsedUrl = {
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
  cloudName: string;
};

export function parseCloudinaryUrl(url: string): CloudinaryParsedUrl | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('res.cloudinary.com')) {
      return null;
    }
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 4) {
      return null;
    }
    const cloudName = parts[0];
    const resourceType = parts[1];
    if (resourceType !== 'image' && resourceType !== 'video' && resourceType !== 'raw') {
      return null;
    }
    if (parts[2] !== 'upload') {
      return null;
    }
    let idx = 3;
    if (parts[idx]?.match(/^v\d+$/)) {
      idx++;
    }
    const publicId = decodeURIComponent(parts.slice(idx).join('/'));
    if (!publicId) {
      return null;
    }
    return {
      publicId,
      resourceType,
      cloudName,
    };
  } catch {
    return null;
  }
}

export function assertUrlMatchesConfiguredCloud(
  parsed: CloudinaryParsedUrl,
  expectedCloudName: string | undefined,
): void {
  if (expectedCloudName && parsed.cloudName !== expectedCloudName) {
    throw new Error('CLOUD_MISMATCH');
  }
}
