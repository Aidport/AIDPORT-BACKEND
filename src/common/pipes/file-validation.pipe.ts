import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class FileValidationPipe
  implements PipeTransform<Express.Multer.File | Express.Multer.File[] | Record<string, Express.Multer.File[]>, any>
{
  private readonly allowedFileExtensions = [
    'jpg',
    'jpeg',
    'png',
    'svg',
    'webp',
    'gif',
    'mp4',
    'webm',
    'mov',
  ];

  transform(
    value:
      | Express.Multer.File
      | Express.Multer.File[]
      | Record<string, Express.Multer.File[]>
      | undefined,
  ): typeof value {
    if (!value) {
      return value;
    }

    if (Array.isArray(value)) {
      for (const file of value) {
        if (file?.originalname && !this.validateFileExtension(file.originalname)) {
          throw new BadRequestException({
            message: `Invalid file extension for "${file.originalname}". Allowed: [${this.allowedFileExtensions.join(', ')}]`,
          });
        }
      }
      return value;
    }

    if (this.isMulterFile(value)) {
      if (value.originalname && !this.validateFileExtension(value.originalname)) {
        throw new BadRequestException({
          message: `Invalid file extension for "${value.originalname}". Allowed: [${this.allowedFileExtensions.join(', ')}]`,
        });
      }
      return value;
    }

    if (typeof value === 'object' && value !== null) {
      for (const key of Object.keys(value)) {
        const files = (value as Record<string, unknown>)[key];
        if (!files || !Array.isArray(files) || files.length === 0) {
          continue;
        }
        for (const file of files) {
          if (file && typeof file === 'object' && 'originalname' in file) {
            const f = file as Express.Multer.File;
            if (!this.validateFileExtension(f.originalname)) {
              throw new BadRequestException({
                message: `Invalid file extension for "${f.originalname}". Allowed: [${this.allowedFileExtensions.join(', ')}]`,
              });
            }
          }
        }
      }
    }

    return value;
  }

  private isMulterFile(v: unknown): v is Express.Multer.File {
    return (
      typeof v === 'object' &&
      v !== null &&
      'fieldname' in v &&
      'originalname' in v &&
      'buffer' in v
    );
  }

  private validateFileExtension(fileName: string): boolean {
    if (!fileName || typeof fileName !== 'string') {
      return false;
    }
    const extension = fileName.split('.').pop();
    if (!extension) {
      return false;
    }
    return this.allowedFileExtensions.includes(extension.toLowerCase());
  }
}
