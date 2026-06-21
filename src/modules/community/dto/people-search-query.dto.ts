import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PeopleSearchQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  q?: string;
}
