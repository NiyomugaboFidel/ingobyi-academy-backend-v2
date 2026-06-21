import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'List saved courses' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlistService.list(user.userId);
  }

  @Get(':courseId/check')
  @ApiOperation({ summary: 'Check if course is saved' })
  check(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.wishlistService.isSaved(user.userId, courseId);
  }

  @Post(':courseId')
  @ApiOperation({ summary: 'Save course to wishlist' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.wishlistService.add(user.userId, courseId);
  }

  @Delete(':courseId')
  @ApiOperation({ summary: 'Remove from wishlist' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.wishlistService.remove(user.userId, courseId);
  }
}
