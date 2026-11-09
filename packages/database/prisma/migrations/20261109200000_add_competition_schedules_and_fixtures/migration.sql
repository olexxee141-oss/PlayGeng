ALTER TABLE "competition_entries"
  ADD COLUMN "seed" INTEGER,
  ADD CONSTRAINT "competition_entries_seed_check" CHECK ("seed" IS NULL OR "seed" >= 1);

CREATE UNIQUE INDEX "competition_entries_active_seed_key"
  ON "competition_entries"("competitionId", "seed")
  WHERE "seed" IS NOT NULL AND "status" IN ('PENDING', 'APPROVED');

CREATE UNIQUE INDEX "competition_entries_id_competitionId_key"
  ON "competition_entries"("id", "competitionId");

CREATE UNIQUE INDEX "competitions_id_format_key" ON "competitions"("id", "format");

CREATE TYPE "CompetitionFixtureStatus" AS ENUM ('SCHEDULED', 'BYE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "competition_schedules" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "format" "CompetitionFormat" NOT NULL,
  "algorithmVersion" VARCHAR(32) NOT NULL,
  "participantCount" INTEGER NOT NULL,
  "roundCount" INTEGER NOT NULL,
  "fixtureCount" INTEGER NOT NULL,
  "matchCount" INTEGER NOT NULL,
  "byeCount" INTEGER NOT NULL,
  "orderedEntryIds" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competition_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competition_schedules_counts_check" CHECK (
    "participantCount" >= 2 AND
    "roundCount" >= 1 AND
    "fixtureCount" >= 1 AND
    "matchCount" >= 1 AND
    "byeCount" >= 0 AND
    "fixtureCount" = "matchCount" + "byeCount"
  )
);

CREATE TABLE "competition_fixtures" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "fixtureNumber" INTEGER NOT NULL,
  "participantAEntryId" TEXT NOT NULL,
  "participantBEntryId" TEXT,
  "winnerEntryId" TEXT,
  "status" "CompetitionFixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3),
  "venue" VARCHAR(200),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competition_fixtures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competition_fixtures_round_check" CHECK ("roundNumber" >= 1 AND "fixtureNumber" >= 1),
  CONSTRAINT "competition_fixtures_distinct_participants_check" CHECK (
    "participantBEntryId" IS NULL OR "participantAEntryId" <> "participantBEntryId"
  ),
  CONSTRAINT "competition_fixtures_bye_check" CHECK (
    ("status" = 'BYE' AND "participantBEntryId" IS NULL AND "winnerEntryId" = "participantAEntryId")
    OR
    ("status" <> 'BYE' AND "participantBEntryId" IS NOT NULL)
  ),
  CONSTRAINT "competition_fixtures_winner_check" CHECK (
    "winnerEntryId" IS NULL OR "winnerEntryId" IN ("participantAEntryId", "participantBEntryId")
  ),
  CONSTRAINT "competition_fixtures_completed_check" CHECK (
    "status" <> 'COMPLETED' OR "winnerEntryId" IS NOT NULL
  ),
  CONSTRAINT "competition_fixtures_unresolved_winner_check" CHECK (
    "status" IN ('COMPLETED', 'BYE') OR "winnerEntryId" IS NULL
  )
);

CREATE UNIQUE INDEX "competition_schedules_competitionId_key" ON "competition_schedules"("competitionId");
CREATE UNIQUE INDEX "competition_schedules_id_competitionId_key" ON "competition_schedules"("id", "competitionId");
CREATE INDEX "competition_fixtures_competitionId_roundNumber_fixtureNumber_idx"
  ON "competition_fixtures"("competitionId", "roundNumber", "fixtureNumber");
CREATE INDEX "competition_fixtures_competitionId_status_idx"
  ON "competition_fixtures"("competitionId", "status");
CREATE UNIQUE INDEX "competition_fixtures_scheduleId_roundNumber_fixtureNumber_key"
  ON "competition_fixtures"("scheduleId", "roundNumber", "fixtureNumber");

ALTER TABLE "competition_schedules"
  ADD CONSTRAINT "competition_schedules_competitionId_format_fkey"
  FOREIGN KEY ("competitionId", "format") REFERENCES "competitions"("id", "format") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competition_schedules"
  ADD CONSTRAINT "competition_schedules_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competition_fixtures"
  ADD CONSTRAINT "competition_fixtures_scheduleId_competitionId_fkey"
  FOREIGN KEY ("scheduleId", "competitionId") REFERENCES "competition_schedules"("id", "competitionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competition_fixtures"
  ADD CONSTRAINT "competition_fixtures_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competition_fixtures"
  ADD CONSTRAINT "competition_fixtures_participantAEntryId_competitionId_fkey"
  FOREIGN KEY ("participantAEntryId", "competitionId") REFERENCES "competition_entries"("id", "competitionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competition_fixtures"
  ADD CONSTRAINT "competition_fixtures_participantBEntryId_competitionId_fkey"
  FOREIGN KEY ("participantBEntryId", "competitionId") REFERENCES "competition_entries"("id", "competitionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competition_fixtures"
  ADD CONSTRAINT "competition_fixtures_winnerEntryId_competitionId_fkey"
  FOREIGN KEY ("winnerEntryId", "competitionId") REFERENCES "competition_entries"("id", "competitionId") ON DELETE RESTRICT ON UPDATE CASCADE;
