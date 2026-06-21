import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequireOrgGuard } from '../../common/guards/require-org.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CoursesListQueryDto } from './dto/courses-list-query.dto';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @UseGuards(RequireOrgGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.TRAINER, UserRole.SUPERADMIN)
  @RequirePermission('courses.create')
  @ApiOperation({ summary: 'Create course' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List courses' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CoursesListQueryDto,
  ) {
    return this.coursesService.list(user, query, query.status);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List courses pending publication review' })
  listPending(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.listPending(user);
  }

  @Get('preview/:slug')
  @Roles(UserRole.ADMIN, UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Preview unpublished course by slug' })
  previewBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.getPreviewBySlug(slug, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course by ID' })
  getById(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.getById(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update course' })
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Archive course' })
  remove(@Param('id', ParseCuidPipe) id: string) {
    return this.coursesService.softDelete(id);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Request publish' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.coursesService.requestPublish(id, user);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Approve course for publication' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.coursesService.approve(id, user);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Reject course publication request' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.coursesService.reject(id, user);
  }

  @Get(':id/students')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'List enrolled students' })
  students(
    @Param('id', ParseCuidPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.coursesService.listStudents(id, pagination);
  }

  @Post(':id/trainers')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Add co-trainer' })
  addTrainer(
    @Param('id', ParseCuidPipe) id: string,
    @Body('userId', ParseCuidPipe) userId: string,
  ) {
    return this.coursesService.addTrainer(id, userId);
  }

  @Delete(':id/trainers/:userId')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Remove co-trainer' })
  removeTrainer(
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) userId: string,
  ) {
    return this.coursesService.removeTrainer(id, userId);
  }

  @Post(':courseId/modules')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Create course module' })
  createModule(
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.coursesService.createModule(courseId, dto);
  }

  @Patch(':courseId/modules/:moduleId')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Update course module' })
  updateModule(
    @Param('moduleId', ParseCuidPipe) moduleId: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.coursesService.updateModule(moduleId, dto);
  }

  @Delete(':courseId/modules/:moduleId')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Delete course module' })
  deleteModule(@Param('moduleId', ParseCuidPipe) moduleId: string) {
    return this.coursesService.deleteModule(moduleId);
  }
}
