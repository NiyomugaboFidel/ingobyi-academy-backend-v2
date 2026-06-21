import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { PhysicalService } from './physical.service';

@ApiTags('Physical Sessions')
@Controller('physical')
export class PhysicalController {
  constructor(private readonly physicalService: PhysicalService) {}

  @Get('venues')
  @ApiOperation({ summary: 'List org venues' })
  listVenues(@Query('orgId') orgId?: string) {
    return this.physicalService.listVenues(orgId);
  }

  @Post('venues')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Create venue' })
  createVenue(@Body() dto: CreateVenueDto) {
    return this.physicalService.createVenue(dto);
  }

  @Patch('venues/:id')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Update venue' })
  updateVenue(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: Partial<CreateVenueDto>,
  ) {
    return this.physicalService.updateVenue(id, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List sessions' })
  listSessions(
    @Query('courseId') courseId?: string,
    @Query('trainerId') trainerId?: string,
  ) {
    return this.physicalService.listSessions(courseId, trainerId);
  }

  @Post('sessions')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Create session' })
  createSession(@Body() dto: CreateSessionDto) {
    return this.physicalService.createSession(dto);
  }

  @Patch('sessions/:id')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Update session' })
  updateSession(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: Partial<CreateSessionDto>,
  ) {
    return this.physicalService.updateSession(id, dto);
  }

  @Delete('sessions/:id')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Cancel session' })
  cancelSession(@Param('id', ParseCuidPipe) id: string) {
    return this.physicalService.cancelSession(id);
  }

  @Post('sessions/:id/attendance')
  @Roles(UserRole.ADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Record attendance' })
  recordAttendance(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: RecordAttendanceDto,
  ) {
    return this.physicalService.recordAttendance(id, dto);
  }

  @Get('sessions/:id/attendance')
  @ApiOperation({ summary: 'Get attendance list' })
  getAttendance(@Param('id', ParseCuidPipe) id: string) {
    return this.physicalService.getAttendance(id);
  }
}
