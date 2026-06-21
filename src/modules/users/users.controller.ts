import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.userId, {
      orgId: user.orgId,
      orgRole: user.orgRole,
    });
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.userId, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Soft delete account' })
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteMe(user.userId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Public profile' })
  getProfile(@Param('id', ParseCuidPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Public()
  @Get(':id/achievements')
  @ApiOperation({ summary: 'User achievements' })
  getAchievements(@Param('id', ParseCuidPipe) id: string) {
    return this.usersService.getAchievements(id);
  }

  @Public()
  @Get(':id/courses')
  @ApiOperation({ summary: 'Public enrolled/completed courses' })
  getCourses(@Param('id', ParseCuidPipe) id: string) {
    return this.usersService.getCourses(id);
  }

  @Patch('me/avatar')
  @ApiOperation({ summary: 'Update avatar URL' })
  updateAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(user.userId, dto);
  }
}
