import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AgentPricingPlan } from '../entities/agent-profile.schema';

/** Update subscription / pricing tier on the agent profile (standalone PATCH). */
export class UpdateAgentPricingPlanDto {
  @ApiProperty({ enum: AgentPricingPlan, example: AgentPricingPlan.Premium })
  @IsEnum(AgentPricingPlan)
  pricingPlan: AgentPricingPlan;
}
