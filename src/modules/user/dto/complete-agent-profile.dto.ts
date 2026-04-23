import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
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
    example: [TransportMode.SeaCargo, TransportMode.AirCargo],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TransportMode, { each: true })
  transportModes: TransportMode[];

  @ApiPropertyOptional({
    example: '0123456789',
    description: 'Business / settlement account number (bank or platform).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  businessAccountNumber?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'HTTPS URLs when replacing the full list. If omitted, or `[]`, existing `documentUrls` from uploads are kept. ' +
      'To clear documents use PATCH /agent/documents with [].',
    example: ['https://res.cloudinary.com/.../doc.pdf'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  documentUrls?: string[];

  @ApiPropertyOptional({
    description:
      'Single logo URL (alias for `documentUrls[0]`; matches Mongo `agencyProfile.agencyLogo`).',
    example: 'https://res.cloudinary.com/.../logo.png',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  agencyLogo?: string;

  @ApiPropertyOptional({
    description:
      'Nested legacy payload `{ agencyLogo?, companyName?, ... }` merged into `agentProfile`.',
  })
  @IsOptional()
  @IsObject()
  agencyProfile?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Standalone contra price (optional; separate from local/intl rates).',
    example: 15000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  contraPrice?: number;
}
