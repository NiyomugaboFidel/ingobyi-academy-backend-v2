import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { orgRoleCan } from '../utils/org-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === UserRole.SUPERADMIN) {
      return true;
    }

    const orgId = request.params?.orgId ?? request.params?.id ?? user.orgId;

    if (!orgId) {
      throw new ForbiddenException('Organization context required');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: user.userId, orgId },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Not a member of this organization');
    }

    const allowed = await orgRoleCan(
      this.prisma,
      orgId,
      membership.role,
      permission,
    );

    if (!allowed) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }

    return true;
  }
}
