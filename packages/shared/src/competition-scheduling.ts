export type SchedulingParticipant = {
  readonly entryId: string;
  readonly registeredAt: Date | string | number;
  readonly seed?: number | null;
};

export type ScheduledPairing = {
  readonly roundNumber: number;
  readonly fixtureNumber: number;
  readonly participantAEntryId: string;
  readonly participantBEntryId: string | null;
  readonly isBye: boolean;
  readonly byeEntryId: string | null;
};

export type RoundRobinSchedule = {
  readonly format: "ROUND_ROBIN";
  readonly algorithmVersion: "1";
  readonly participantCount: number;
  readonly roundCount: number;
  readonly matchCount: number;
  readonly byeCount: number;
  readonly orderedEntryIds: readonly string[];
  readonly fixtures: readonly ScheduledPairing[];
};

export type KnockoutSchedule = {
  readonly format: "KNOCKOUT";
  readonly algorithmVersion: "1";
  readonly participantCount: number;
  readonly bracketSize: number;
  readonly roundCount: number;
  readonly firstRoundMatchCount: number;
  readonly byeCount: number;
  readonly orderedEntryIds: readonly string[];
  readonly fixtures: readonly ScheduledPairing[];
};

export type CompetitionSchedule = RoundRobinSchedule | KnockoutSchedule;

export type SchedulingErrorCode =
  | "INSUFFICIENT_PARTICIPANTS"
  | "DUPLICATE_ENTRY"
  | "INVALID_SEED"
  | "DUPLICATE_SEED"
  | "INVALID_REGISTRATION_TIME";

export class SchedulingError extends Error {
  constructor(readonly code: SchedulingErrorCode, message: string) {
    super(message);
    this.name = "SchedulingError";
  }
}

type NormalizedParticipant = {
  entryId: string;
  registeredAt: number;
  seed: number | null;
};

function normalizeParticipants(participants: readonly SchedulingParticipant[]): NormalizedParticipant[] {
  if (participants.length < 2) {
    throw new SchedulingError("INSUFFICIENT_PARTICIPANTS", "At least two approved participants are required.");
  }

  const entryIds = new Set<string>();
  const seeds = new Set<number>();
  const normalized = participants.map((participant) => {
    const entryId = participant.entryId.trim();
    if (!entryId || entryIds.has(entryId)) {
      throw new SchedulingError("DUPLICATE_ENTRY", "Participant entry IDs must be non-empty and unique.");
    }
    entryIds.add(entryId);

    const registeredAt = participant.registeredAt instanceof Date
      ? participant.registeredAt.getTime()
      : typeof participant.registeredAt === "number"
        ? participant.registeredAt
        : new Date(participant.registeredAt).getTime();
    if (!Number.isFinite(registeredAt)) {
      throw new SchedulingError("INVALID_REGISTRATION_TIME", `Participant ${entryId} has an invalid registration timestamp.`);
    }

    const seed = participant.seed ?? null;
    if (seed !== null) {
      if (!Number.isSafeInteger(seed) || seed < 1) {
        throw new SchedulingError("INVALID_SEED", `Participant ${entryId} has an invalid seed.`);
      }
      if (seeds.has(seed)) {
        throw new SchedulingError("DUPLICATE_SEED", `Seed ${seed} is assigned more than once.`);
      }
      seeds.add(seed);
    }

    return { entryId, registeredAt, seed };
  });

  return normalized.sort((a, b) => {
    if (a.seed !== null && b.seed !== null && a.seed !== b.seed) return a.seed - b.seed;
    if (a.seed !== null && b.seed === null) return -1;
    if (a.seed === null && b.seed !== null) return 1;
    if (a.registeredAt !== b.registeredAt) return a.registeredAt - b.registeredAt;
    return a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0;
  });
}

/**
 * Produces a complete single round-robin using the circle method.
 * Participant A/B are neutral slots, not home/away designations.
 * Odd-sized competitions receive one explicit bye per participant.
 */
export function generateRoundRobinSchedule(
  participants: readonly SchedulingParticipant[],
): RoundRobinSchedule {
  const ordered = normalizeParticipants(participants);
  const slots: Array<NormalizedParticipant | null> = [...ordered];
  if (slots.length % 2 !== 0) slots.push(null);

  const roundCount = slots.length - 1;
  const pairingsPerRound = slots.length / 2;
  const fixtures: ScheduledPairing[] = [];
  let matchCount = 0;
  let byeCount = 0;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < pairingsPerRound; pairIndex += 1) {
      let first = slots[pairIndex];
      let second = slots[slots.length - 1 - pairIndex];
      if (!first && !second) continue;

      if (first && second && (roundIndex + pairIndex) % 2 === 1) {
        [first, second] = [second, first];
      }

      const isBye = !first || !second;
      const participantA = first ?? second;
      if (!participantA) continue;
      const participantB = isBye ? null : second!.entryId;
      if (isBye) byeCount += 1;
      else matchCount += 1;

      fixtures.push({
        roundNumber: roundIndex + 1,
        fixtureNumber: pairIndex + 1,
        participantAEntryId: participantA.entryId,
        participantBEntryId: participantB,
        isBye,
        byeEntryId: isBye ? participantA.entryId : null,
      });
    }

    const rotating = slots.pop();
    if (rotating !== undefined) slots.splice(1, 0, rotating);
  }

  return {
    format: "ROUND_ROBIN",
    algorithmVersion: "1",
    participantCount: ordered.length,
    roundCount,
    matchCount,
    byeCount,
    orderedEntryIds: ordered.map(({ entryId }) => entryId),
    fixtures,
  };
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function getSeedPositions(bracketSize: number): number[] {
  let positions = [1, 2];
  while (positions.length < bracketSize) {
    const nextSize = positions.length * 2;
    positions = positions.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }
  return positions;
}

/**
 * Creates the first knockout round only. Higher seeds receive byes first.
 * Later rounds must be generated after the preceding round's results are approved.
 */
export function generateKnockoutSchedule(
  participants: readonly SchedulingParticipant[],
): KnockoutSchedule {
  const ordered = normalizeParticipants(participants);
  const bracketSize = nextPowerOfTwo(ordered.length);
  const seedPositions = getSeedPositions(bracketSize);
  const slots: Array<NormalizedParticipant | null> = Array.from({ length: bracketSize }, () => null);

  ordered.forEach((participant, index) => {
    const seedRank = index + 1;
    const slotIndex = seedPositions.indexOf(seedRank);
    if (slotIndex < 0) {
      throw new SchedulingError("INVALID_SEED", "Unable to place participant in the knockout bracket.");
    }
    slots[slotIndex] = participant;
  });

  const fixtures: ScheduledPairing[] = [];
  let firstRoundMatchCount = 0;
  let byeCount = 0;
  for (let index = 0; index < bracketSize; index += 2) {
    const first = slots[index];
    const second = slots[index + 1];
    if (!first && !second) {
      throw new SchedulingError("INVALID_SEED", "Knockout seeding produced an empty fixture.");
    }
    const participantA = first ?? second;
    if (!participantA) continue;
    const isBye = !first || !second;
    if (isBye) byeCount += 1;
    else firstRoundMatchCount += 1;

    fixtures.push({
      roundNumber: 1,
      fixtureNumber: index / 2 + 1,
      participantAEntryId: participantA.entryId,
      participantBEntryId: isBye ? null : second!.entryId,
      isBye,
      byeEntryId: isBye ? participantA.entryId : null,
    });
  }

  return {
    format: "KNOCKOUT",
    algorithmVersion: "1",
    participantCount: ordered.length,
    bracketSize,
    roundCount: Math.log2(bracketSize),
    firstRoundMatchCount,
    byeCount,
    orderedEntryIds: ordered.map(({ entryId }) => entryId),
    fixtures,
  };
}

export function generateCompetitionSchedule(
  format: "ROUND_ROBIN" | "KNOCKOUT",
  participants: readonly SchedulingParticipant[],
): CompetitionSchedule {
  return format === "ROUND_ROBIN"
    ? generateRoundRobinSchedule(participants)
    : generateKnockoutSchedule(participants);
}
