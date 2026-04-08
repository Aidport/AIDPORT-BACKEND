import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Line on admin-sent invoice (parcel + price). */
export class InvoiceParcelItemDto {
  @ApiProperty({ example: 'Electronics box', description: 'Also accepted: `title`' })
  @Transform(({ value, obj }) => (value ?? obj?.title ?? '') as string)
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ example: 15000, description: 'Also accepted: `amount`' })
  @Transform(({ value, obj }) => {
    const v = value ?? obj?.amount;
    return v === undefined || v === null ? v : Number(v);
  })
  @IsNumber()
  @Min(0)
  price: number;
}

export class SendInvoiceDto {
  @ApiProperty({
    type: [InvoiceParcelItemDto],
    description:
      'Line items. The same array may be sent as `parcelItems` (preferred) or `items` (alias for front-end compatibility).',
  })
  @Transform(({ obj }) => obj.parcelItems ?? obj.items)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceParcelItemDto)
  parcelItems: InvoiceParcelItemDto[];

  @ApiProperty({ example: 45000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiProperty({
    description: 'Paystack payment link for the shipper',
    example: 'https://paystack.com/pay/xxxxx',
  })
  @IsString()
  @MinLength(8)
  paymentLink: string;
}
