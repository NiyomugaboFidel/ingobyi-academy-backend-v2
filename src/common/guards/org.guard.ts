import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    return true;
  }
}
