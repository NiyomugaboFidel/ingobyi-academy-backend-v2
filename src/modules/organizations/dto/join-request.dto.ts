import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class JoinRequestDto {
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole)
  requestedRole?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
