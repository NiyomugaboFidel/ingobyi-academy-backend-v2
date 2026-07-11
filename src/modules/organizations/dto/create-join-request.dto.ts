import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateJoinRequestDto {
  @ApiProperty({ description: 'Organization to request joining' })
  @IsString()
  organizationId!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole)
  requestedRole?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Student user IDs to link when requesting PARENT role',
  })
  @ValidateIf((o) => o.requestedRole === UserRole.PARENT)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsOptional()
  childIds?: string[];
}
