import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { ReorderLessonDto } from './dto/reorder-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@ApiTags('Lessons')
@Controller('courses/:courseId/modules/:moduleId/lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Create lesson' })
  create(
    @Param('moduleId', ParseCuidPipe) moduleId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(moduleId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List lessons' })
  list(@Param('moduleId', ParseCuidPipe) moduleId: string) {
    return this.lessonsService.list(moduleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lesson content' })
  getById(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.getById(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Update lesson' })
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateLessonDto) {
    return this.lessonsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Delete lesson' })
  remove(@Param('id', ParseCuidPipe) id: string) {
    return this.lessonsService.remove(id);
  }

  @Patch(':id/order')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Reorder lesson' })
  reorder(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: ReorderLessonDto,
  ) {
    return this.lessonsService.reorder(id, dto);
  }
}
