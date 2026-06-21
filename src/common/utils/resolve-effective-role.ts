import { MembershipStatus, UserRole } from '@prisma/client';

type MembershipLike = {
  role: UserRole;
  orgId: string;
  status?: MembershipStatus;
  joinedAt?: Date;
};

export interface WorkspaceContext {
  platformRole: UserRole;
  orgId?: string;
  orgRole?: UserRole;
}

export function resolveWorkspace(
  platformRole: UserRole,
  memberships: MembershipLike[],
  preferredOrgId?: string,
): WorkspaceContext {
  if (platformRole === UserRole.SUPERADMIN) {
    return { platformRole: UserRole.SUPERADMIN };
  }

  const active = memberships.filter(
    (m) => m.status === undefined || m.status === MembershipStatus.ACTIVE,
  );

  if (preferredOrgId) {
    const match = active.find((m) => m.orgId === preferredOrgId);
    if (match) {
      return {
        platformRole,
        orgId: preferredOrgId,
        orgRole: match.role,
      };
    }
  }

  if (active.length === 0) {
    return { platformRole };
  }

  const mostRecent = [...active].sort(
    (a, b) => (b.joinedAt?.getTime() ?? 0) - (a.joinedAt?.getTime() ?? 0),
  )[0];

  return {
    platformRole,
    orgId: mostRecent.orgId,
    orgRole: mostRecent.role,
  };
}

/** Effective role for route guards: superadmin platform role, else active org role. */
export function resolveEffectiveRole(
  platformRole: UserRole,
  memberships: MembershipLike[],
  preferredOrgId?: string,
): { role: UserRole; orgId?: string; orgRole?: UserRole } {
  const ws = resolveWorkspace(platformRole, memberships, preferredOrgId);
  const role =
    ws.platformRole === UserRole.SUPERADMIN
      ? UserRole.SUPERADMIN
      : (ws.orgRole ?? ws.platformRole);
  return { role, orgId: ws.orgId, orgRole: ws.orgRole };
}

export function guardRole(user: {
  role: UserRole;
  orgRole?: UserRole;
}): UserRole {
  if (user.role === UserRole.SUPERADMIN) return UserRole.SUPERADMIN;
  return user.orgRole ?? user.role;
}
