import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AssignmentsService } from './assignments.service';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@ApiTags('Assignments')
@Controller()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post('assignments')
  @Roles(UserRole.TRAINER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create assignment for lesson' })
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @Get('assignments/:lessonId')
  @ApiOperation({ summary: 'Get assignment by lesson' })
  getByLesson(@Param('lessonId', ParseCuidPipe) lessonId: string) {
    return this.assignmentsService.getByLesson(lessonId);
  }

  @Patch('assignments/:id')
  @Roles(UserRole.TRAINER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update assignment' })
  update(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.update(id, dto);
  }

  @Post('submissions/:assignmentId')
  @ApiOperation({ summary: 'Submit assignment' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId', ParseCuidPipe) assignmentId: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.assignmentsService.submit(assignmentId, user.userId, dto);
  }

  @Get('submissions/:assignmentId/mine')
  @ApiOperation({ summary: 'My submission for assignment' })
  mySubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId', ParseCuidPipe) assignmentId: string,
  ) {
    return this.assignmentsService.getMySubmission(assignmentId, user.userId);
  }

  @Get('submissions/:assignmentId')
  @Roles(UserRole.TRAINER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List submissions' })
  listSubmissions(@Param('assignmentId', ParseCuidPipe) assignmentId: string) {
    return this.assignmentsService.listSubmissions(assignmentId);
  }

  @Patch('submissions/:id/grade')
  @Roles(UserRole.TRAINER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Grade submission' })
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assignmentsService.grade(id, user.userId, dto);
  }
}
