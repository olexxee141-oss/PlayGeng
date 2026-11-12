import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { castBallot, createElection, getElection, nominateSelf } from "./governance.service.js";

const waitUntil = async (target: Date) => {
  const delay = target.getTime() - Date.now() + 30;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
};

test("creator has one ordinary vote and a successful election assigns the elected office", async () => {
  const suffix = randomUUID();
  const userIds: string[] = [];
  let communityId: string | undefined;

  const createUser = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `governance-${label}-${suffix}@playgeng.test`,
        firstName: "Governance",
        lastName: label,
        passwordHash: "integration-test-hash",
      },
    });
    userIds.push(user.id);
    return user;
  };

  try {
    const creator = await createUser("creator");
    const candidate = await createUser("candidate");
    const voter = await createUser("voter");
    const spectator = await createUser("spectator");
    const community = await prisma.community.create({
      data: {
        name: `Governance ${suffix.slice(0, 8)}`,
        slug: `governance-${suffix.slice(0, 8)}`,
        ownerId: creator.id,
        members: {
          create: [
            { userId: creator.id, role: "CREATOR" },
            { userId: candidate.id, role: "MEMBER" },
            { userId: voter.id, role: "MEMBER" },
            { userId: spectator.id, role: "MEMBER" },
          ],
        },
        sports: { create: { sport: "FOOTBALL", isPrimary: true } },
      },
    });
    communityId = community.id;

    const nominationsCloseAt = new Date(Date.now() + 1_000);
    const votingClosesAt = new Date(nominationsCloseAt.getTime() + 1_500);
    const election = await createElection(community.id, creator.id, {
      role: "ADMIN",
      nominationsCloseAt,
      votingOpensAt: nominationsCloseAt,
      votingClosesAt,
      quorumPercent: 50,
    });

    await nominateSelf(community.id, election.id, candidate.id);
    await waitUntil(nominationsCloseAt);

    const creatorBallot = await castBallot(community.id, election.id, creator.id, { candidateId: (await prisma.electionNomination.findUniqueOrThrow({ where: { electionId_userId: { electionId: election.id, userId: candidate.id } } })).id });
    assert.equal(creatorBallot.electionId, election.id);
    await castBallot(community.id, election.id, voter.id, {
      candidateId: (await prisma.electionNomination.findUniqueOrThrow({ where: { electionId_userId: { electionId: election.id, userId: candidate.id } } })).id,
    });

    await assert.rejects(
      castBallot(community.id, election.id, creator.id, {
        candidateId: (await prisma.electionNomination.findUniqueOrThrow({ where: { electionId_userId: { electionId: election.id, userId: candidate.id } } })).id,
      }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    await waitUntil(votingClosesAt);
    const result = await getElection(community.id, election.id, creator.id);
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.eligibleVoterCount, 4);
    assert.equal(result.votesCast, 2);
    assert.equal(result.winnerId, candidate.id);
    assert.equal(result.nominations[0]?.votes, 2);

    const assigned = await prisma.communityMember.findUniqueOrThrow({
      where: { communityId_userId: { communityId: community.id, userId: candidate.id } },
    });
    assert.equal(assigned.role, "ADMIN");

    const creatorMembership = await prisma.communityMember.findUniqueOrThrow({
      where: { communityId_userId: { communityId: community.id, userId: creator.id } },
    });
    assert.equal(creatorMembership.role, "CREATOR");
    assert.equal(await prisma.electionBallot.count({ where: { electionId: election.id } }), 2);
  } finally {
    if (communityId) await prisma.community.deleteMany({ where: { id: communityId } });
    for (const userId of userIds) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
