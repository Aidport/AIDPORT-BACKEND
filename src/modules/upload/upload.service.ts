import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import {
  assertUrlMatchesConfiguredCloud,
  parseCloudinaryUrl,
} from './cloudinary-url.util';

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
