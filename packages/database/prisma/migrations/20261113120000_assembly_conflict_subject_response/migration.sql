ALTER TABLE "assembly_conflict_declarations"
  ADD COLUMN "subjectResponse" VARCHAR(2000),
  ADD COLUMN "respondedAt" TIMESTAMP(3);

CREATE OR REPLACE FUNCTION "guard_assembly_conflict_declaration"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Assembly conflict declarations are retained for audit';
  END IF;
  IF NEW."caseId" IS DISTINCT FROM OLD."caseId"
    OR NEW."declarantId" IS DISTINCT FROM OLD."declarantId"
    OR NEW."subjectUserId" IS DISTINCT FROM OLD."subjectUserId"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Assembly conflict declaration content is immutable';
  END IF;
  IF NEW."subjectResponse" IS DISTINCT FROM OLD."subjectResponse" THEN
    IF OLD."subjectResponse" IS NOT NULL OR OLD."status" <> 'OPEN'
      OR NEW."respondedAt" IS NULL THEN
      RAISE EXCEPTION 'A conflict subject may submit one response before independent review';
    END IF;
  ELSIF NEW."respondedAt" IS DISTINCT FROM OLD."respondedAt" THEN
    RAISE EXCEPTION 'Conflict response timestamp is immutable';
  END IF;
  IF OLD."status" = 'OPEN' AND NEW."status" = 'OPEN' THEN
    IF NEW."withdrawnAt" IS DISTINCT FROM OLD."withdrawnAt"
      OR NEW."determinedAt" IS DISTINCT FROM OLD."determinedAt" THEN
      RAISE EXCEPTION 'Only the subject response may change while a declaration is open';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."status" <> 'OPEN' OR NEW."status" NOT IN ('WITHDRAWN','CONFLICT_CONFIRMED','NO_CONFLICT') THEN
    RAISE EXCEPTION 'Invalid Assembly conflict declaration transition';
  END IF;
  IF NEW."status" = 'WITHDRAWN' AND (NEW."withdrawnAt" IS NULL OR NEW."determinedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Withdrawal must be timestamped and cannot be a determination';
  END IF;
  IF NEW."status" IN ('CONFLICT_CONFIRMED','NO_CONFLICT') AND (NEW."determinedAt" IS NULL OR NEW."withdrawnAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Conflict determination must be timestamped';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
