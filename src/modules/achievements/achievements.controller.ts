import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AchievementsService } from './achievements.service';
import { AwardCustomAchievementDto } from './dto/award-custom-achievement.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';

@ApiTags('Achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get('definitions')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List achievement definitions' })
  listDefinitions() {
    return this.achievementsService.listDefinitions();
  }

  @Post('definitions')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create achievement definition' })
  createDefinition(@Body() dto: CreateAchievementDto) {
    return this.achievementsService.createDefinition(dto);
  }

  @Patch('definitions/:id')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update achievement definition' })
  updateDefinition(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: Partial<CreateAchievementDto>,
  ) {
    return this.achievementsService.updateDefinition(id, dto);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'My earned achievements (certificates, courses, badges)',
  })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.achievementsService.getUnifiedForUser(user.userId);
  }

  @Get('user/:userId')
  @Public()
  @ApiOperation({ summary: 'Public unified achievements for a user' })
  forUser(@Param('userId', ParseCuidPipe) userId: string) {
    return this.achievementsService.getUnifiedForUser(userId);
  }

  @Post('award')
  @Roles(UserRole.ADMIN, UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Award a custom achievement to a user' })
  awardCustom(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AwardCustomAchievementDto,
  ) {
    return this.achievementsService.awardCustom(dto, user.userId);
  }

  @Post('award/:userId/:defId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Manually award existing achievement definition' })
  award(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseCuidPipe) userId: string,
    @Param('defId', ParseCuidPipe) defId: string,
  ) {
    return this.achievementsService.award(userId, defId, user.userId);
  }
}
