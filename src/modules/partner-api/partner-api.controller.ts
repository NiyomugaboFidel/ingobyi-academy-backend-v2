import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyScope } from '@prisma/client';
import { ApiKeyScopes } from '../../common/decorators/api-key-scopes.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import {
  PartnerCoursesQueryDto,
  PartnerEnrollmentsQueryDto,
} from './dto/partner-query.dto';
import { PartnerApiService } from './partner-api.service';

@ApiTags('Partner API')
@Controller('partner')
@Public()
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class PartnerApiController {
  constructor(private readonly partnerApi: PartnerApiService) {}

  @Get()
  @ApiOperation({ summary: 'Partner API index — endpoints and scopes' })
  index() {
    return this.partnerApi.getIndex();
  }

  @Get('organization')
  @ApiKeyScopes(ApiKeyScope.COURSE_READ)
  @ApiOperation({ summary: 'Organization tied to this API key' })
  organization(@Req() req: RequestWithUser) {
    return this.partnerApi.getOrganization(req.apiKey!);
  }

  @Get('courses')
  @ApiKeyScopes(ApiKeyScope.COURSE_READ)
  @ApiOperation({ summary: 'List published courses (paginated)' })
  listCourses(
    @Req() req: RequestWithUser,
    @Query() query: PartnerCoursesQueryDto,
  ) {
    return this.partnerApi.listCourses(req.apiKey!, query);
  }

  @Get('courses/by-slug/:slug')
  @ApiKeyScopes(ApiKeyScope.COURSE_READ)
  @ApiOperation({ summary: 'Course detail by slug' })
  courseBySlug(@Req() req: RequestWithUser, @Param('slug') slug: string) {
    return this.partnerApi.getCourseBySlug(req.apiKey!, slug);
  }

  @Get('courses/:id')
  @ApiKeyScopes(ApiKeyScope.COURSE_READ)
  @ApiOperation({ summary: 'Course detail with curriculum metadata' })
  getCourse(
    @Req() req: RequestWithUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.partnerApi.getCourseById(req.apiKey!, id);
  }

  @Get('categories')
  @ApiKeyScopes(ApiKeyScope.COURSE_READ)
  @ApiOperation({ summary: 'Course categories' })
  categories() {
    return this.partnerApi.listCategories();
  }

  @Get('enrollments')
  @ApiKeyScopes(ApiKeyScope.ENROLLMENT_READ)
  @ApiOperation({
    summary: 'List enrollments (filter by learner/course/status)',
  })
  listEnrollments(
    @Req() req: RequestWithUser,
    @Query() query: PartnerEnrollmentsQueryDto,
  ) {
    return this.partnerApi.listEnrollments(req.apiKey!, query);
  }

  @Get('enrollments/check')
  @ApiKeyScopes(ApiKeyScope.ENROLLMENT_READ)
  @ApiOperation({ summary: 'Check if learner is enrolled in a course' })
  checkEnrollment(
    @Query('learnerId', ParseCuidPipe) learnerId: string,
    @Query('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.partnerApi.checkEnrollment(learnerId, courseId);
  }

  @Post('enrollments')
  @ApiKeyScopes(ApiKeyScope.ENROLLMENT_WRITE)
  @ApiOperation({ summary: 'Enroll a learner in a published course' })
  enroll(
    @Req() req: RequestWithUser,
    @Body('userId', ParseCuidPipe) userId: string,
    @Body('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.partnerApi.enrollLearner(req.apiKey!, userId, courseId);
  }

  @Get('learners/:id/learning')
  @ApiKeyScopes(ApiKeyScope.LEARNER_READ)
  @ApiOperation({
    summary:
      'Full learning record — enrollments, progress, certs, achievements',
  })
  learnerLearning(
    @Req() req: RequestWithUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.partnerApi.getLearnerLearningRecord(req.apiKey!, id);
  }

  @Get('learners/:id/enrollments')
  @ApiKeyScopes(ApiKeyScope.LEARNER_READ)
  @ApiOperation({ summary: 'Learner enrollments with progress summary' })
  learnerEnrollments(
    @Req() req: RequestWithUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.partnerApi.getLearnerEnrollments(req.apiKey!, id);
  }

  @Get('learners/:id/progress/:courseId')
  @ApiKeyScopes(ApiKeyScope.LEARNER_READ)
  @ApiOperation({ summary: 'Detailed lesson progress for one course' })
  learnerProgress(
    @Req() req: RequestWithUser,
    @Param('id', ParseCuidPipe) id: string,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.partnerApi.getLearnerCourseProgress(req.apiKey!, id, courseId);
  }

  @Get('learners/:id/certificates')
  @ApiKeyScopes(ApiKeyScope.LEARNER_READ)
  @ApiOperation({ summary: 'Certificates earned by learner' })
  learnerCertificates(
    @Req() req: RequestWithUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.partnerApi.getLearnerCertificates(req.apiKey!, id);
  }

  @Get('learners/:id/achievements')
  @ApiKeyScopes(ApiKeyScope.LEARNER_READ)
  @ApiOperation({
    summary: 'Unified achievements (certificates, courses, badges)',
  })
  learnerAchievements(
    @Req() req: RequestWithUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.partnerApi.getLearnerAchievements(req.apiKey!, id);
  }

  @Get('certificates/verify/:code')
  @ApiKeyScopes(ApiKeyScope.CERTIFICATE_VERIFY)
  @ApiOperation({ summary: 'Verify a certificate by code' })
  verifyCert(@Param('code') code: string) {
    return this.partnerApi.verifyCertificate(code);
  }
}
