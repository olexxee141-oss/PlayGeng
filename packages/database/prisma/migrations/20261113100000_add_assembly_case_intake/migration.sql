CREATE TYPE "AssemblyCaseStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN');
CREATE TYPE "AssemblyCaseEventType" AS ENUM ('SUBMITTED', 'WITHDRAWN');

CREATE TABLE "assembly_cases" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "assessmentMemberId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "status" "AssemblyCaseStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assembly_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_cases_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assembly_cases_assessmentMemberId_fkey" FOREIGN KEY ("assessmentMemberId") REFERENCES "contribution_assessment_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_cases_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "assembly_case_events" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "AssemblyCaseEventType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assembly_case_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_case_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "assembly_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_case_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "assembly_cases_assessmentMemberId_key" ON "assembly_cases"("assessmentMemberId");
CREATE INDEX "assembly_cases_communityId_status_submittedAt_idx" ON "assembly_cases"("communityId", "status", "submittedAt");
CREATE INDEX "assembly_cases_requesterId_status_submittedAt_idx" ON "assembly_cases"("requesterId", "status", "submittedAt");
CREATE INDEX "assembly_case_events_caseId_createdAt_idx" ON "assembly_case_events"("caseId", "createdAt");
CREATE INDEX "assembly_case_events_actorId_createdAt_idx" ON "assembly_case_events"("actorId", "createdAt");
