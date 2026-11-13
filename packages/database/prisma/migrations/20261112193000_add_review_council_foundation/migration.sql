CREATE TYPE "ReviewCouncilSeat" AS ENUM ('PRIMARY', 'ALTERNATE');
CREATE TYPE "ReviewCouncilMembershipStatus" AS ENUM ('ACTIVE', 'RESIGNED', 'RECALLED', 'ENDED');

CREATE TABLE "community_review_council_elections" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "seatNumber" INTEGER NOT NULL,
  "seat" "ReviewCouncilSeat" NOT NULL,
  "alternateRank" INTEGER,
  "status" "ElectionStatus" NOT NULL DEFAULT 'NOMINATIONS_OPEN',
  "createdById" TEXT NOT NULL,
  "nominationsCloseAt" TIMESTAMP(3) NOT NULL,
  "votingOpensAt" TIMESTAMP(3) NOT NULL,
  "votingClosesAt" TIMESTAMP(3) NOT NULL,
  "quorumPercent" INTEGER NOT NULL,
  "eligibleVoterCount" INTEGER NOT NULL,
  "votesCast" INTEGER NOT NULL DEFAULT 0,
  "winnerId" TEXT,
  "failureReason" VARCHAR(300),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_review_council_elections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_review_council_elections_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "community_review_council_elections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "community_review_council_elections_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "community_review_council_elections_seatNumber_check" CHECK ("seatNumber" >= 1 AND "seatNumber" <= 5),
  CONSTRAINT "community_review_council_elections_alternateRank_check" CHECK (("seat" = 'PRIMARY' AND "alternateRank" IS NULL) OR ("seat" = 'ALTERNATE' AND "alternateRank" IN (1, 2))),
  CONSTRAINT "community_review_council_elections_seat_mapping_check" CHECK (
    ("seatNumber" BETWEEN 1 AND 3 AND "seat" = 'PRIMARY' AND "alternateRank" IS NULL)
    OR
    ("seatNumber" = 4 AND "seat" = 'ALTERNATE' AND "alternateRank" = 1)
    OR
    ("seatNumber" = 5 AND "seat" = 'ALTERNATE' AND "alternateRank" = 2)
  ),
  CONSTRAINT "community_review_council_elections_quorumPercent_check" CHECK ("quorumPercent" >= 50 AND "quorumPercent" <= 100),
  CONSTRAINT "community_review_council_elections_eligibleVoterCount_check" CHECK ("eligibleVoterCount" > 0),
  CONSTRAINT "community_review_council_elections_nomination_window_check" CHECK ("nominationsCloseAt" <= "votingOpensAt"),
  CONSTRAINT "community_review_council_elections_voting_window_check" CHECK ("votingOpensAt" < "votingClosesAt")
);

CREATE TABLE "review_council_eligible_voters" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_council_eligible_voters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_council_eligible_voters_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "community_review_council_elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_council_eligible_voters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "review_council_nominations" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  CONSTRAINT "review_council_nominations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_council_nominations_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "community_review_council_elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_council_nominations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "review_council_nominations_id_electionId_key" ON "review_council_nominations"("id", "electionId");

CREATE TABLE "review_council_ballots" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "voterId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_council_ballots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_council_ballots_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "community_review_council_elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_council_ballots_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_council_ballots_candidateId_electionId_fkey" FOREIGN KEY ("candidateId", "electionId") REFERENCES "review_council_nominations"("id", "electionId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "review_council_members" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "seatNumber" INTEGER NOT NULL,
  "seat" "ReviewCouncilSeat" NOT NULL,
  "alternateRank" INTEGER,
  "status" "ReviewCouncilMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "termStartsAt" TIMESTAMP(3) NOT NULL,
  "termEndsAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "endReason" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "review_council_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_council_members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_council_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "review_council_members_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "community_review_council_elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "review_council_members_seatNumber_check" CHECK ("seatNumber" >= 1 AND "seatNumber" <= 5),
  CONSTRAINT "review_council_members_seat_mapping_check" CHECK (
    ("seatNumber" BETWEEN 1 AND 3 AND "seat" = 'PRIMARY' AND "alternateRank" IS NULL)
    OR
    ("seatNumber" = 4 AND "seat" = 'ALTERNATE' AND "alternateRank" = 1)
    OR
    ("seatNumber" = 5 AND "seat" = 'ALTERNATE' AND "alternateRank" = 2)
  ),
  CONSTRAINT "review_council_members_alternateRank_check" CHECK (("seat" = 'PRIMARY' AND "alternateRank" IS NULL) OR ("seat" = 'ALTERNATE' AND "alternateRank" IN (1, 2))),
  CONSTRAINT "review_council_members_term_check" CHECK ("termEndsAt" > "termStartsAt")
);

CREATE UNIQUE INDEX "review_council_eligible_voters_electionId_userId_key" ON "review_council_eligible_voters"("electionId", "userId");
CREATE INDEX "review_council_eligible_voters_userId_electionId_idx" ON "review_council_eligible_voters"("userId", "electionId");
CREATE UNIQUE INDEX "review_council_nominations_electionId_userId_key" ON "review_council_nominations"("electionId", "userId");
CREATE INDEX "review_council_nominations_electionId_withdrawnAt_idx" ON "review_council_nominations"("electionId", "withdrawnAt");
CREATE UNIQUE INDEX "review_council_ballots_electionId_voterId_key" ON "review_council_ballots"("electionId", "voterId");
CREATE INDEX "review_council_ballots_electionId_candidateId_idx" ON "review_council_ballots"("electionId", "candidateId");
CREATE UNIQUE INDEX "review_council_members_electionId_key" ON "review_council_members"("electionId");
CREATE INDEX "review_council_members_communityId_status_seat_alternateRank_idx" ON "review_council_members"("communityId", "status", "seat", "alternateRank");
CREATE INDEX "review_council_members_communityId_termEndsAt_idx" ON "review_council_members"("communityId", "termEndsAt");
CREATE INDEX "community_review_council_elections_communityId_status_seatNumber_idx" ON "community_review_council_elections"("communityId", "status", "seatNumber");
CREATE INDEX "community_review_council_elections_communityId_createdAt_idx" ON "community_review_council_elections"("communityId", "createdAt");

CREATE UNIQUE INDEX "community_review_council_elections_one_active_seat_key"
  ON "community_review_council_elections"("communityId", "seatNumber")
  WHERE "status" IN ('NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED', 'VOTING_OPEN');

CREATE UNIQUE INDEX "review_council_members_one_active_user_key"
  ON "review_council_members"("communityId", "userId")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "review_council_members_one_active_seat_key"
  ON "review_council_members"("communityId", "seatNumber")
  WHERE "status" = 'ACTIVE';
