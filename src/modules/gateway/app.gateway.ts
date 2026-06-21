import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PresenceStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../../common/interfaces/request-with-user.interface';
import { MessagesService } from '../messaging/messages.service';
import { PresenceService } from '../messaging/presence.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);
  private readonly sockets = new Map<string, string>();

  constructor(
    private readonly jwt: JwtService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messages: MessagesService,
    @Inject(forwardRef(() => PresenceService))
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwt.verify<JwtPayload>(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      this.sockets.set(payload.sub, client.id);
      await this.presence.setOnline(payload.sub);
      this.server.emit('presence:update', {
        userId: payload.sub,
        status: PresenceStatus.ONLINE,
      });
      void this.broadcastPresenceStats();
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (userId && this.sockets.get(userId) === client.id) {
      this.sockets.delete(userId);
      await this.presence.setOffline(userId);
      this.server.emit('presence:update', {
        userId,
        status: PresenceStatus.OFFLINE,
      });
      void this.broadcastPresenceStats();
    }
  }

  @SubscribeMessage('messaging:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): void {
    client.join(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('messaging:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): void {
    client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('messaging:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      plainText?: string;
      replyToId?: string;
      threadRootId?: string;
      isAnnouncement?: boolean;
      mentionIds?: string[];
      attachments?: Array<{
        url: string;
        mimeType: string;
        filename: string;
        size?: number;
      }>;
    },
  ): Promise<void> {
    const userId = client.data.userId as string;
    const role = client.data.role;
    const message = await this.messages.sendMessage(
      data.conversationId,
      { sub: userId, userId, role },
      data,
    );
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('messaging:message', message);
  }

  @SubscribeMessage('messaging:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ): Promise<void> {
    const userId = client.data.userId as string;
    if (data.isTyping) {
      await this.presence.setTyping(data.conversationId, userId);
    } else {
      await this.presence.clearTyping(data.conversationId, userId);
    }
    client.to(`conversation:${data.conversationId}`).emit('messaging:typing', {
      conversationId: data.conversationId,
      userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('messaging:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId?: string },
  ): Promise<void> {
    const userId = client.data.userId as string;
    const role = client.data.role;
    const result = await this.messages.markRead(
      data.conversationId,
      { sub: userId, userId, role },
      data.messageId,
    );
    client.to(`conversation:${data.conversationId}`).emit('messaging:read', {
      conversationId: data.conversationId,
      userId,
      count: result.read,
    });
  }

  @SubscribeMessage('presence:ping')
  async handlePresencePing(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = client.data.userId as string;
    await this.presence.ping(userId);
  }

  @SubscribeMessage('presence:away')
  async handleAway(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = client.data.userId as string;
    await this.presence.setAway(userId);
    this.server.emit('presence:update', {
      userId,
      status: PresenceStatus.AWAY,
    });
  }

  @SubscribeMessage('course:join')
  handleCourseJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { courseId: string },
  ): void {
    client.join(`course:${data.courseId}`);
  }

  @SubscribeMessage('course:leave')
  handleCourseLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { courseId: string },
  ): void {
    client.leave(`course:${data.courseId}`);
  }

  emitNotification(userId: string, payload: unknown): void {
    const socketId = this.sockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('notification:new', payload);
    }
  }

  emitAnnouncement(userIds: string[], payload: unknown): void {
    for (const userId of userIds) {
      this.emitNotification(userId, payload);
    }
    this.server.emit('announcement:new', payload);
  }

  emitToConversation(
    conversationId: string,
    event: string,
    payload: unknown,
  ): void {
    this.server.to(`conversation:${conversationId}`).emit(event, payload);
  }

  private async broadcastPresenceStats(): Promise<void> {
    const stats = await this.presence.getStats();
    this.server.emit('presence:stats', stats);
  }
}
