import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKeyScope } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ApiKeyScope, isArray: true })
  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes!: ApiKeyScope[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgId?: string;
}
