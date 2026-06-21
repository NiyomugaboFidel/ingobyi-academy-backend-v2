import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['VERIFY_EMAIL', 'RESET_PASSWORD'] })
  @IsString()
  @IsIn(['VERIFY_EMAIL', 'RESET_PASSWORD'])
  purpose!: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
}
