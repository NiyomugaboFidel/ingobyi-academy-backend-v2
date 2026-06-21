import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CatalogService } from './catalog.service';

class CatalogSearchQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categories?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  levels?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  org?: string;

  @IsOptional()
  @IsIn(['all', 'free', 'paid'])
  price?: string;

  @IsOptional()
  @IsIn(['relevance', 'popular', 'newest', 'title'])
  sort?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  ratingMin?: number;
}

@ApiTags('Catalog')
@Controller('catalog')
@Public()
@SkipThrottle()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Search published courses' })
  search(@Query() query: CatalogSearchQueryDto) {
    const {
      q,
      category,
      categories,
      level,
      levels,
      type,
      org,
      price,
      sort,
      language,
      duration,
      ratingMin,
    } = query;
    return this.catalogService.search(query, {
      q,
      category,
      categories,
      level,
      levels,
      type,
      org,
      price,
      sort,
      language,
      duration,
      ratingMin,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  categories() {
    return this.catalogService.listCategories();
  }

  @Get('featured')
  @ApiOperation({ summary: 'Featured courses' })
  featured() {
    return this.catalogService.featured();
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Search suggestions from catalog data' })
  suggestions(@Query('q') q?: string) {
    return this.catalogService.suggestions(q);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Public course detail' })
  getBySlug(@Param('slug') slug: string) {
    return this.catalogService.getBySlug(slug);
  }
}
