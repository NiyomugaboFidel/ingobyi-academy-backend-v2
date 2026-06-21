import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export class ReviewJoinRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Override requested role on approval',
  })
  @IsOptional()
  @IsEnum(UserRole)
  approvedRole?: UserRole;
}
