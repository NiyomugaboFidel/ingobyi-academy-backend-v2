import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrgGuard } from '../../common/guards/org.guard';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JoinRequestDto } from './dto/join-request.dto';
import { ReviewJoinRequestDto } from './dto/review-join-request.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UpdateCertificateSettingsDto } from './dto/update-certificate-settings.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create organization' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.orgsService.create(user.userId, dto);
  }

  @Post('bootstrap')
  @ApiOperation({ summary: 'Create your own organization (become admin)' })
  bootstrap(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.orgsService.create(user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my memberships for workspace picker' })
  listMyMemberships(@CurrentUser() user: AuthenticatedUser) {
    return this.orgsService.listMyMemberships(user.userId);
  }

  @Public()
  @Get('directory')
  @ApiOperation({ summary: 'Public organization directory' })
  directory(@Query() pagination: PaginationDto) {
    return this.orgsService.directory(pagination);
  }

  @Post('invites/redeem')
  @ApiOperation({ summary: 'Accept organization invite token' })
  redeemInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body('token') token: string,
  ) {
    return this.orgsService.redeemInvite(token, user.userId);
  }

  @Post('join-requests')
  @ApiOperation({ summary: 'Request to join an organization with a role' })
  createJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJoinRequestDto,
  ) {
    return this.orgsService.createJoinRequest(user.userId, dto);
  }

  @Get('my-join-requests')
  @ApiOperation({ summary: 'List my organization join requests' })
  listMyJoinRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.orgsService.listMyJoinRequests(user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.orgsService.list(user, pagination);
  }

  @Patch(':id')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Update organization' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.update(id, dto);
  }

  @Get(':id/certificate-settings')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Certificate signatory settings for PDFs' })
  async getCertificateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.getCertificateSettings(id);
  }

  @Patch(':id/certificate-settings')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Update certificate signatory names shown on PDFs' })
  async updateCertificateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCertificateSettingsDto,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.updateCertificateSettings(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Soft delete organization' })
  remove(@Param('id', ParseCuidPipe) id: string) {
    return this.orgsService.softDelete(id);
  }

  @Get(':id/members')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'List members' })
  listMembers(
    @Param('id', ParseCuidPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.orgsService.listMembers(id, pagination);
  }

  @Post(':id/members')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Add existing user as member (admin)' })
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.addMember(id, dto, user.userId);
  }

  @Post(':id/invite')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Invite by email' })
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: InviteMemberDto,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.invite(id, dto);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Request to join' })
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: JoinRequestDto,
  ) {
    return this.orgsService.requestJoin(id, user.userId, dto);
  }

  @Patch(':id/members/:userId')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Update member role' })
  async updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.updateMember(id, userId, dto, user.userId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Remove member' })
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) userId: string,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.removeMember(id, userId);
  }

  @Get(':id/join-requests')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'List pending join requests' })
  async listJoinRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.listJoinRequests(id);
  }

  @Patch(':id/join-requests/:reqId')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Approve/reject join request' })
  async reviewJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Param('reqId', ParseCuidPipe) reqId: string,
    @Body() dto: ReviewJoinRequestDto,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.reviewJoinRequest(id, reqId, dto, user.userId);
  }

  @Get(':id/permissions')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Get RBAC matrix' })
  getPermissions(@Param('id', ParseCuidPipe) id: string) {
    return this.orgsService.getPermissions(id);
  }

  @Patch(':id/permissions')
  @UseGuards(OrgGuard)
  @ApiOperation({ summary: 'Update RBAC matrix' })
  async updatePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    await this.orgsService.assertOrgAdmin(user, id);
    return this.orgsService.updatePermissions(id, dto);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Public org profile by slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.orgsService.getBySlug(slug);
  }
}
