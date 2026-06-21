import { IsIn, IsOptional, IsString } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PartnerCoursesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class PartnerEnrollmentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  learnerId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'COMPLETED', 'DROPPED', 'EXPIRED'])
  status?: EnrollmentStatus;
}
