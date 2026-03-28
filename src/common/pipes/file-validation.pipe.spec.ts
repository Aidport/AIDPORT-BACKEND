import { BadRequestException } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

  beforeEach(() => {
    pipe = new FileValidationPipe();
  });

  it('should return value when undefined', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
  });

  it('should accept valid single file', () => {
    const file = {
      fieldname: 'file',
      originalname: 'image.jpg',
      buffer: Buffer.from(''),
    } as Express.Multer.File;
    expect(pipe.transform(file)).toEqual(file);
  });

  it('should accept valid extensions: jpg, png, svg, mp4, webm, mov', () => {
    const extensions = ['photo.jpg', 'img.jpeg', 'pic.png', 'icon.svg', 'vid.mp4', 'clip.webm', 'movie.mov'];
    for (const name of extensions) {
      const file = { originalname: name, fieldname: 'f', buffer: Buffer.from('') } as Express.Multer.File;
      expect(pipe.transform(file)).toEqual(file);
    }
  });

  it('should reject invalid extension', () => {
    const file = {
      fieldname: 'file',
      originalname: 'document.pdf',
      buffer: Buffer.from(''),
    } as Express.Multer.File;
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow(/Invalid file extension.*pdf/);
  });

  it('should accept valid array of files', () => {
    const files = [
      { originalname: 'a.jpg', fieldname: 'f', buffer: Buffer.from('') },
      { originalname: 'b.png', fieldname: 'f', buffer: Buffer.from('') },
    ] as Express.Multer.File[];
    expect(pipe.transform(files)).toEqual(files);
  });

  it('should reject array with invalid file', () => {
    const files = [
      { originalname: 'a.jpg', fieldname: 'f', buffer: Buffer.from('') },
      { originalname: 'b.exe', fieldname: 'f', buffer: Buffer.from('') },
    ] as Express.Multer.File[];
    expect(() => pipe.transform(files)).toThrow(BadRequestException);
  });
});
