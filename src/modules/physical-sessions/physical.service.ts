import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';

@Injectable()
export class PhysicalService {
  constructor(private readonly prisma: PrismaService) {}

  listVenues(orgId?: string) {
    return this.prisma.physicalVenue.findMany({
      where: orgId ? { orgId } : {},
      orderBy: { name: 'asc' },
    });
  }

  createVenue(dto: CreateVenueDto) {
    return this.prisma.physicalVenue.create({ data: dto });
  }

  updateVenue(id: string, dto: Partial<CreateVenueDto>) {
    return this.prisma.physicalVenue.update({ where: { id }, data: dto });
  }

  listSessions(courseId?: string, trainerId?: string) {
    return this.prisma.physicalSession.findMany({
      where: {
        ...(courseId ? { courseId } : {}),
        ...(trainerId ? { trainerId } : {}),
      },
      include: { venue: true, course: { select: { title: true } } },
      orderBy: { startTime: 'asc' },
    });
  }

  createSession(dto: CreateSessionDto) {
    return this.prisma.physicalSession.create({
      data: dto,
      include: { venue: true },
    });
  }

  updateSession(id: string, dto: Partial<CreateSessionDto>) {
    return this.prisma.physicalSession.update({ where: { id }, data: dto });
  }

  cancelSession(id: string) {
    return this.prisma.physicalSession.delete({ where: { id } });
  }

  async recordAttendance(sessionId: string, dto: RecordAttendanceDto) {
    const results = [];
    for (const entry of dto.entries) {
      const record = await this.prisma.physicalAttendance.upsert({
        where: {
          sessionId_userId: { sessionId, userId: entry.userId },
        },
        create: { sessionId, userId: entry.userId, status: entry.status },
        update: { status: entry.status, markedAt: new Date() },
      });
      results.push(record);
    }
    return results;
  }

  getAttendance(sessionId: string) {
    return this.prisma.physicalAttendance.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}
