import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../constants/permissions';

export async function orgRoleCan(
  prisma: PrismaService,
  orgId: string,
  orgRole: UserRole,
  permissionKey: string,
): Promise<boolean> {
  const override = await prisma.orgPermission.findUnique({
    where: {
      orgId_role_permission: {
        orgId,
        role: orgRole,
        permission: permissionKey,
      },
    },
  });
  if (override !== null) {
    return override.granted;
  }

  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    include: {
      rolePermissions: { where: { role: orgRole } },
    },
  });
  if (!permission?.rolePermissions[0]) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[orgRole];
    return defaults?.[permissionKey as keyof typeof defaults] ?? false;
  }
  return permission.rolePermissions[0].granted;
}
