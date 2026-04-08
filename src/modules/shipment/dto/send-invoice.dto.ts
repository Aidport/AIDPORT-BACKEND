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
  @ApiProperty({ example: 'Electronics box' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ example: 15000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

function normalizeInvoiceLineItems(
  parcelItems: unknown,
  items: unknown,
): Record<string, unknown>[] {
  const list = parcelItems ?? items;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((row: Record<string, unknown>) => {
    const name = (row.name ?? row.title ?? '') as string;
    const rawPrice = row.price ?? row.amount;
    const price =
      rawPrice === undefined || rawPrice === null
        ? undefined
        : Number(rawPrice);
    const rawQty = row.quantity;
    const quantity =
      rawQty === undefined || rawQty === null
        ? undefined
        : Number(rawQty);
    return {
      name,
      quantity,
      price,
    };
  });
}

export class SendInvoiceDto {
  @ApiProperty({
    type: [InvoiceParcelItemDto],
    description:
      'Line items. You may send the same array as `parcelItems` or `items`. Per line: `name` (or `title`), `price` (or `amount`), optional `quantity`.',
  })
  @Transform(({ obj }) => normalizeInvoiceLineItems(obj.parcelItems, obj.items))
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
