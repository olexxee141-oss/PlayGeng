export type ConflictDetermination = "CONFLICT_CONFIRMED" | "NO_CONFLICT";

export const resolveConflictDetermination = (
  eligibleReviewerIds: readonly string[],
  decisions: readonly { reviewerId: string; conflictExists: boolean }[],
): { status: ConflictDetermination | null; votes: number; eligibleReviewers: number } => {
  const eligible = new Set(eligibleReviewerIds);
  const valid = decisions.filter((decision) => eligible.has(decision.reviewerId));
  const conflicts = valid.filter((decision) => decision.conflictExists).length;
  const noConflicts = valid.length - conflicts;
  return {
    status: valid.length >= 2 && conflicts !== noConflicts
      ? conflicts > noConflicts ? "CONFLICT_CONFIRMED" : "NO_CONFLICT"
      : null,
    votes: valid.length,
    eligibleReviewers: eligible.size,
  };
};
