import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, Prisma } from '@prisma/client';
import {
  buildPaginatedMeta,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import {
  buildPublicUserMeta,
  publicUserFieldsSelect,
} from '../../common/utils/public-user-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';

type RawPublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  bio: string | null;
  platformRole: import('@prisma/client').UserRole;
  isVerified: boolean;
  memberships: Array<{
    role: import('@prisma/client').UserRole;
    status: import('@prisma/client').MembershipStatus;
  }>;
  trainedCourses: Array<{ id: string }>;
};

export type CommunityUserStats = {
  coursesCompleted: number;
  certificatesEarned: number;
  achievementPoints: number;
  reviewsWritten: number;
  trainerRating: number | null;
  trainerReviewCount: number;
};

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
  ) {}

  async feed(orgId: string | undefined, pagination: PaginationDto) {
    const where = orgId ? { orgId } : {};
    const [data, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          author: { select: publicUserFieldsSelect },
          comments: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { author: { select: publicUserFieldsSelect } },
          },
        },
      }),
      this.prisma.communityPost.count({ where }),
    ]);

    const authorIds = [
      ...new Set([
        ...data.map((p) => p.authorId),
        ...data.flatMap((p) => p.comments.map((c) => c.authorId)),
      ]),
    ];
    const statsMap = await this.loadStatsForUsers(authorIds);

    return {
      data: data.map((post) => this.mapPost(post, statsMap)),
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async createPost(authorId: string, dto: CreatePostDto) {
    const post = await this.prisma.communityPost.create({
      data: { authorId, ...dto },
      include: {
        author: { select: publicUserFieldsSelect },
      },
    });
    const statsMap = await this.loadStatsForUsers([authorId]);
    return this.mapPost({ ...post, comments: [] }, statsMap);
  }

  async deletePost(postId: string, userId: string, isModerator = false) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post || (!isModerator && post.authorId !== userId)) {
      throw new NotFoundException('Post not found');
    }
    return this.prisma.communityPost.delete({ where: { id: postId } });
  }

  async toggleLike(postId: string) {
    await this.prisma.communityPost.findUniqueOrThrow({
      where: { id: postId },
    });
    return this.prisma.communityPost.update({
      where: { id: postId },
      data: { likesCount: { increment: 1 } },
    });
  }

  async comment(postId: string, authorId: string, dto: CreateCommentDto) {
    const comment = await this.prisma.communityComment.create({
      data: { postId, authorId, ...dto },
      include: {
        author: { select: publicUserFieldsSelect },
      },
    });
    return {
      ...comment,
      author: this.mapPublicUser(comment.author, null),
    };
  }

  async deleteComment(commentId: string, userId: string, isModerator = false) {
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || (!isModerator && comment.authorId !== userId)) {
      throw new NotFoundException('Comment not found');
    }
    return this.prisma.communityComment.delete({ where: { id: commentId } });
  }

  async adminListPosts(pagination: PaginationDto, orgId?: string) {
    const where = orgId ? { orgId } : {};
    const [data, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.communityPost.count({ where }),
    ]);
    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async toggleFollow(followerId: string, followingId: string) {
    const existing = await this.prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) {
      await this.prisma.userFollow.delete({ where: { id: existing.id } });
      return { following: false };
    }
    await this.prisma.userFollow.create({ data: { followerId, followingId } });
    return { following: true };
  }

  async leaderboard() {
    const achievements = await this.prisma.studentAchievement.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: achievements.map((a) => a.userId) } },
      select: publicUserFieldsSelect,
    });
    const statsMap = await this.loadStatsForUsers(users.map((u) => u.id));
    return achievements.map((a) => {
      const raw = users.find((u) => u.id === a.userId);
      return {
        user: raw
          ? this.mapPublicUser(raw, statsMap.get(a.userId) ?? null)
          : null,
        points: a._count.id * 10,
      };
    });
  }

  async searchUsers(q: string, limit = 20) {
    const term = q.trim();
    if (!term) return [];
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
      },
      take: Math.min(limit, 50),
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: {
        ...publicUserFieldsSelect,
        country: true,
        createdAt: true,
        posts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            likesCount: true,
            createdAt: true,
          },
        },
        followers: {
          take: 24,
          orderBy: { createdAt: 'desc' },
          select: {
            followerId: true,
            follower: { select: publicUserFieldsSelect },
          },
        },
        following: {
          take: 24,
          orderBy: { createdAt: 'desc' },
          select: {
            followingId: true,
            following: { select: publicUserFieldsSelect },
          },
        },
        _count: { select: { followers: true, following: true, posts: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [stats, unifiedAchievements] = await Promise.all([
      this.loadUserStats(userId),
      this.achievements.getUnifiedForUser(userId),
    ]);
    const meta = buildPublicUserMeta({
      platformRole: user.platformRole,
      isVerified: user.isVerified,
      memberships: user.memberships,
      isTrainer: user.trainedCourses.length > 0,
    });

    const relatedIds = [
      ...user.followers.map((r) => r.followerId),
      ...user.following.map((r) => r.followingId),
    ];
    const statsMap = await this.loadStatsForUsers(relatedIds);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      country: user.country,
      createdAt: user.createdAt,
      platformRole: meta.platformRole,
      displayRole: meta.displayRole,
      isVerified: meta.isVerified,
      stats: {
        ...stats,
        achievementPoints: unifiedAchievements.reduce(
          (sum, item) => sum + item.points,
          0,
        ),
      },
      posts: user.posts,
      achievements: unifiedAchievements,
      followers: user.followers.map((row) => ({ followerId: row.followerId })),
      following: user.following.map((row) => ({
        followingId: row.followingId,
      })),
      followerUsers: user.followers.map((row) =>
        this.mapPublicUser(row.follower, statsMap.get(row.followerId) ?? null),
      ),
      followingUsers: user.following.map((row) =>
        this.mapPublicUser(
          row.following,
          statsMap.get(row.followingId) ?? null,
        ),
      ),
      followerCount: user._count.followers,
      followingCount: user._count.following,
      postCount: user._count.posts,
    };
  }

  async followers(userId: string, pagination: PaginationDto) {
    await this.ensureActiveUser(userId);
    const where = { followingId: userId };
    const [rows, total] = await Promise.all([
      this.prisma.userFollow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { follower: { select: publicUserFieldsSelect } },
      }),
      this.prisma.userFollow.count({ where }),
    ]);
    const statsMap = await this.loadStatsForUsers(
      rows.map((r) => r.followerId),
    );
    return {
      data: rows.map((row) =>
        this.mapPublicUser(row.follower, statsMap.get(row.followerId) ?? null),
      ),
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async following(userId: string, pagination: PaginationDto) {
    await this.ensureActiveUser(userId);
    const where = { followerId: userId };
    const [rows, total] = await Promise.all([
      this.prisma.userFollow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { following: { select: publicUserFieldsSelect } },
      }),
      this.prisma.userFollow.count({ where }),
    ]);
    const statsMap = await this.loadStatsForUsers(
      rows.map((r) => r.followingId),
    );
    return {
      data: rows.map((row) =>
        this.mapPublicUser(
          row.following,
          statsMap.get(row.followingId) ?? null,
        ),
      ),
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  private mapPublicUser(user: RawPublicUser, stats: CommunityUserStats | null) {
    const meta = buildPublicUserMeta({
      platformRole: user.platformRole,
      isVerified: user.isVerified,
      memberships: user.memberships,
      isTrainer: user.trainedCourses.length > 0,
    });
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      platformRole: meta.platformRole,
      displayRole: meta.displayRole,
      isVerified: meta.isVerified,
      stats,
    };
  }

  private mapPost(
    post: {
      id: string;
      content: string;
      orgId: string | null;
      likesCount: number;
      isPinned: boolean;
      createdAt: Date;
      author: RawPublicUser;
      comments: Array<{
        id: string;
        content: string;
        createdAt: Date;
        author: RawPublicUser;
      }>;
    },
    statsMap: Map<string, CommunityUserStats>,
  ) {
    return {
      id: post.id,
      content: post.content,
      orgId: post.orgId,
      likesCount: post.likesCount,
      isPinned: post.isPinned,
      createdAt: post.createdAt,
      author: this.mapPublicUser(
        post.author,
        statsMap.get(post.author.id) ?? null,
      ),
      comments: post.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: this.mapPublicUser(c.author, statsMap.get(c.author.id) ?? null),
      })),
    };
  }

  async loadUserStats(userId: string): Promise<CommunityUserStats> {
    const map = await this.loadStatsForUsers([userId]);
    return map.get(userId)!;
  }

  private async loadStatsForUsers(userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    const result = new Map<string, CommunityUserStats>();
    if (!unique.length) return result;

    const [
      completedRows,
      certificateRows,
      achievementRows,
      reviewRows,
      trainerLinks,
    ] = await Promise.all([
      this.prisma.enrollment.groupBy({
        by: ['userId'],
        where: { userId: { in: unique }, status: 'COMPLETED' },
        _count: { id: true },
      }),
      this.prisma.certificate.groupBy({
        by: ['userId'],
        where: { userId: { in: unique }, revokedAt: null },
        _count: { id: true },
      }),
      this.prisma.studentAchievement.groupBy({
        by: ['userId'],
        where: { userId: { in: unique } },
        _count: { id: true },
      }),
      this.prisma.courseReview.groupBy({
        by: ['userId'],
        where: { userId: { in: unique }, isVisible: true },
        _count: { id: true },
      }),
      this.prisma.courseTrainer.findMany({
        where: { userId: { in: unique } },
        select: { userId: true, courseId: true },
      }),
    ]);

    const trainerCourseIdsByUser = new Map<string, string[]>();
    for (const link of trainerLinks) {
      const list = trainerCourseIdsByUser.get(link.userId) ?? [];
      list.push(link.courseId);
      trainerCourseIdsByUser.set(link.userId, list);
    }

    const allTrainerCourseIds = [
      ...new Set(trainerLinks.map((l) => l.courseId)),
    ];
    const trainerRatingRows = allTrainerCourseIds.length
      ? await this.prisma.courseReview.groupBy({
          by: ['courseId'],
          where: { courseId: { in: allTrainerCourseIds }, isVisible: true },
          _avg: { rating: true },
          _count: { id: true },
        })
      : [];

    const ratingByCourse = new Map(
      trainerRatingRows.map((r) => [
        r.courseId,
        { avg: r._avg.rating, count: r._count.id },
      ]),
    );

    for (const id of unique) {
      const courseIds = trainerCourseIdsByUser.get(id) ?? [];
      let ratingSum = 0;
      let ratingCount = 0;
      for (const courseId of courseIds) {
        const row = ratingByCourse.get(courseId);
        if (row?.avg != null && row.count > 0) {
          ratingSum += row.avg * row.count;
          ratingCount += row.count;
        }
      }

      result.set(id, {
        coursesCompleted:
          completedRows.find((r) => r.userId === id)?._count.id ?? 0,
        certificatesEarned:
          certificateRows.find((r) => r.userId === id)?._count.id ?? 0,
        achievementPoints:
          (certificateRows.find((r) => r.userId === id)?._count.id ?? 0) * 50 +
          Math.max(
            0,
            (completedRows.find((r) => r.userId === id)?._count.id ?? 0) -
              (certificateRows.find((r) => r.userId === id)?._count.id ?? 0),
          ) *
            25 +
          (achievementRows.find((r) => r.userId === id)?._count.id ?? 0) * 10,
        reviewsWritten: reviewRows.find((r) => r.userId === id)?._count.id ?? 0,
        trainerRating:
          ratingCount > 0
            ? Math.round((ratingSum / ratingCount) * 10) / 10
            : null,
        trainerReviewCount: ratingCount,
      });
    }

    return result;
  }

  async searchPeople(
    viewerId: string,
    query: string | undefined,
    pagination: PaginationDto,
  ) {
    const q = query?.trim() ?? '';
    if (!q) {
      return {
        data: [],
        meta: buildPaginatedMeta(pagination.page, pagination.limit, 0),
      };
    }

    const where: Prisma.UserWhereInput = {
      isActive: true,
      id: { not: viewerId },
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          ...publicUserFieldsSelect,
          _count: { select: { followers: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const followingSet = await this.loadFollowingSet(
      viewerId,
      rows.map((r) => r.id),
    );
    const statsMap = await this.loadStatsForUsers(rows.map((r) => r.id));

    return {
      data: rows.map((row) =>
        this.mapDiscoverUser(row, statsMap.get(row.id) ?? null, {
          isFollowing: followingSet.has(row.id),
          followerCount: row._count.followers,
        }),
      ),
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async peopleSuggestions(viewerId: string, limit = 12) {
    const [memberships, myFollowing, enrollments] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId: viewerId, status: MembershipStatus.ACTIVE },
        select: { orgId: true, org: { select: { name: true } } },
      }),
      this.prisma.userFollow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      }),
      this.prisma.enrollment.findMany({
        where: { userId: viewerId },
        select: { courseId: true, course: { select: { title: true } } },
      }),
    ]);

    const followingIds = new Set(myFollowing.map((f) => f.followingId));
    followingIds.add(viewerId);

    type Scored = { userId: string; score: number; reason: string };
    const scored = new Map<string, Scored>();

    const add = (userId: string, score: number, reason: string) => {
      if (followingIds.has(userId)) return;
      const existing = scored.get(userId);
      if (!existing || score > existing.score) {
        scored.set(userId, { userId, score, reason });
      }
    };

    const orgIds = memberships.map((m) => m.orgId);
    if (orgIds.length) {
      const orgPeers = await this.prisma.membership.findMany({
        where: {
          orgId: { in: orgIds },
          status: MembershipStatus.ACTIVE,
          userId: { notIn: [...followingIds] },
        },
        select: { userId: true, org: { select: { name: true } } },
        take: 40,
      });
      for (const peer of orgPeers) {
        add(peer.userId, 4, `Member of ${peer.org.name}`);
      }
    }

    const courseIds = enrollments.map((e) => e.courseId);
    if (courseIds.length) {
      const trainers = await this.prisma.courseTrainer.findMany({
        where: {
          courseId: { in: courseIds },
          userId: { notIn: [...followingIds] },
        },
        include: { course: { select: { title: true } } },
        take: 20,
      });
      for (const link of trainers) {
        add(link.userId, 5, `Trainer for ${link.course.title}`);
      }
    }

    if (myFollowing.length) {
      const network = await this.prisma.userFollow.findMany({
        where: {
          followerId: { in: myFollowing.map((f) => f.followingId) },
          followingId: { notIn: [...followingIds] },
        },
        select: { followingId: true },
        take: 30,
      });
      for (const row of network) {
        add(row.followingId, 3, 'Followed by people you know');
      }
    }

    const activePosters = await this.prisma.communityPost.groupBy({
      by: ['authorId'],
      where: { authorId: { notIn: [...followingIds] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    });
    for (const row of activePosters) {
      add(row.authorId, 2, 'Active in community');
    }

    const topIds = [...scored.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.userId);

    if (!topIds.length) {
      return this.popularPeople(viewerId, limit);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: topIds }, isActive: true },
      select: {
        ...publicUserFieldsSelect,
        _count: { select: { followers: true } },
      },
    });

    const statsMap = await this.loadStatsForUsers(topIds);
    const followingSet = await this.loadFollowingSet(viewerId, topIds);
    const byId = new Map(users.map((u) => [u.id, u]));

    return topIds
      .map((id) => {
        const user = byId.get(id);
        if (!user) return null;
        const meta = scored.get(id)!;
        return this.mapDiscoverUser(user, statsMap.get(id) ?? null, {
          isFollowing: followingSet.has(id),
          followerCount: user._count.followers,
          suggestionReason: meta.reason,
        });
      })
      .filter(Boolean);
  }

  async popularPeople(viewerId: string | undefined, limit = 10) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(viewerId ? { id: { not: viewerId } } : {}),
      },
      select: {
        ...publicUserFieldsSelect,
        _count: { select: { followers: true, posts: true } },
      },
      orderBy: [
        { followers: { _count: 'desc' } },
        { posts: { _count: 'desc' } },
      ],
      take: limit,
    });

    const ids = users.map((u) => u.id);
    const statsMap = await this.loadStatsForUsers(ids);
    const followingSet = viewerId
      ? await this.loadFollowingSet(viewerId, ids)
      : new Set<string>();

    return users.map((user) =>
      this.mapDiscoverUser(user, statsMap.get(user.id) ?? null, {
        isFollowing: followingSet.has(user.id),
        followerCount: user._count.followers,
        suggestionReason: 'Popular in community',
      }),
    );
  }

  private mapDiscoverUser(
    user: RawPublicUser & { _count?: { followers: number } },
    stats: CommunityUserStats | null,
    extras: {
      isFollowing?: boolean;
      followerCount?: number;
      mutualCount?: number;
      suggestionReason?: string;
    } = {},
  ) {
    return {
      ...this.mapPublicUser(user, stats),
      isFollowing: extras.isFollowing ?? false,
      followerCount: extras.followerCount ?? user._count?.followers ?? 0,
      mutualCount: extras.mutualCount ?? 0,
      suggestionReason: extras.suggestionReason,
    };
  }

  private async loadFollowingSet(viewerId: string, targetIds: string[]) {
    if (!targetIds.length) return new Set<string>();
    const rows = await this.prisma.userFollow.findMany({
      where: {
        followerId: viewerId,
        followingId: { in: targetIds },
      },
      select: { followingId: true },
    });
    return new Set(rows.map((r) => r.followingId));
  }

  private async ensureActiveUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }
}
