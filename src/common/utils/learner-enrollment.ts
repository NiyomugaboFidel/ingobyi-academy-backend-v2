import { Prisma } from '@prisma/client';

/** User filter: not assigned as a trainer on the given course. */
export function notCourseTrainerUserFilter(
  courseId: string,
): Prisma.UserWhereInput {
  return {
    trainedCourses: {
      none: { courseId },
    },
  };
}

/** Enrollment filter for a single course, excluding course trainers. */
export function learnerEnrollmentWhereForCourse(
  courseId: string,
  extra?: Omit<Prisma.EnrollmentWhereInput, 'courseId' | 'user'>,
): Prisma.EnrollmentWhereInput {
  return {
    courseId,
    ...extra,
    user: notCourseTrainerUserFilter(courseId),
  };
}

/** Exclude specific course/user trainer pairs from enrollment queries. */
export function excludeCourseTrainerPairs(
  base: Prisma.EnrollmentWhereInput,
  pairs: Array<{ courseId: string; userId: string }>,
): Prisma.EnrollmentWhereInput {
  if (!pairs.length) return base;
  return {
    AND: [
      base,
      {
        NOT: {
          OR: pairs.map((p) => ({ courseId: p.courseId, userId: p.userId })),
        },
      },
    ],
  };
}
