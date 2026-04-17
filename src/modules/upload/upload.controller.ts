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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { cloudinaryMulterStorage, uploadLimits } from './upload.storage';
import { UploadService } from './upload.service';
import { UserService } from '../user/user.service';
import {
  BatchDeleteUploadDto,
  DeleteUploadDto,
  GetUploadResourceQueryDto,
} from './dto/upload-mutation.dto';

function mapUploaded(
  file: Express.Multer.File & {
    path?: string;
    filename?: string;
    secure_url?: string;
  },
) {
  const url =
    file.path ||
    file.secure_url ||
    (file as { secureUrl?: string }).secureUrl ||
    '';
  return {
    filename: file.filename,
    originalName: file.originalname,
    url,
    path: url,
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

@ApiTags('Upload')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly userService: UserService,
  ) {}

  @Get('resource')
  @ApiOperation({
    summary: 'Get Cloudinary resource metadata (read)',
    description: 'Returns Cloudinary API resource details for a delivery URL in this account.',
  })
  async getResource(@Query() query: GetUploadResourceQueryDto) {
    return this.uploadService.getResourceByUrl(query.url);
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
      'Query `attachTo=agent` (agents only) appends new file URLs to `agentProfile.documentUrls` so they appear on GET /agent/me.',
  })
  @ApiQuery({
    name: 'attachTo',
    required: false,
    description: 'Set to `agent` to append newly uploaded file URLs to the agent profile (same as POST /upload/single).',
    enum: ['agent'],
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
      storage: cloudinaryMulterStorage,
      limits: uploadLimits,
    }),
  )
  async patchGallery(
    @UploadedFiles(new FileValidationPipe()) files: Express.Multer.File[] | undefined,
    @Body('existingUrls') existingUrlsRaw?: string,
    @Body('removeUrls') removeUrlsRaw?: string,
    @Query('attachTo') attachTo?: string,
    @CurrentUser('id') userId?: string,
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
    const added = fileList.map((f) =>
      mapUploaded(f as Express.Multer.File & { path?: string; filename?: string }),
    );
    const newUrls = added.map((a) => a.url).filter(Boolean) as string[];

    const base = {
      urls: [...existingUrls, ...newUrls],
      added,
      removed: removalResult.deleted,
      removalFailed: removalResult.failed.length ? removalResult.failed : undefined,
    };

    if (attachTo === 'agent' && newUrls.length > 0 && userId) {
      const userResp = await this.userService.appendAgentDocumentUrls(userId, newUrls);
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
      'Multipart field name: `file`. Max 10MB. Images, video, PDF, and Word docs via Multer + CloudinaryStorage. ' +
      'Query `attachTo=agent` (agents only) appends the returned URL to `agentProfile.documentUrls` so GET /agent/me includes it.',
  })
  @ApiQuery({
    name: 'attachTo',
    required: false,
    description: 'Set to `agent` to save the uploaded file URL on the authenticated agent profile.',
    enum: ['agent'],
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
      storage: cloudinaryMulterStorage,
      limits: uploadLimits,
    }),
  )
  async uploadSingle(
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File | undefined,
    @Query('attachTo') attachTo?: string,
    @CurrentUser('id') userId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const mapped = mapUploaded(file as Express.Multer.File & { path?: string; filename?: string });
    if (attachTo === 'agent' && userId && mapped.url) {
      const userResp = await this.userService.appendAgentDocumentUrls(userId, [mapped.url]);
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
      'Multipart field name: `files` (array). Max 10MB per file. Same types as single upload. ' +
      'Query `attachTo=agent` appends all returned URLs to the agent profile.',
  })
  @ApiQuery({
    name: 'attachTo',
    required: false,
    description: 'Set to `agent` to save all uploaded file URLs on the authenticated agent profile.',
    enum: ['agent'],
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
      storage: cloudinaryMulterStorage,
      limits: uploadLimits,
    }),
  )
  async uploadMultiple(
    @UploadedFiles(new FileValidationPipe()) files: Express.Multer.File[] | undefined,
    @Query('attachTo') attachTo?: string,
    @CurrentUser('id') userId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    const mapped = files.map((file) =>
      mapUploaded(file as Express.Multer.File & { path?: string; filename?: string }),
    );
    if (attachTo === 'agent' && userId) {
      const urls = mapped.map((m) => m.url).filter(Boolean) as string[];
      if (urls.length > 0) {
        const userResp = await this.userService.appendAgentDocumentUrls(userId, urls);
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
