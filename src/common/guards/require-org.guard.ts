import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class RequireOrgGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new BadRequestException('Authentication required');
    }
    if (user.role === UserRole.SUPERADMIN) {
      return true;
    }
    if (!user.orgId) {
      throw new BadRequestException('Choose a workspace first');
    }
    return true;
  }
}
