import { MembershipStatus, UserRole } from '@prisma/client';

const ROLE_PRIORITY: Record<UserRole, number> = {
  SUPERADMIN: 5,
  ADMIN: 4,
  TRAINER: 3,
  PARENT: 2,
  STUDENT: 1,
};

export type PublicUserMeta = {
  platformRole: UserRole;
  displayRole: UserRole;
  isVerified: boolean;
};

export function resolveDisplayRole(input: {
  platformRole: UserRole;
  membershipRoles?: UserRole[];
  isTrainer?: boolean;
}): UserRole {
  if (input.platformRole === UserRole.SUPERADMIN) {
    return UserRole.SUPERADMIN;
  }

  const roles = new Set<UserRole>([input.platformRole]);
  for (const role of input.membershipRoles ?? []) {
    roles.add(role);
  }
  if (input.isTrainer) {
    roles.add(UserRole.TRAINER);
  }

  return [...roles].sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])[0];
}

export function buildPublicUserMeta(input: {
  platformRole: UserRole;
  isVerified: boolean;
  memberships?: Array<{ role: UserRole; status?: MembershipStatus }>;
  isTrainer?: boolean;
}): PublicUserMeta {
  const membershipRoles = (input.memberships ?? [])
    .filter(
      (m) => m.status === undefined || m.status === MembershipStatus.ACTIVE,
    )
    .map((m) => m.role);

  return {
    platformRole: input.platformRole,
    isVerified: input.isVerified,
    displayRole: resolveDisplayRole({
      platformRole: input.platformRole,
      membershipRoles,
      isTrainer: input.isTrainer,
    }),
  };
}

export const publicUserFieldsSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  platformRole: true,
  isVerified: true,
  memberships: {
    where: { status: MembershipStatus.ACTIVE },
    select: { role: true, status: true },
  },
  trainedCourses: { select: { id: true }, take: 1 },
} as const;
