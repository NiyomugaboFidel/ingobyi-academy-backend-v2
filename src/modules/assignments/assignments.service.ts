import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../shared/email/email.service';
import { ProgressService } from '../progress/progress.service';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly progress: ProgressService,
  ) {}

  async create(dto: {
    lessonId: string;
    title: string;
    instructions: string;
    maxScore?: number;
    dueDate?: string;
  }) {
    return this.prisma.assignment.create({
      data: {
        lessonId: dto.lessonId,
        title: dto.title,
        instructions: dto.instructions,
        maxScore: dto.maxScore ?? 100,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async getByLesson(lessonId: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { lessonId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  async getMySubmission(assignmentId: string, userId: string) {
    return this.prisma.submission.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } },
    });
  }

  async update(
    id: string,
    dto: {
      title?: string;
      instructions?: string;
      maxScore?: number;
      dueDate?: string;
    },
  ) {
    const existing = await this.prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assignment not found');
    return this.prisma.assignment.update({
      where: { id },
      data: {
        title: dto.title,
        instructions: dto.instructions,
        maxScore: dto.maxScore,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate
              ? new Date(dto.dueDate)
              : null
            : undefined,
      },
    });
  }

  async submit(assignmentId: string, userId: string, dto: SubmitAssignmentDto) {
    return this.prisma.submission.upsert({
      where: { assignmentId_userId: { assignmentId, userId } },
      create: { assignmentId, userId, ...dto },
      update: { ...dto, submittedAt: new Date() },
    });
  }

  async listSubmissions(assignmentId: string) {
    return this.prisma.submission.findMany({
      where: { assignmentId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async grade(submissionId: string, graderId: string, dto: GradeSubmissionDto) {
    const submission = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback,
        gradedBy: graderId,
        gradedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true } },
        assignment: {
          select: {
            title: true,
            lessonId: true,
          },
        },
      },
    });

    await this.progress.markLessonCompleteForUser(
      submission.userId,
      submission.assignment.lessonId,
    );

    void this.email.sendAssignmentGraded(
      submission.user.email,
      submission.assignment.title,
      submission.score ?? dto.score,
      dto.feedback,
    );
    return submission;
  }
}
