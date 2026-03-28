import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';

const folder = process.env.CLOUDINARY_FOLDER || 'aidport';

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder,
    allowed_formats: ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif', 'mp4', 'webm', 'mov'],
    resource_type: 'auto',
  } as Record<string, unknown>,
});

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @Post('single')
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
