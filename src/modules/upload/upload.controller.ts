import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';

const folder = process.env.CLOUDINARY_FOLDER || 'aidport';

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder,
    allowed_formats: ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif', 'mp4', 'webm', 'mov'],
    resource_type: 'auto',
  } as Record<string, unknown>,
});

@ApiTags('Upload')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @Post('single')
  @ApiOperation({
    summary: 'Upload a single file to Cloudinary',
    description:
      'Multipart field name: `file`. Max 10MB. Images/video via Multer + CloudinaryStorage.',
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
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadSingle(
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const cloudinaryFile = file as Express.Multer.File & { path?: string; filename?: string };
    return {
      filename: cloudinaryFile.filename,
      originalName: cloudinaryFile.originalname,
      url: cloudinaryFile.path,
      path: cloudinaryFile.path,
    };
  }

  @Post('multiple')
  @ApiOperation({
    summary: 'Upload up to 10 files to Cloudinary',
    description: 'Multipart field name: `files` (array). Max 10MB per file.',
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
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadMultiple(
    @UploadedFiles(new FileValidationPipe()) files: Express.Multer.File[] | undefined,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    return files.map((file) => {
      const cloudinaryFile = file as Express.Multer.File & { path?: string };
      return {
        filename: cloudinaryFile.filename,
        originalName: cloudinaryFile.originalname,
        url: cloudinaryFile.path,
        path: cloudinaryFile.path,
      };
    });
  }
}
