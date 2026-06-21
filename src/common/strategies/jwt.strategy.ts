import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/request-with-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, refreshTokenVersion: true },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException('User inactive');
    }
    if (payload.rv !== undefined && payload.rv !== user.refreshTokenVersion) {
      throw new UnauthorizedException('Token revoked');
    }
    return {
      sub: payload.sub,
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      orgRole: payload.orgRole,
      rv: payload.rv,
    };
  }
}
