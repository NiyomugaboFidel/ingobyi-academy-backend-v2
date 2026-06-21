import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CatalogService } from './catalog.service';
import { CreateCourseReviewDto } from './dto/create-review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class CatalogReviewsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('courses/:courseId')
  @ApiOperation({
    summary: 'Submit or update a course review after completion',
  })
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: CreateCourseReviewDto,
  ) {
    return this.catalogService.submitReview(user.userId, courseId, dto);
  }

  @Get('courses/:courseId/mine')
  @ApiOperation({ summary: 'My review for a course' })
  myReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.catalogService.getMyReview(user.userId, courseId);
  }
}
