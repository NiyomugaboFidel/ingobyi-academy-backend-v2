import { Injectable, OnModuleInit } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
} from '../../common/constants/permissions';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedDefaultPermissions();
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      if (code === 'P2021') {
        throw new Error(
          'Database schema is missing. Run migrations first: npm run prisma:migrate:deploy (or deploy with start:railway on Railway).',
        );
      }
      throw err;
    }
  }

  async seedDefaultPermissions(): Promise<void> {
    await this.prisma.permission.createMany({
      data: PERMISSION_KEYS.map((key) => ({ key })),
      skipDuplicates: true,
    });

    const permissions = await this.prisma.permission.findMany();
    const byKey = new Map(permissions.map((p) => [p.key, p.id]));

    for (const [role, matrix] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (role === UserRole.SUPERADMIN) continue;
      for (const [key, granted] of Object.entries(matrix)) {
        const permissionId = byKey.get(key);
        if (!permissionId) continue;
        await this.prisma.rolePermission.upsert({
          where: {
            role_permissionId: {
              role: role as UserRole,
              permissionId,
            },
          },
          create: {
            role: role as UserRole,
            permissionId,
            granted: granted ?? false,
          },
          update: { granted: granted ?? false },
        });
      }
    }
  }

  async seedOrgPermissions(orgId: string): Promise<void> {
    const permissions = await this.prisma.permission.findMany({
      include: { rolePermissions: true },
    });

    for (const permission of permissions) {
      for (const rp of permission.rolePermissions) {
        await this.prisma.orgPermission.upsert({
          where: {
            orgId_role_permission: {
              orgId,
              role: rp.role,
              permission: permission.key,
            },
          },
          create: {
            orgId,
            role: rp.role,
            permission: permission.key,
            granted: rp.granted,
          },
          update: {},
        });
      }
    }
  }
}
