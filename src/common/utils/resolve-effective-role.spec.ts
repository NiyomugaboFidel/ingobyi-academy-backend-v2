import { MembershipStatus, UserRole } from '@prisma/client';
import {
  guardRole,
  resolveEffectiveRole,
  resolveWorkspace,
} from './resolve-effective-role';

describe('resolveWorkspace', () => {
  const memberships = [
    {
      orgId: 'org-a',
      role: UserRole.ADMIN,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date('2024-01-01'),
    },
    {
      orgId: 'org-b',
      role: UserRole.STUDENT,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date('2025-06-01'),
    },
  ];

  it('returns superadmin without org context', () => {
    expect(resolveWorkspace(UserRole.SUPERADMIN, memberships)).toEqual({
      platformRole: UserRole.SUPERADMIN,
    });
  });

  it('picks most recent active membership by default', () => {
    expect(resolveWorkspace(UserRole.STUDENT, memberships)).toEqual({
      platformRole: UserRole.STUDENT,
      orgId: 'org-b',
      orgRole: UserRole.STUDENT,
    });
  });

  it('respects preferred org id', () => {
    expect(resolveWorkspace(UserRole.STUDENT, memberships, 'org-a')).toEqual({
      platformRole: UserRole.STUDENT,
      orgId: 'org-a',
      orgRole: UserRole.ADMIN,
    });
  });
});

describe('guardRole', () => {
  it('uses orgRole for non-superadmin', () => {
    expect(
      guardRole({ role: UserRole.STUDENT, orgRole: UserRole.TRAINER }),
    ).toBe(UserRole.TRAINER);
  });

  it('keeps superadmin platform role', () => {
    expect(guardRole({ role: UserRole.SUPERADMIN })).toBe(UserRole.SUPERADMIN);
  });
});

describe('resolveEffectiveRole', () => {
  it('maps workspace org role to effective role', () => {
    const result = resolveEffectiveRole(UserRole.STUDENT, [
      {
        orgId: 'org-a',
        role: UserRole.TRAINER,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
    ]);
    expect(result.role).toBe(UserRole.TRAINER);
    expect(result.orgId).toBe('org-a');
  });
});
