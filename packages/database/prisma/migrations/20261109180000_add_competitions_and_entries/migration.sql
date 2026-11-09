-- Competition and registration foundation.
CREATE TYPE "CompetitionFormat" AS ENUM ('ROUND_ROBIN', 'KNOCKOUT');
CREATE TYPE "CompetitionParticipantType" AS ENUM ('TEAM', 'PLAYER');
CREATE TYPE "CompetitionRegistrationMode" AS ENUM ('OPEN', 'APPROVAL_REQUIRED', 'INVITE_ONLY');
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CompetitionEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "competitions" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "communitySportId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "description" VARCHAR(2000),
  "format" "CompetitionFormat" NOT NULL,
  "participantType" "CompetitionParticipantType" NOT NULL,
  "registrationMode" "CompetitionRegistrationMode" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
  "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
  "maxEntries" INTEGER,
  "registrationOpensAt" TIMESTAMP(3),
  "registrationClosesAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "rulesetVersion" VARCHAR(32) NOT NULL DEFAULT '1',
  "adapterVersion" VARCHAR(32) NOT NULL DEFAULT '1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitions_maxEntries_check" CHECK ("maxEntries" IS NULL OR "maxEntries" >= 2),
  CONSTRAINT "competitions_registration_window_check" CHECK (
    "registrationOpensAt" IS NULL OR "registrationClosesAt" IS NULL OR "registrationOpensAt" < "registrationClosesAt"
  )
);

CREATE TABLE "competition_entries" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "participantType" "CompetitionParticipantType" NOT NULL,
  "teamId" TEXT,
  "playerUserId" TEXT,
  "status" "CompetitionEntryStatus" NOT NULL DEFAULT 'PENDING',
  "participantNameSnapshot" VARCHAR(160) NOT NULL,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "rejectionReason" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competition_entries_participant_identity_check" CHECK (
    ("participantType" = 'TEAM' AND "teamId" IS NOT NULL AND "playerUserId" IS NULL)
    OR
    ("participantType" = 'PLAYER' AND "playerUserId" IS NOT NULL AND "teamId" IS NULL)
  )
);

CREATE UNIQUE INDEX "competitions_id_communityId_key" ON "competitions"("id", "communityId");
CREATE UNIQUE INDEX "competitions_id_communityId_participantType_key" ON "competitions"("id", "communityId", "participantType");
CREATE INDEX "competitions_communityId_status_startsAt_idx" ON "competitions"("communityId", "status", "startsAt");
CREATE INDEX "competitions_communitySportId_status_idx" ON "competitions"("communitySportId", "status");

CREATE UNIQUE INDEX "competition_entries_competitionId_teamId_key" ON "competition_entries"("competitionId", "teamId");
CREATE UNIQUE INDEX "competition_entries_competitionId_playerUserId_key" ON "competition_entries"("competitionId", "playerUserId");
CREATE INDEX "competition_entries_competitionId_status_registeredAt_idx" ON "competition_entries"("competitionId", "status", "registeredAt");
CREATE INDEX "competition_entries_communityId_playerUserId_idx" ON "competition_entries"("communityId", "playerUserId");

ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_communitySportId_communityId_fkey"
  FOREIGN KEY ("communitySportId", "communityId") REFERENCES "community_sports"("id", "communityId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competition_entries"
  ADD CONSTRAINT "competition_entries_competitionId_communityId_participantType_fkey"
  FOREIGN KEY ("competitionId", "communityId", "participantType")
  REFERENCES "competitions"("id", "communityId", "participantType") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competition_entries"
  ADD CONSTRAINT "competition_entries_teamId_communityId_fkey"
  FOREIGN KEY ("teamId", "communityId") REFERENCES "teams"("id", "communityId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competition_entries"
  ADD CONSTRAINT "competition_entries_communityId_playerUserId_fkey"
  FOREIGN KEY ("communityId", "playerUserId") REFERENCES "community_members"("communityId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competition_entries"
  ADD CONSTRAINT "competition_entries_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competition_entries"
  ADD CONSTRAINT "competition_entries_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
