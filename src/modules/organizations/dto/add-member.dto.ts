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

export class AddMemberDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: UserRole, default: UserRole.STUDENT })
  @IsEnum(UserRole)
  role: UserRole = UserRole.STUDENT;

  /** Required when creating a new account (no existing user with this email). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ minLength: 8, description: 'Initial password for new accounts' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  /** Required when role is PARENT — student user IDs in this organization. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  childIds?: string[];
}
