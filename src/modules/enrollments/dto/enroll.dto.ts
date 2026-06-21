import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class EnrollDto {
  @ApiProperty()
  @IsString()
  courseId!: string;
}
