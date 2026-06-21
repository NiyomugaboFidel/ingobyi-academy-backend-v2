import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('heartbeat')
  @ApiOperation({ summary: 'Update video progress' })
  heartbeat(@CurrentUser() user: AuthenticatedUser, @Body() dto: HeartbeatDto) {
    return this.progressService.heartbeat(
      user.userId,
      dto.lessonId,
      dto.watchedSec,
    );
  }

  @Post('complete/:lessonId')
  @ApiOperation({ summary: 'Mark lesson complete' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.progressService.complete(user.userId, lessonId);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Full course progress' })
  courseProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.progressService.courseProgress(user.userId, courseId);
  }
}
