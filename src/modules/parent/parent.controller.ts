import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { ParentService } from './parent.service';

@ApiTags('Parent')
@Controller('parent')
@Roles(UserRole.PARENT, UserRole.SUPERADMIN)
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Get('children')
  @ApiOperation({ summary: 'List linked children with progress' })
  listChildren(@CurrentUser() user: AuthenticatedUser) {
    return this.parentService.listChildren(user.userId);
  }

  @Get('children/:childId')
  @ApiOperation({
    summary: 'Child detail with courses, achievements, assignments',
  })
  getChild(
    @CurrentUser() user: AuthenticatedUser,
    @Param('childId', ParseCuidPipe) childId: string,
  ) {
    return this.parentService.getChildDetail(user.userId, childId);
  }
}
