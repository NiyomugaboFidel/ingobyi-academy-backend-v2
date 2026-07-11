import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  A_LEVEL_CLASS_LEVELS,
  A_LEVEL_COMBINATIONS,
  AGE_BANDS,
  CLASS_LEVELS,
  GENDERS,
  INTERESTED_SKILLS,
} from '../../../common/constants/student-profile';

export class CompleteProfileDto {
  @ApiProperty({ enum: AGE_BANDS })
  @IsString()
  @IsIn([...AGE_BANDS])
  ageBand!: string;

  @ApiProperty({ enum: GENDERS })
  @IsString()
  @IsIn([...GENDERS])
  gender!: string;

  @ApiProperty({ enum: CLASS_LEVELS })
  @IsString()
  @IsIn([...CLASS_LEVELS])
  classLevel!: string;

  @ApiPropertyOptional({ enum: A_LEVEL_COMBINATIONS })
  @ValidateIf((o) =>
    (A_LEVEL_CLASS_LEVELS as readonly string[]).includes(o.classLevel),
  )
  @IsString()
  @IsIn([...A_LEVEL_COMBINATIONS])
  combination?: string;

  @ApiProperty({ description: 'School or college name' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  schoolName!: string;

  @ApiProperty({ description: 'Home address' })
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  homeAddress!: string;

  @ApiProperty({ type: [String], enum: INTERESTED_SKILLS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsIn([...INTERESTED_SKILLS], { each: true })
  interestedSkills!: string[];
}
