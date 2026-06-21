import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class SubmitAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textContent?: string;
}
