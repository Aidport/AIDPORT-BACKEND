import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, IsUrl } from 'class-validator';

export class DeleteUploadDto {
  @ApiProperty({
    description: 'Full Cloudinary delivery URL for this account',
    example: 'https://res.cloudinary.com/your-cloud/image/upload/v123/aidport/photo.jpg',
  })
  @IsUrl({ require_tld: false })
  url: string;
}

export class BatchDeleteUploadDto {
  @ApiProperty({
    type: [String],
    description: 'Cloudinary delivery URLs to delete',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({ require_tld: false }, { each: true })
  urls: string[];
}

export class GetUploadResourceQueryDto {
  @ApiProperty({ description: 'Cloudinary delivery URL' })
  @IsUrl({ require_tld: false })
  url: string;
}
