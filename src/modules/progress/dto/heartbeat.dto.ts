import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class HeartbeatDto {
  @ApiProperty()
  @IsString()
  lessonId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  watchedSec!: number;
}
