-- CreateTable
CREATE TABLE "CommunityPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPostLike_postId_userId_key" ON "CommunityPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "CommunityPostLike_postId_idx" ON "CommunityPostLike"("postId");

-- CreateIndex
CREATE INDEX "CommunityPostLike_userId_idx" ON "CommunityPostLike"("userId");

-- AddForeignKey
ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
