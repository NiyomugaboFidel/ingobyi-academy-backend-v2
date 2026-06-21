import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ['BUG', 'CONTENT', 'USER', 'OTHER'] })
  @IsIn(['BUG', 'CONTENT', 'USER', 'OTHER'])
  type!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
