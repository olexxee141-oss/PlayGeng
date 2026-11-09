-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunityMemberRole" AS ENUM ('OWNER', 'ADMIN', 'TREASURER', 'ORGANIZER', 'MEMBER');

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(1000),
    "sport" VARCHAR(50) NOT NULL DEFAULT 'FOOTBALL',
    "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommunityMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");
CREATE INDEX "communities_ownerId_idx" ON "communities"("ownerId");
CREATE INDEX "communities_status_idx" ON "communities"("status");
CREATE INDEX "community_members_userId_idx" ON "community_members"("userId");
CREATE INDEX "community_members_communityId_role_idx" ON "community_members"("communityId", "role");
CREATE UNIQUE INDEX "community_members_communityId_userId_key" ON "community_members"("communityId", "userId");

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
