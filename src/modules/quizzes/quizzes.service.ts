import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, LessonType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

type QuizQuestion = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
};

type QuizContent = {
  questions: QuizQuestion[];
  passingScore?: number;
};

import { ProgressService } from '../progress/progress.service';

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  private parseQuiz(content: string | null): QuizContent {
    if (!content) throw new BadRequestException('Quiz has no questions');
    try {
      const parsed = JSON.parse(content) as QuizContent;
      if (!parsed.questions?.length) throw new Error('empty');
      return parsed;
    } catch {
      throw new BadRequestException('Invalid quiz content');
    }
  }

  async getForLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!lesson || lesson.type !== LessonType.QUIZ) {
      throw new NotFoundException('Quiz not found');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: lesson.module.courseId },
      },
    });
    if (
      !enrollment ||
      (enrollment.status !== EnrollmentStatus.ACTIVE &&
        enrollment.status !== EnrollmentStatus.COMPLETED)
    ) {
      throw new BadRequestException('Not enrolled');
    }

    const quiz = this.parseQuiz(lesson.content);
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, lessonId },
      orderBy: { attemptedAt: 'desc' },
      take: 5,
    });

    return {
      lessonId,
      title: lesson.title,
      passingScore: quiz.passingScore ?? 70,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
      })),
      attempts: attempts.map((a) => ({
        id: a.id,
        score: a.score,
        isPassed: a.isPassed,
        attemptedAt: a.attemptedAt,
      })),
    };
  }

  async submit(lessonId: string, userId: string, dto: SubmitQuizDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!lesson || lesson.type !== LessonType.QUIZ) {
      throw new NotFoundException('Quiz not found');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: lesson.module.courseId },
      },
    });
    if (
      !enrollment ||
      (enrollment.status !== EnrollmentStatus.ACTIVE &&
        enrollment.status !== EnrollmentStatus.COMPLETED)
    ) {
      throw new BadRequestException('Not enrolled');
    }

    const quiz = this.parseQuiz(lesson.content);
    if (dto.answers.length !== quiz.questions.length) {
      throw new BadRequestException('Answer every question');
    }

    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (dto.answers[i] === q.correctIndex) correct += 1;
    });
    const score = Math.round((correct / quiz.questions.length) * 100);
    const passingScore = quiz.passingScore ?? 70;
    const isPassed = score >= passingScore;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        lessonId,
        answers: dto.answers,
        score,
        isPassed,
      },
    });

    if (isPassed) {
      await this.prisma.lessonProgress.upsert({
        where: {
          enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
        },
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          isCompleted: true,
          completedAt: new Date(),
        },
        update: { isCompleted: true, completedAt: new Date() },
      });
      if (enrollment.status === EnrollmentStatus.ACTIVE) {
        await this.progress.checkAndCompleteEnrollment(
          userId,
          lesson.module.courseId,
        );
      }
    }

    return {
      ...attempt,
      correctCount: correct,
      totalQuestions: quiz.questions.length,
      passingScore,
    };
  }
}
