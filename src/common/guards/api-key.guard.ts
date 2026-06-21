import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { API_KEY_SCOPES_KEY } from '../decorators/api-key-scopes.decorator';
import { ApiKeyScope } from '@prisma/client';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('API key required');
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
      API_KEY_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredScopes?.length) {
      const hasScope = requiredScopes.every((scope) =>
        apiKey.scopes.includes(scope),
      );
      if (!hasScope) {
        throw new UnauthorizedException('Insufficient API key scopes');
      }
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    request.apiKey = {
      apiKeyId: apiKey.id,
      userId: apiKey.userId,
      orgId: apiKey.orgId ?? undefined,
      scopes: apiKey.scopes,
    };

    return true;
  }
}
