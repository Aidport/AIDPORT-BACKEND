import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { uploadLimits } from './upload.storage';
import { UploadService } from './upload.service';
import { UserService } from '../user/user.service';
import {
  BatchDeleteUploadDto,
  DeleteUploadDto,
  GetUploadResourceQueryDto,
} from './dto/upload-mutation.dto';

function mapCloudinaryUpload(
  result: { secure_url: string; public_id: string },
  originalClientName: string,
) {
  const url = result.secure_url;
  return {
    filename: result.public_id,
    originalName: originalClientName,
    /** Public HTTPS delivery URL — open in a new tab, `<a href>`, `<img src>` — no login. */
    url,
    path: url,
    publicUrl: url,
  };
}

function parseUrlArrayField(raw: unknown, field: string): string[] {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new BadRequestException(`${field} must be valid JSON array of URL strings`);
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException(`${field} must be a JSON array`);
  }
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string' || !item.trim()) {
      throw new BadRequestException(`${field} must contain only non-empty URL strings`);
    }
    try {
      new URL(item);
    } catch {
      throw new BadRequestException(`Invalid URL in ${field}`);
    }
    out.push(item);
  }
  return out;
}

export type JwtUserPayload = { id: string; role: string; email?: string };

function isAgentRole(role: string | undefined): boolean {
  return String(role ?? '').toLowerCase() === 'agent';
}

/** Agents: always persist upload URLs to MongoDB unless the client opts out (`attachTo=none`). */
function shouldSaveUrlsToAgentProfile(
  attachTo: string | undefined,
  userRole: string | undefined,
): boolean {
  const v = attachTo?.trim().toLowerCase();
  if (v === 'none' || v === 'off' || v === 'false' || v === '0') {
    return false;
  }
  return isAgentRole(userRole);
}

@ApiTags('Upload')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly userService: UserService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get('resource')
  @ApiOperation({
    summary: 'Get Cloudinary resource metadata (read)',
    description:
      'Public, no JWT. Returns Cloudinary API resource details for a delivery URL in this account. ' +
      'To **view** a file like a normal website: open the stored `https://res.cloudinary.com/...` URL in a new tab or use it as `href` / `src` — no API call needed.',
  })
  async getResource(@Query() query: GetUploadResourceQueryDto) {
    return this.uploadService.getResourceByUrl(query.url);
  }

  /**
   * Public 302 to the Cloudinary URL — use when something must hit this API host first (iframes, legacy links).
   * Prefer linking to `res.cloudinary.com` directly to avoid an extra hop.
   */
  @Public()
  @SkipThrottle()
  @Get('open')
  @ApiOperation({
    summary: 'Redirect to file on Cloudinary (public)',
    description:
      'Public, no JWT. Query `url` = full HTTPS delivery URL for this CLOUDINARY_CLOUD_NAME. Returns 302 to the CDN.',
  })
  openDeliveryUrl(
    @Query() query: GetUploadResourceQueryDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    this.uploadService.assertDeliveryUrlInAccount(query.url);
    res.redirect(302, query.url);
  }

  /**
   * Same-origin proxy for Cloudinary bytes — use for `<iframe>` / `<embed>` when direct Cloudinary
   * links show "Unsafe attempt to load URL" or similar. Query `url` = full HTTPS delivery URL.
   */
  @Public()
  @SkipThrottle()
  @Get('stream')
  @ApiOperation({
    summary: 'Stream file for viewing (public proxy)',
    description:
      'Public, no JWT. Same-origin proxy for iframe/embed edge cases. Normal use: open the `url` / `publicUrl` from the upload response directly (public Cloudinary link).',
  })
  async streamDeliveryUrl(
    @Query() query: GetUploadResourceQueryDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.uploadService.streamDeliveryInline(query.url, res);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete one file from Cloudinary',
    description:
      'Removes the asset by delivery URL. Only URLs for the configured CLOUDINARY_CLOUD_NAME are allowed.',
  })
  @ApiBody({ type: DeleteUploadDto })
  async deleteOne(@Body() dto: DeleteUploadDto) {
    return this.uploadService.deleteByUrl(dto.url);
  }

  @Post('remove-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete multiple files from Cloudinary',
    description:
      'Attempts each URL; returns lists of succeeded and failed deletions. Invalid URLs are reported in failed.',
  })
  @ApiBody({ type: BatchDeleteUploadDto })
  async removeBatch(@Body() dto: BatchDeleteUploadDto) {
    return this.uploadService.deleteByUrls(dto.urls);
  }

  @Patch('gallery')
  @ApiOperation({
    summary: 'Edit gallery: remove URLs + add new uploads',
    description:
      'Multipart: `files` (0–10 new files). Form fields `existingUrls` and `removeUrls` are JSON string arrays of Cloudinary URLs. ' +
      'Removals are deleted from Cloudinary first, then new files are merged after `existingUrls`. ' +
      '`existingUrls` must not overlap `removeUrls`. ' +
      'Agents: new file URLs are always saved to `agentProfile.documentUrls` (same as POST /upload/single). `attachTo=none` = Cloudinary only, skip DB.',
  })
  @ApiQuery({
    name: 'attachTo',
    required: false,
    description: 'Agents default to saving in MongoDB. Set `none` to skip.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'New files to add (optional)',
        },
        existingUrls: {
          type: 'string',
          description: 'JSON array of URLs to keep, e.g. ["https://..."]',
        },
        removeUrls: {
          type: 'string',
          description: 'JSON array of URLs to delete from Cloudinary, e.g. ["https://..."]',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: uploadLimits,
    }),
  )
  async patchGallery(
    @CurrentUser() user: JwtUserPayload,
    @UploadedFiles(new FileValidationPipe()) files: Express.Multer.File[] | undefined,
    @Body('existingUrls') existingUrlsRaw?: string,
    @Body('removeUrls') removeUrlsRaw?: string,
    @Query('attachTo') attachTo?: string,
  ) {
    const existingUrls = parseUrlArrayField(existingUrlsRaw, 'existingUrls');
    const removeUrls = parseUrlArrayField(removeUrlsRaw, 'removeUrls');
    const removeSet = new Set(removeUrls);
    for (const u of existingUrls) {
      if (removeSet.has(u)) {
        throw new BadRequestException(
          'existingUrls cannot include a URL that is also listed in removeUrls',
        );
      }
    }

    const removalResult = await this.uploadService.deleteByUrls(removeUrls);
    const fileList = files ?? [];
    let added;
    try {
      added = await Promise.all(
        fileList.map(async (f) => {
          const result = await this.uploadService.uploadFromMulterFile(f);
          return mapCloudinaryUpload(result, f.originalname);
        }),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }
    const newUrls = added.map((a) => a.url).filter(Boolean) as string[];

    const base = {
      urls: [...existingUrls, ...newUrls],
      added,
      removed: removalResult.deleted,
      removalFailed: removalResult.failed.length ? removalResult.failed : undefined,
    };

    if (
      shouldSaveUrlsToAgentProfile(attachTo, user?.role) &&
      newUrls.length > 0 &&
      user?.id
    ) {
      const userResp = await this.userService.appendAgentDocumentUrls(user.id, newUrls);
      return {
        ...base,
        savedToAgentProfile: true,
        agentProfile: userResp.agentProfile,
      };
    }

    return base;
  }

  @Post('single')
  @ApiOperation({
    summary: 'Upload a single file to Cloudinary',
    description:
      'Multipart field name: `file`. Max 10MB. Response `url` / `publicUrl` are **public** Cloudinary HTTPS links — use them like any normal file host (`target="_blank"`, `<img src>`, PDF links); no auth to view. PDFs are stored under `image/upload` like Cloudinary recommends; on the **Free** plan you must allow PDF delivery in the Cloudinary console (Settings → Security). **Agents:** also saved to `agentProfile.documentUrls` unless `attachTo=none`.',
  })
  @ApiQuery({
    name: 'attachTo',
    required: false,
    description: 'Agents: omit = save to DB. `none` = return URL only.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'File to upload' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: uploadLimits,
    }),
  )
  async uploadSingle(
    @CurrentUser() user: JwtUserPayload,
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File | undefined,
    @Query('attachTo') attachTo?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    let mapped;
    try {
      const result = await this.uploadService.uploadFromMulterFile(file);
      mapped = mapCloudinaryUpload(result, file.originalname);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }
    if (!mapped.url?.trim()) {
      throw new BadRequestException(
        'Upload did not return a Cloudinary URL. Check CLOUDINARY_CLOUD_NAME / API keys and that the file was accepted.',
      );
    }
    if (shouldSaveUrlsToAgentProfile(attachTo, user?.role) && user?.id) {
      const userResp = await this.userService.appendAgentDocumentUrls(user.id, [mapped.url]);
      return {
        ...mapped,
        savedToAgentProfile: true,
        agentProfile: userResp.agentProfile,
      };
    }
    return mapped;
  }

  @Post('multiple')
  @ApiOperation({
    summary: 'Upload up to 10 files to Cloudinary',
    description:
      'Each item includes `url` / `publicUrl` — **public** HTTPS links (same as any normal file CDN). **Agents:** URLs appended to `agentProfile.documentUrls` unless `attachTo=none`.',
  })
  @ApiQuery({
    name: 'attachTo',
    required: false,
    description: 'Agents: omit = save to DB. `none` = URLs in response only.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Multiple files',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: uploadLimits,
    }),
  )
  async uploadMultiple(
    @CurrentUser() user: JwtUserPayload,
    @UploadedFiles(new FileValidationPipe()) files: Express.Multer.File[] | undefined,
    @Query('attachTo') attachTo?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    let mapped;
    try {
      mapped = await Promise.all(
        files.map(async (file) => {
          const result = await this.uploadService.uploadFromMulterFile(file);
          return mapCloudinaryUpload(result, file.originalname);
        }),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }
    for (const m of mapped) {
      if (!m.url?.trim()) {
        throw new BadRequestException(
          'One or more uploads did not return a Cloudinary URL. Check CLOUDINARY configuration.',
        );
      }
    }
    if (shouldSaveUrlsToAgentProfile(attachTo, user?.role) && user?.id) {
      const urls = mapped.map((m) => m.url).filter(Boolean) as string[];
      if (urls.length > 0) {
        const userResp = await this.userService.appendAgentDocumentUrls(user.id, urls);
        return {
          files: mapped,
          savedToAgentProfile: true,
          agentProfile: userResp.agentProfile,
        };
      }
    }
    return mapped;
  }
}
