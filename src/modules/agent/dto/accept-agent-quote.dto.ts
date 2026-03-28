import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class AcceptAgentQuoteDto {
  /** Optional initial rate applied to the shipment when accepting */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;
}
