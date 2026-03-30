import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import {
  AgentPricingPlan,
  TransportMode,
} from '../entities/agent-profile.schema';

/** Step 2 of agent onboarding: sent with Bearer token after step 1 signup. */
export class CompleteAgentProfileDto {
  @ApiProperty({ enum: AgentPricingPlan, example: AgentPricingPlan.Basic })
  @IsEnum(AgentPricingPlan)
  pricingPlan: AgentPricingPlan;

  @ApiProperty({ example: 'Acme Logistics Ltd' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName: string;

  @ApiProperty({ example: '2018-06-15', description: 'ISO date (company founded)' })
  @IsDateString()
  dateEstablished: string;

  @ApiProperty({ example: 'Lagos, Nigeria' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  location: string;

  @ApiProperty({ example: 'Full-service freight forwarding since 2018.' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  aboutCompany: string;

  @ApiProperty({
    enum: TransportMode,
    isArray: true,
    example: [TransportMode.Sea, TransportMode.Land],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TransportMode, { each: true })
  transportModes: TransportMode[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'HTTPS URLs from POST /upload (e.g. PDFs or Word docs). Omit to keep existing links.',
    example: ['https://res.cloudinary.com/.../doc.pdf'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  documentUrls?: string[];
}
