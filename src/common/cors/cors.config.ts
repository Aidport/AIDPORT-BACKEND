/** Production web apps allowed to call this API from the browser (Origin header). */
export const DEFAULT_CORS_ORIGINS = [
  'https://admin-zeta-eight-76.vercel.app',
  'https://aidport-web.vercel.app',
  'https://aidport-admin.vercel.app/',
] as const;

export function getAllowedCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [...DEFAULT_CORS_ORIGINS];
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const allowed = getAllowedCorsOrigins();
  if (!origin) {
    callback(null, true);
    return;
  }
  callback(null, allowed.includes(origin));
}
