import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class OrderStatusChangedDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsOptional()
  fromStatus: string | null;

  @IsString()
  @IsNotEmpty()
  toStatus: string;

  @IsDateString()
  timestamp: Date;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
