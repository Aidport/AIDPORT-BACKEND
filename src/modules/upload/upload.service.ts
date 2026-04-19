import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import {
  assertUrlMatchesConfiguredCloud,
  parseCloudinaryUrl,
} from './cloudinary-url.util';

function fileNameFromDeliveryUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop() || 'file';
    const decoded = decodeURIComponent(seg).replace(/["\r\n]/g, '');
    return decoded || 'file';
  } catch {
    return 'file';
  }
}

@Injectable()
export class UploadService {
  private get expectedCloudName(): string | undefined {
    return process.env.CLOUDINARY_CLOUD_NAME;
  }

  /** Delete one asset by delivery URL. */
  async deleteByUrl(url: string): Promise<{ deleted: true; url: string }> {
    const parsed = this.parseAndAuthorize(url);
    const ok = await this.destroyWithFallback(parsed.publicId, parsed.resourceType);
    if (!ok) {
      throw new NotFoundException('Asset not found on Cloudinary');
    }
    return { deleted: true, url };
  }

  /** Delete many assets; continues on partial failure and reports errors. */
  async deleteByUrls(urls: string[]): Promise<{
    deleted: string[];
    failed: { url: string; reason: string }[];
  }> {
    const deleted: string[] = [];
    const failed: { url: string; reason: string }[] = [];
    for (const url of urls) {
      try {
        const r = await this.deleteByUrl(url);
        deleted.push(r.url);
      } catch (e: unknown) {
        const msg =
          e instanceof BadRequestException || e instanceof ForbiddenException
            ? (e as BadRequestException).message
            : e instanceof NotFoundException
              ? (e as NotFoundException).message
              : e instanceof Error
                ? e.message
                : String(e);
        failed.push({ url, reason: msg });
      }
    }
    return { deleted, failed };
  }

  /** Same account check as metadata fetch — for public redirect endpoint. */
  assertDeliveryUrlInAccount(url: string): void {
    this.parseAndAuthorize(url);
  }

  /**
   * Proxy the file through this API with headers suitable for iframe/embed and new-tab viewing.
   * Cross-origin `res.cloudinary.com` URLs often fail inside iframes on SPAs; pointing `iframe src`
   * at `GET /upload/stream?url=...` (same API host) avoids that class of browser errors.
   */
  async streamDeliveryInline(url: string, res: Response): Promise<void> {
    this.assertDeliveryUrlInAccount(url);
    const upstream = await fetch(url, { redirect: 'follow' });
    if (!upstream.ok) {
      throw new BadRequestException(`Could not fetch file (${upstream.status})`);
    }
    let ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const pathLower = new URL(url).pathname.toLowerCase();
    if (pathLower.endsWith('.pdf') && !ct.toLowerCase().includes('pdf')) {
      ct = 'application/pdf';
    }
    res.setHeader('Content-Type', ct);
    const safeName = fileNameFromDeliveryUrl(url);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    const body = upstream.body;
    if (!body) {
      throw new BadRequestException('Empty body');
    }
    try {
      await pipeline(Readable.fromWeb(body as import('stream/web').ReadableStream), res);
    } catch (err) {
      if (!res.headersSent) {
        throw err;
      }
    }
  }

  /** Cloudinary API resource metadata (read). */
  async getResourceByUrl(url: string): Promise<Record<string, unknown>> {
    const parsed = this.parseAndAuthorize(url);
    try {
      return await cloudinary.api.resource(parsed.publicId, {
        resource_type: parsed.resourceType,
      });
    } catch (err: unknown) {
      const http = err as { http_code?: number; message?: string };
      if (http?.http_code === 404) {
        throw new NotFoundException('Resource not found');
      }
      throw new BadRequestException(http?.message ?? 'Failed to fetch resource');
    }
  }

  private parseAndAuthorize(url: string) {
    const parsed = parseCloudinaryUrl(url);
    if (!parsed) {
      throw new BadRequestException('Not a valid Cloudinary URL');
    }
    try {
      assertUrlMatchesConfiguredCloud(parsed, this.expectedCloudName);
    } catch {
      throw new ForbiddenException('URL does not belong to this application Cloudinary account');
    }
    return parsed;
  }

  private async destroyWithFallback(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw',
  ): Promise<boolean> {
    const tryDestroy = async (id: string) =>
      cloudinary.uploader.destroy(id, { resource_type: resourceType });

    let res = await tryDestroy(publicId);
    if (res.result === 'ok') {
      return true;
    }
    if (res.result === 'not found') {
      return false;
    }

    const lastDot = publicId.lastIndexOf('.');
    if (lastDot > 0) {
      const withoutExt = publicId.slice(0, lastDot);
      res = await tryDestroy(withoutExt);
      if (res.result === 'ok') {
        return true;
      }
      if (res.result === 'not found') {
        return false;
      }
    }

    return false;
  }
}
