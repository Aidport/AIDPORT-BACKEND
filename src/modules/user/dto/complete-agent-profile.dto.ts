import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ArrayMinSize,
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
}
