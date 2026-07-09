import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional } from 'class-validator';
import { CreateOrganizationDto } from '../../organizations/dto/create-organization.dto';

export class CreatePlatformOrganizationDto extends CreateOrganizationDto {
  /** Assign an existing platform user as org owner/admin (must already have an account). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  /** Listed in the public directory when true (default true for platform-created orgs). */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
