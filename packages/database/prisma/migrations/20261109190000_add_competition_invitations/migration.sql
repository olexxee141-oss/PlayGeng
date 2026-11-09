CREATE TYPE "CompetitionInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "competition_invitations" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "participantType" "CompetitionParticipantType" NOT NULL,
  "teamId" TEXT,
  "playerUserId" TEXT,
  "invitedUserId" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "status" "CompetitionInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competition_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competition_invitations_participant_identity_check" CHECK (
    ("participantType" = 'TEAM' AND "teamId" IS NOT NULL AND "playerUserId" IS NULL)
    OR
    ("participantType" = 'PLAYER' AND "playerUserId" IS NOT NULL AND "teamId" IS NULL AND "invitedUserId" = "playerUserId")
  )
);

CREATE UNIQUE INDEX "competition_invitations_pending_team_key"
  ON "competition_invitations"("competitionId", "teamId")
  WHERE "teamId" IS NOT NULL AND "status" = 'PENDING';
CREATE UNIQUE INDEX "competition_invitations_pending_player_key"
  ON "competition_invitations"("competitionId", "playerUserId")
  WHERE "playerUserId" IS NOT NULL AND "status" = 'PENDING';
CREATE INDEX "competition_invitations_competitionId_status_expiresAt_idx"
  ON "competition_invitations"("competitionId", "status", "expiresAt");
CREATE INDEX "competition_invitations_communityId_invitedUserId_status_idx"
  ON "competition_invitations"("communityId", "invitedUserId", "status");

ALTER TABLE "competition_invitations"
  ADD CONSTRAINT "competition_invitations_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competition_invitations"
  ADD CONSTRAINT "competition_invitations_competitionId_communityId_participantType_fkey"
  FOREIGN KEY ("competitionId", "communityId", "participantType")
  REFERENCES "competitions"("id", "communityId", "participantType") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competition_invitations"
  ADD CONSTRAINT "competition_invitations_teamId_communityId_fkey"
  FOREIGN KEY ("teamId", "communityId") REFERENCES "teams"("id", "communityId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competition_invitations"
  ADD CONSTRAINT "competition_invitations_playerUserId_fkey"
  FOREIGN KEY ("playerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competition_invitations"
  ADD CONSTRAINT "competition_invitations_invitedUserId_fkey"
  FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competition_invitations"
  ADD CONSTRAINT "competition_invitations_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
