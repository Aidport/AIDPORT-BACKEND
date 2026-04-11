import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/** Nested @ValidateNested() errors live in `children`; constraints on the parent are often empty. */
export function flattenValidationMessages(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  const out: string[] = [];
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints && Object.keys(err.constraints).length > 0) {
      for (const msg of Object.values(err.constraints)) {
        out.push(`${path}: ${msg}`);
      }
    }
    if (err.children?.length) {
      out.push(...flattenValidationMessages(err.children, path));
    }
  }
  return out;
}

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: unknown, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true,
    });
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      const messages = flattenValidationMessages(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: messages.length ? messages : ['Request body failed validation'],
      });
    }
    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
