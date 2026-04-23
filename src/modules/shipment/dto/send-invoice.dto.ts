import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
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
  @Transform(({ obj }) => {
    const rows = normalizeInvoiceLineItems(obj.parcelItems, obj.items);
    // Must be class instances: forbidUnknownValues treats plain objects as "unknown".
    return rows.map((row) =>
      plainToInstance(InvoiceParcelItemDto, row, {
        enableImplicitConversion: true,
      }),
    );
  })
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

  @ApiProperty({
    required: false,
    description:
      'Receiver of goods (shown on invoice). Defaults to delivery address name if omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  receiverName?: string;

  @ApiProperty({
    required: false,
    description:
      'Receiver email on the invoice. Defaults to `receiverEmail` / delivery `addressTo.email` if omitted.',
  })
  @IsOptional()
  @IsEmail()
  receiverEmail?: string;
}
