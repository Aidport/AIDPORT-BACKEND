import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUrl, MaxLength } from 'class-validator';

/** Replace the list of document URLs (e.g. after POST /upload). Send [] to clear. */
export class UpdateAgentDocumentsDto {
  @ApiProperty({
    type: [String],
    description:
      'Full list of HTTPS URLs to store (replaces existing). Use URLs returned from POST /upload.',
    example: ['https://res.cloudinary.com/.../doc.pdf'],
  })
  @IsArray()
  @ArrayMaxSize(30)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  documentUrls: string[];
}
