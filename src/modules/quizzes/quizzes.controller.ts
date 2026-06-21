import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizzesService } from './quizzes.service';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get('lesson/:lessonId')
  @ApiOperation({ summary: 'Get quiz for lesson' })
  getForLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.quizzesService.getForLesson(lessonId, user.userId);
  }

  @Post('lesson/:lessonId/submit')
  @ApiOperation({ summary: 'Submit quiz attempt' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizzesService.submit(lessonId, user.userId, dto);
  }
}
