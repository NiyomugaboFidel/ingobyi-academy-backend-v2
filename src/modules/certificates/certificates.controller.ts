import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import {
  CertificateRequestListQueryDto,
  RejectCertificateRequestDto,
  RequestCertificateDto,
} from './dto/certificate-request.dto';
import { CertificatesService } from './certificates.service';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post('request/:courseId')
  @ApiOperation({ summary: 'Request certificate after course completion' })
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: RequestCertificateDto,
  ) {
    return this.certificatesService.requestCertificate(
      user.userId,
      courseId,
      dto.message,
    );
  }

  @Get('request/:courseId')
  @ApiOperation({ summary: 'My certificate request status for a course' })
  requestStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.certificatesService.getRequestForCourse(user.userId, courseId);
  }

  @Get('requests')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List certificate requests for admin review' })
  listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CertificateRequestListQueryDto,
  ) {
    return this.certificatesService.listPendingForAdmin(user, query);
  }

  @Post('requests/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Approve certificate request and issue certificate',
  })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.certificatesService.approveRequest(id, user);
  }

  @Post('requests/:id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Reject certificate request' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: RejectCertificateRequestDto,
  ) {
    return this.certificatesService.rejectRequest(id, user, dto.reviewNote);
  }

  @Get('mine')
  @ApiOperation({ summary: 'My issued certificates' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.mine(user.userId);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download certificate PDF' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } =
      await this.certificatesService.getPdfDownload(user.userId, id);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verify certificate (public)' })
  verify(@Param('code') code: string) {
    return this.certificatesService.verify(code);
  }
}
