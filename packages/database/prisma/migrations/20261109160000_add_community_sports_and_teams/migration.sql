-- Sports and team foundation.
CREATE TYPE "Sport" AS ENUM ('FOOTBALL', 'BASKETBALL', 'VOLLEYBALL', 'TENNIS', 'TABLE_TENNIS', 'BADMINTON', 'CRICKET', 'RUGBY', 'ESPORTS', 'OTHER');
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TeamMemberRole" AS ENUM ('CAPTAIN', 'COACH', 'PLAYER');

CREATE TABLE "community_sports" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "sport" "Sport" NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_sports_pkey" PRIMARY KEY ("id")
);

INSERT INTO "community_sports" ("id", "communityId", "sport", "isPrimary")
SELECT 'cs_' || md5(c."id" || ':' || upper(c."sport")), c."id",
  CASE WHEN upper(c."sport") IN ('FOOTBALL','BASKETBALL','VOLLEYBALL','TENNIS','TABLE_TENNIS','BADMINTON','CRICKET','RUGBY','ESPORTS')
       THEN upper(c."sport")::"Sport" ELSE 'OTHER'::"Sport" END,
  true
FROM "communities" c;

CREATE TABLE "teams" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "communitySportId" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "shortName" VARCHAR(20),
  "description" VARCHAR(500),
  "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_members" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TeamMemberRole" NOT NULL DEFAULT 'PLAYER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_sports_communityId_sport_key" ON "community_sports"("communityId", "sport");
CREATE UNIQUE INDEX "community_sports_communityId_id_key" ON "community_sports"("communityId", "id");
CREATE INDEX "community_sports_communityId_isPrimary_idx" ON "community_sports"("communityId", "isPrimary");
CREATE UNIQUE INDEX "teams_id_communityId_key" ON "teams"("id", "communityId");
CREATE UNIQUE INDEX "teams_communityId_name_key" ON "teams"("communityId", "name");
CREATE INDEX "teams_communityId_status_idx" ON "teams"("communityId", "status");
CREATE INDEX "teams_communitySportId_status_idx" ON "teams"("communitySportId", "status");
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");
CREATE UNIQUE INDEX "team_members_one_captain_per_team_key" ON "team_members"("teamId") WHERE "role" = 'CAPTAIN';
CREATE INDEX "team_members_communityId_userId_idx" ON "team_members"("communityId", "userId");
CREATE INDEX "team_members_userId_joinedAt_idx" ON "team_members"("userId", "joinedAt");

ALTER TABLE "community_sports" ADD CONSTRAINT "community_sports_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_communitySportId_communityId_fkey" FOREIGN KEY ("communitySportId", "communityId") REFERENCES "community_sports"("id", "communityId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_communityId_fkey" FOREIGN KEY ("teamId", "communityId") REFERENCES "teams"("id", "communityId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_communityId_userId_fkey" FOREIGN KEY ("communityId", "userId") REFERENCES "community_members"("communityId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teams" ADD CONSTRAINT "teams_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
