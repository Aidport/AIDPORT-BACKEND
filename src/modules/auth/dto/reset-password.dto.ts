import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** Legacy: `?token=` from older emails. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  token?: string;

  /** User id (Mongo ObjectId hex) — use with `reset`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string;

  /** Opaque reset segment — use with `uid` (stored as user `resetUrlToken`). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reset?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
