import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCertificateSettingsDto {
  @ApiPropertyOptional({ example: 'Niyomugabo Fidele' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ceoName?: string;

  @ApiPropertyOptional({ example: 'Coregroup Ltd CEO' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ceoTitle?: string;

  @ApiPropertyOptional({ example: 'Cyubahiro Richard' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  programLeaderName?: string;

  @ApiPropertyOptional({ example: 'Ingobyi Innovation Hub Leader' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  programLeaderTitle?: string;
}
