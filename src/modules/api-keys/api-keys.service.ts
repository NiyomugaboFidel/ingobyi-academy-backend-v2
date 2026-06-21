import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        orgId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateApiKeyDto) {
    const rawKey = `ia_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 8);
    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash,
        keyPrefix,
        userId,
        orgId: dto.orgId,
        scopes: dto.scopes,
      },
    });
    await this.audit.log({
      userId,
      orgId: dto.orgId,
      action: AuditAction.CREATE,
      entity: 'ApiKey',
      entityId: apiKey.id,
    });
    return { ...apiKey, rawKey };
  }

  update(id: string, userId: string, data: Partial<CreateApiKeyDto>) {
    return this.prisma.apiKey.update({
      where: { id, userId },
      data: { name: data.name, scopes: data.scopes },
    });
  }

  async revoke(id: string, userId: string) {
    const key = await this.prisma.apiKey.update({
      where: { id, userId },
      data: { isActive: false },
    });
    await this.audit.log({
      userId,
      action: AuditAction.REVOKE,
      entity: 'ApiKey',
      entityId: id,
    });
    return key;
  }
}
