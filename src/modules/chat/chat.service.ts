import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoom(courseId: string) {
    const room = await this.prisma.courseChatRoom.findUnique({
      where: { courseId },
      include: {
        messages: {
          where: { deletedAt: null },
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
    if (!room) throw new NotFoundException('Chat room not found');
    return { ...room, messages: room.messages.reverse() };
  }

  async history(courseId: string, cursor?: string) {
    const room = await this.prisma.courseChatRoom.findUnique({
      where: { courseId },
    });
    if (!room) throw new NotFoundException('Chat room not found');
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        roomId: room.id,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
    return messages.reverse();
  }

  async directThread(userId: string, otherUserId: string) {
    return this.prisma.directMessage.findMany({
      where: {
        deletedAt: null,
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async directInbox(userId: string) {
    const messages = await this.prisma.directMessage.findMany({
      where: {
        deletedAt: null,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['senderId', 'receiverId'],
      take: 50,
    });
    return messages;
  }

  async deleteMessage(messageId: string, userId: string, isAdmin: boolean) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId && !isAdmin) {
      throw new NotFoundException('Message not found');
    }
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }
}
