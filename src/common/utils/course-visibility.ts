import { Prisma, ResourceVisibility, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../interfaces/request-with-user.interface';

export function courseVisibilityFilter(
  user?: AuthenticatedUser | null,
): Prisma.CourseWhereInput {
  if (!user || user.role === UserRole.SUPERADMIN) {
    return {};
  }

  if (user.orgId) {
    return {
      OR: [
        { visibility: ResourceVisibility.PUBLIC_GLOBAL, orgId: null },
        {
          visibility: ResourceVisibility.ORG_PRIVATE,
          orgId: user.orgId,
        },
      ],
    };
  }

  return {
    visibility: ResourceVisibility.PUBLIC_GLOBAL,
    orgId: null,
  };
}

export function userCanViewCourse(
  user: AuthenticatedUser | undefined | null,
  course: { orgId: string | null; visibility: ResourceVisibility },
): boolean {
  if (!user) {
    return (
      course.visibility === ResourceVisibility.PUBLIC_GLOBAL &&
      course.orgId === null
    );
  }
  if (user.role === UserRole.SUPERADMIN) return true;
  if (course.visibility === ResourceVisibility.PUBLIC_GLOBAL) return true;
  return !!user.orgId && user.orgId === course.orgId;
}
