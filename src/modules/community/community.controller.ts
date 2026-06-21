import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CommunityAdminPostsQueryDto,
  CommunityFeedQueryDto,
} from './dto/community-query.dto';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CommunityService } from './community.service';
import { FollowListQueryDto } from './dto/follow-list-query.dto';
import { PeopleSearchQueryDto } from './dto/people-search-query.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Community')
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('feed')
  @Public()
  @ApiOperation({ summary: 'Global or org feed' })
  feed(@Query() query: CommunityFeedQueryDto) {
    return this.communityService.feed(query.orgId, query);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Create post' })
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.communityService.createPost(user.userId, dto);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete post' })
  deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const isModerator =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    return this.communityService.deletePost(id, user.userId, isModerator);
  }

  @Get('admin/posts')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List posts for moderation' })
  adminPosts(@Query() query: CommunityAdminPostsQueryDto) {
    return this.communityService.adminListPosts(query, query.orgId);
  }

  @Delete('admin/posts/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Moderator delete post' })
  adminDeletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.communityService.deletePost(id, user.userId, true);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like post' })
  like(@Param('id', ParseCuidPipe) id: string) {
    return this.communityService.toggleLike(id);
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Comment on post' })
  comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.comment(id, user.userId, dto);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete comment' })
  deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const isModerator =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    return this.communityService.deleteComment(id, user.userId, isModerator);
  }

  @Delete('admin/comments/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Moderator delete comment' })
  adminDeleteComment(@Param('id', ParseCuidPipe) id: string) {
    return this.communityService.deleteComment(id, '', true);
  }

  @Post('follow/:userId')
  @ApiOperation({ summary: 'Follow/unfollow user' })
  follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseCuidPipe) userId: string,
  ) {
    return this.communityService.toggleFollow(user.userId, userId);
  }

  @Get('leaderboard')
  @Public()
  @ApiOperation({ summary: 'Top learners by points' })
  leaderboard() {
    return this.communityService.leaderboard();
  }

  @Get('people/search')
  @ApiOperation({ summary: 'Search community members' })
  searchPeople(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PeopleSearchQueryDto,
  ) {
    return this.communityService.searchPeople(user.userId, query.q, query);
  }

  @Get('people/suggestions')
  @ApiOperation({ summary: 'People you may know' })
  peopleSuggestions(@CurrentUser() user: AuthenticatedUser) {
    return this.communityService.peopleSuggestions(user.userId, 12);
  }

  @Get('people/popular')
  @Public()
  @ApiOperation({ summary: 'Popular community members' })
  popularPeople(@CurrentUser() user?: AuthenticatedUser) {
    return this.communityService.popularPeople(user?.userId, 10);
  }

  @Get(':userId/followers')
  @Public()
  @ApiOperation({ summary: 'List profile followers' })
  followers(
    @Param('userId', ParseCuidPipe) userId: string,
    @Query() query: FollowListQueryDto,
  ) {
    return this.communityService.followers(userId, query);
  }

  @Get(':userId/following')
  @Public()
  @ApiOperation({ summary: 'List users this profile follows' })
  following(
    @Param('userId', ParseCuidPipe) userId: string,
    @Query() query: FollowListQueryDto,
  ) {
    return this.communityService.following(userId, query);
  }

  @Get(':userId/profile')
  @Public()
  @ApiOperation({ summary: 'Public learner profile' })
  profile(@Param('userId', ParseCuidPipe) userId: string) {
    return this.communityService.profile(userId);
  }
}
