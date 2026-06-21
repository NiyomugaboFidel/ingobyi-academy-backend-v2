import { UserRole } from '@prisma/client';

export const PERMISSION_KEYS = [
  'org.settings',
  'org.members',
  'org.invite',
  'courses.create',
  'courses.edit_any',
  'courses.publish',
  'courses.view_roster',
  'enroll.self',
  'progress.own',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Default org-role → permission matrix (seeded into RolePermission on startup). */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  UserRole,
  Partial<Record<PermissionKey, boolean>>
> = {
  [UserRole.SUPERADMIN]: Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, true]),
  ) as Record<PermissionKey, boolean>,
  [UserRole.ADMIN]: {
    'org.settings': true,
    'org.members': true,
    'org.invite': true,
    'courses.create': true,
    'courses.edit_any': true,
    'courses.publish': true,
    'courses.view_roster': true,
    'enroll.self': true,
    'progress.own': true,
  },
  [UserRole.TRAINER]: {
    'courses.create': true,
    'courses.edit_any': true,
    'courses.publish': true,
    'courses.view_roster': true,
    'enroll.self': true,
    'progress.own': true,
  },
  [UserRole.STUDENT]: {
    'enroll.self': true,
    'progress.own': true,
  },
  [UserRole.PARENT]: {
    'progress.own': true,
  },
};
