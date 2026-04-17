/** Align httpOnly cookie maxAge with `JwtModule` `expiresIn` (string or seconds number). */
export function jwtExpiresInToMs(expiresIn: string | number | undefined): number {
  if (expiresIn === undefined || expiresIn === null) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
    return expiresIn * 1000;
  }
  const s = String(expiresIn).trim();
  const m = /^(\d+)(s|m|h|d)$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const mult =
      unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return n * mult;
  }
  const asNum = parseInt(s, 10);
  if (!Number.isNaN(asNum) && asNum > 0) {
    return asNum * 1000;
  }
  return 7 * 24 * 60 * 60 * 1000;
}
