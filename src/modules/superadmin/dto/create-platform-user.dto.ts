import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePlatformUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole)
  platformRole?: UserRole;

  @ApiPropertyOptional({ description: 'Add user to this organization' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole)
  orgRole?: UserRole;

  /** Required when orgRole is PARENT — student user IDs in the target organization. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  childIds?: string[];
}
