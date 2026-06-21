import { ResourceVisibility, UserRole } from '@prisma/client';
import { courseVisibilityFilter, userCanViewCourse } from './course-visibility';

describe('courseVisibilityFilter', () => {
  it('returns no filter for superadmin', () => {
    expect(
      courseVisibilityFilter({
        sub: '1',
        userId: '1',
        role: UserRole.SUPERADMIN,
      }),
    ).toEqual({});
  });

  it('scopes to org private + public global for org member', () => {
    expect(
      courseVisibilityFilter({
        sub: '1',
        userId: '1',
        role: UserRole.STUDENT,
        orgId: 'org-a',
        orgRole: UserRole.STUDENT,
      }),
    ).toEqual({
      OR: [
        { visibility: ResourceVisibility.PUBLIC_GLOBAL, orgId: null },
        {
          visibility: ResourceVisibility.ORG_PRIVATE,
          orgId: 'org-a',
        },
      ],
    });
  });
});

describe('userCanViewCourse', () => {
  const orgCourse = {
    orgId: 'org-a',
    visibility: ResourceVisibility.ORG_PRIVATE,
  };

  it('denies cross-tenant access', () => {
    expect(
      userCanViewCourse(
        {
          sub: '1',
          userId: '1',
          role: UserRole.STUDENT,
          orgId: 'org-b',
          orgRole: UserRole.STUDENT,
        },
        orgCourse,
      ),
    ).toBe(false);
  });

  it('allows same-tenant access', () => {
    expect(
      userCanViewCourse(
        {
          sub: '1',
          userId: '1',
          role: UserRole.STUDENT,
          orgId: 'org-a',
          orgRole: UserRole.STUDENT,
        },
        orgCourse,
      ),
    ).toBe(true);
  });
});
