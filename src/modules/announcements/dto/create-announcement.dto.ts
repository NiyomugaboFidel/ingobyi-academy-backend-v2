import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AnnouncementScope,
  AnnouncementTargetType,
  UserRole,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class AnnouncementTargetDto {
  @ApiProperty({ enum: AnnouncementTargetType })
  @IsEnum(AnnouncementTargetType)
  targetType!: AnnouncementTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetValue?: string;
}

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ enum: AnnouncementScope })
  @IsOptional()
  @IsEnum(AnnouncementScope)
  scope?: AnnouncementScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  targetRole?: UserRole;

  @ApiPropertyOptional({ type: [AnnouncementTargetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementTargetDto)
  targets?: AnnouncementTargetDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
