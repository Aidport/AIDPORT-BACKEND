import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
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

export class CreateAgentDto {
  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

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
