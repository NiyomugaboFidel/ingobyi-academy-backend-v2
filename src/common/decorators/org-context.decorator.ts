import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

export const OrgContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const paramOrgId = request.params?.orgId ?? request.params?.id;
    return request.user?.orgId ?? paramOrgId;
  },
);
