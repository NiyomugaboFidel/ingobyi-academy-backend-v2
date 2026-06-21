import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  lessonId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(5)
  instructions!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
