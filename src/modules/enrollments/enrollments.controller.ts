import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { EnrollDto } from './dto/enroll.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Enrollments')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enroll')
  @ApiOperation({ summary: 'Enroll in course' })
  enroll(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnrollDto) {
    return this.enrollmentsService.enroll(user.userId, dto.courseId);
  }

  @Delete('enroll/:courseId')
  @ApiOperation({ summary: 'Unenroll from course' })
  unenroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.enrollmentsService.unenroll(user.userId, courseId);
  }

  @Get('my')
  @ApiOperation({ summary: 'My enrollments' })
  my(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.myEnrollments(user.userId);
  }

  @Get(':courseId/check')
  @ApiOperation({ summary: 'Check enrollment status' })
  check(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.enrollmentsService.check(user.userId, courseId);
  }
}
