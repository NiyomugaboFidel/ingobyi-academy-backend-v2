import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { NotificationType } from '@prisma/client';
import {
  buildPaginatedMeta,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AppGateway } from '../gateway/app.gateway';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private gateway!: AppGateway;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    // Dynamic require avoids circular dependency with AppGateway at module load time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppGateway: Gateway } = require('../gateway/app.gateway') as {
      AppGateway: new (...args: never[]) => AppGateway;
    };
    this.gateway = this.moduleRef.get(Gateway, { strict: false });
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    link?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, link },
    });
    this.gateway?.emitNotification(userId, notification);
    return notification;
  }

  async list(userId: string, pagination: PaginationDto, unreadOnly = false) {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
