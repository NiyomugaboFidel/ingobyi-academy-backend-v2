import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ description: 'Email of an existing platform user' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: UserRole, default: UserRole.STUDENT })
  @IsEnum(UserRole)
  role: UserRole = UserRole.STUDENT;
}
