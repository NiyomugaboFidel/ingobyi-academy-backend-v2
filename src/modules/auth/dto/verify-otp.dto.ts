import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ enum: ['VERIFY_EMAIL', 'RESET_PASSWORD'] })
  @IsOptional()
  @IsString()
  @IsIn(['VERIFY_EMAIL', 'RESET_PASSWORD'])
  purpose?: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
}
