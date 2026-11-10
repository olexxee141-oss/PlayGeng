CREATE TYPE "ElectionRole" AS ENUM ('ADMIN', 'TREASURER', 'ORGANIZER');
CREATE TYPE "ElectionStatus" AS ENUM ('NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED', 'VOTING_OPEN', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "community_elections" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "role" "ElectionRole" NOT NULL,
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
  CONSTRAINT "community_elections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_elections_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "community_elections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "community_elections_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "community_elections_quorumPercent_check" CHECK ("quorumPercent" >= 50 AND "quorumPercent" <= 100),
  CONSTRAINT "community_elections_eligibleVoterCount_check" CHECK ("eligibleVoterCount" > 0),
  CONSTRAINT "community_elections_nomination_window_check" CHECK ("nominationsCloseAt" <= "votingOpensAt"),
  CONSTRAINT "community_elections_voting_window_check" CHECK ("votingOpensAt" < "votingClosesAt")
);

CREATE TABLE "election_eligible_voters" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "election_eligible_voters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "election_eligible_voters_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "community_elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "election_eligible_voters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "election_nominations" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  CONSTRAINT "election_nominations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "election_nominations_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "community_elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "election_nominations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "election_ballots" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "voterId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "election_ballots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "election_ballots_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "community_elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "election_ballots_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "election_ballots_candidateId_electionId_fkey" FOREIGN KEY ("candidateId", "electionId") REFERENCES "election_nominations"("id", "electionId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "election_eligible_voters_electionId_userId_key" ON "election_eligible_voters"("electionId", "userId");
CREATE INDEX "election_eligible_voters_userId_electionId_idx" ON "election_eligible_voters"("userId", "electionId");
CREATE UNIQUE INDEX "election_nominations_electionId_userId_key" ON "election_nominations"("electionId", "userId");
CREATE UNIQUE INDEX "election_nominations_id_electionId_key" ON "election_nominations"("id", "electionId");
CREATE INDEX "election_nominations_electionId_withdrawnAt_idx" ON "election_nominations"("electionId", "withdrawnAt");
CREATE UNIQUE INDEX "election_ballots_electionId_voterId_key" ON "election_ballots"("electionId", "voterId");
CREATE INDEX "election_ballots_electionId_candidateId_idx" ON "election_ballots"("electionId", "candidateId");
CREATE INDEX "community_elections_communityId_status_role_idx" ON "community_elections"("communityId", "status", "role");
CREATE INDEX "community_elections_communityId_createdAt_idx" ON "community_elections"("communityId", "createdAt");
CREATE UNIQUE INDEX "community_elections_one_active_role_key"
  ON "community_elections"("communityId", "role")
  WHERE "status" IN ('NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED', 'VOTING_OPEN');
