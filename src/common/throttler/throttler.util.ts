import { createHash } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';

/** Stable key per tracker + throttler (not per route — default Nest throttler keys by handler name). */
export function rateLimitKey(tracker: string, throttlerName: string): string {
  return createHash('md5').update(`${throttlerName}:${tracker}`).digest('hex');
}

export function globalThrottleGenerateKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string,
): string {
  return rateLimitKey(tracker, throttlerName);
}

export function loginThrottleGenerateKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string,
): string {
  return rateLimitKey(tracker, throttlerName);
}

/** Client IP, honoring `X-Forwarded-For` when present (set Express `trust proxy` in production behind a load balancer). */
export function getClientIp(req: Record<string, unknown>): string {
  const xff = req.headers && (req.headers as Record<string, unknown>)['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).trim();
  }
  const r = req as { ip?: string; socket?: { remoteAddress?: string } };
  return (r.ip || r.socket?.remoteAddress || 'unknown') as string;
}

export function getLoginAccountTracker(req: Record<string, unknown>): string {
  const body = req.body as { email?: string } | undefined;
  const email = body?.email;
  if (typeof email === 'string' && email.trim()) {
    return `login:${email.trim().toLowerCase()}`;
  }
  return `login:${getClientIp(req)}`;
}

export function shouldSkipHealthThrottle(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<{ path?: string }>();
  const path = req.path || '';
  return path === '/' || path === '/health' || path.endsWith('/health');
}

export function shouldSkipLoginThrottle(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<{ method?: string; path?: string }>();
  if (req.method !== 'POST') {
    return true;
  }
  const path = req.path || '';
  return path !== '/auth/login' && path !== '/auth/login/agent';
}
