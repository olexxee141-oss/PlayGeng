CREATE TYPE "ContributionFrequency" AS ENUM ('ONE_OFF', 'MONTHLY');
CREATE TYPE "ContributionCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');
CREATE TYPE "ContributionAssessmentStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

CREATE TABLE "contribution_campaigns" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "description" VARCHAR(500),
  "amountMinor" BIGINT NOT NULL,
  "frequency" "ContributionFrequency" NOT NULL,
  "status" "ContributionCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "lastLifecycleActorId" TEXT,
  "pausedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "lifecycleReason" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contribution_campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_campaigns_amount_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "contribution_campaigns_community_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contribution_campaigns_creator_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_campaigns_lifecycle_actor_fkey" FOREIGN KEY ("lastLifecycleActorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "contribution_campaigns_communityId_status_createdAt_idx"
  ON "contribution_campaigns"("communityId", "status", "createdAt");

CREATE TABLE "contribution_assessments" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "periodKey" VARCHAR(32) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "ContributionAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "issuedById" TEXT,
  "cancelledById" TEXT,
  "issuedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contribution_assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_assessments_amount_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "contribution_assessments_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "contribution_assessments_campaign_fkey" FOREIGN KEY ("campaignId") REFERENCES "contribution_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessments_community_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessments_creator_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessments_issuer_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessments_canceller_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessments_campaignId_periodKey_key" UNIQUE ("campaignId", "periodKey")
);

CREATE INDEX "contribution_assessments_communityId_status_dueAt_idx"
  ON "contribution_assessments"("communityId", "status", "dueAt");
CREATE INDEX "contribution_assessments_campaignId_createdAt_idx"
  ON "contribution_assessments"("campaignId", "createdAt");

CREATE TABLE "contribution_assessment_members" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "memberRole" "CommunityMemberRole" NOT NULL,
  "memberJoinedAt" TIMESTAMP(3) NOT NULL,
  "memberFirstName" VARCHAR(80) NOT NULL,
  "memberLastName" VARCHAR(80) NOT NULL,
  "memberEmail" VARCHAR(320) NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "obligationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contribution_assessment_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_assessment_members_assessment_fkey" FOREIGN KEY ("assessmentId") REFERENCES "contribution_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessment_members_member_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessment_members_obligation_fkey" FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contribution_assessment_members_assessmentId_memberId_key" UNIQUE ("assessmentId", "memberId"),
  CONSTRAINT "contribution_assessment_members_obligationId_key" UNIQUE ("obligationId")
);

CREATE INDEX "contribution_assessment_members_assessmentId_snapshotAt_idx"
  ON "contribution_assessment_members"("assessmentId", "snapshotAt");
CREATE INDEX "contribution_assessment_members_memberId_createdAt_idx"
  ON "contribution_assessment_members"("memberId", "createdAt");
