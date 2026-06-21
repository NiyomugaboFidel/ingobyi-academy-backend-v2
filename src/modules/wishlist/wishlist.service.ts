import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            shortDescription: true,
            price: true,
            level: true,
            status: true,
          },
        },
      },
    });
  }

  async add(userId: string, courseId: string) {
    return this.prisma.wishlistItem.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            price: true,
          },
        },
      },
    });
  }

  remove(userId: string, courseId: string) {
    return this.prisma.wishlistItem.delete({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  async isSaved(userId: string, courseId: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return { saved: !!item };
  }
}
