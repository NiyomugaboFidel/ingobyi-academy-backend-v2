-- AlterTable
ALTER TABLE "User" ADD COLUMN "ageBand" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "interestedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrgJoinRequest" ADD COLUMN "childIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "minAge" INTEGER,
ADD COLUMN "maxAge" INTEGER;
