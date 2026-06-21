import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { ReorderLessonDto } from './dto/reorder-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(moduleId: string, dto: CreateLessonDto) {
    return this.prisma.lesson.create({
      data: { moduleId, ...dto },
    });
  }

  async list(moduleId: string) {
    return this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    });
  }

  async getById(lessonId: string, user: AuthenticatedUser) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { include: { course: { include: { trainers: true } } } },
        assignment: true,
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const course = lesson.module.course;
    if (!lesson.isFree) {
      const enrolled = await this.prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId: user.userId, courseId: course.id },
        },
      });
      const isTrainer = course.trainers.some((t) => t.userId === user.userId);
      if (!enrolled && !isTrainer) {
        throw new ForbiddenException('Enrollment required');
      }
    }
    return lesson;
  }

  async update(lessonId: string, dto: UpdateLessonDto) {
    return this.prisma.lesson.update({ where: { id: lessonId }, data: dto });
  }

  async remove(lessonId: string) {
    return this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  async reorder(lessonId: string, dto: ReorderLessonDto) {
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: { order: dto.order },
    });
  }
}
