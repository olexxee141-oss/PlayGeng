CREATE TYPE "ContributionAssessmentGenerationMode" AS ENUM ('AUTOMATIC', 'MANUAL');

ALTER TABLE "communities"
  ADD COLUMN "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC';

ALTER TABLE "contribution_campaigns"
  ADD COLUMN "assessmentGenerationMode" "ContributionAssessmentGenerationMode" NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "contribution_assessments"
  ALTER COLUMN "dueAt" DROP NOT NULL;

ALTER TABLE "contribution_assessments"
  ADD CONSTRAINT "contribution_assessments_issued_due_date_required"
  CHECK ("status" <> 'ISSUED' OR "dueAt" IS NOT NULL);
