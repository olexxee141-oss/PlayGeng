import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import * as voting from "./assembly.voting.service.js";

test("Assembly voting enforces the persisted ballot lifecycle", async () => {
  const suffix = randomUUID();

  const createUser = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `assembly-voting-${label}-${suffix}@playgeng.test`,
        firstName: "Assembly",
        lastName: label,
        passwordHash: "integration-test-hash",
      },
    });
    return user;
  };

  const owner = await createUser("owner");
  const voter = await createUser("voter");
  const concurrentVoter = await createUser("concurrent-voter");
  const outsider = await createUser("outsider");
  const community = await prisma.community.create({
    data: {
      name: `Assembly voting ${suffix.slice(0, 8)}`,
      slug: `assembly-voting-${suffix.slice(0, 8)}`,
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "CREATOR" },
          { userId: voter.id, role: "MEMBER" },
          { userId: concurrentVoter.id, role: "MEMBER" },
          { userId: outsider.id, role: "MEMBER" },
        ],
      },
    },
  });

  const campaign = await prisma.contributionCampaign.create({
    data: {
      communityId: community.id,
      name: "Assembly integration fixture",
      amountMinor: 1000n,
      frequency: "ONE_OFF",
      createdById: owner.id,
    },
  });

  const assessment = await prisma.contributionAssessment.create({
    data: {
      campaignId: campaign.id,
      communityId: community.id,
      periodKey: `test-${suffix.replaceAll("-", "").slice(0, 24)}`,
      description: "Assembly integration fixture",
      amountMinor: 1000n,
      currency: "NGN",
      dueAt: new Date(Date.now() + 7 * 86_400_000),
      status: "DRAFT",
      createdById: owner.id,
    },
  });

  const snapshot = await prisma.contributionAssessmentMember.create({
    data: {
      assessmentId: assessment.id,
      memberId: owner.id,
      memberRole: "CREATOR",
      memberJoinedAt: new Date(),
      memberFirstName: owner.firstName,
      memberLastName: owner.lastName,
      memberEmail: owner.email,
      snapshotAt: new Date(),
    },
  });

  const assemblyCase = await prisma.assemblyCase.create({
    data: {
      communityId: community.id,
      assessmentMemberId: snapshot.id,
      requesterId: owner.id,
      reason: "Integration-test case",
    },
  });

  // The electorate must be populated before its freeze is recorded.
  await prisma.assemblyCaseElectorateMember.createMany({
    data: [
      { caseId: assemblyCase.id, userId: voter.id, eligible: true },
      { caseId: assemblyCase.id, userId: concurrentVoter.id, eligible: true },
      { caseId: assemblyCase.id, userId: outsider.id, eligible: false, exclusionReason: "NOT_ELIGIBLE" },
    ],
  });

  const conflictReviewStartedAt = new Date(Date.now() - 50 * 60 * 60 * 1000);
  const electorateFrozenAt = new Date(conflictReviewStartedAt.getTime() + 60_000);
  const noticePublishedAt = new Date(Date.now() - 49 * 60 * 60 * 1000);
  await prisma.assemblyCase.update({
    where: { id: assemblyCase.id },
    data: {
      conflictReviewStartedAt,
      electorateFrozenAt,
      eligibleVoterCount: 2,
    },
  });
  await prisma.assemblyCase.update({
    where: { id: assemblyCase.id },
    data: {
      status: "NOTICE_PUBLISHED",
      noticePublishedAt,
      noticeOpensAt: noticePublishedAt,
    },
  });

  const votingOpenedAt = new Date();
  const votingClosesAt = new Date(votingOpenedAt.getTime() + 72 * 60 * 60 * 1000);
  await prisma.assemblyCase.update({
    where: { id: assemblyCase.id },
    data: { status: "VOTING_OPEN", votingOpenedAt, votingClosesAt },
  });

  await assert.rejects(
    voting.castAssemblyBallot(community.id, assemblyCase.id, outsider.id, "YES"),
    (error: unknown) => error instanceof AppError && error.statusCode === 403,
    "a non-eligible electorate member must not cast a ballot",
  );

  const ballot = await voting.castAssemblyBallot(community.id, assemblyCase.id, voter.id, "YES");
  assert.equal(ballot.vote, "YES");
  await assert.rejects(
    voting.castAssemblyBallot(community.id, assemblyCase.id, voter.id, "NO"),
    (error: unknown) => error instanceof AppError && error.statusCode === 409,
    "a voter must not replace an immutable ballot",
  );

  await assert.rejects(
    prisma.assemblyCaseBallot.update({ where: { id: ballot.id }, data: { vote: "NO" } }),
    "the database must reject ballot updates",
  );
  await assert.rejects(
    prisma.assemblyCaseBallot.delete({ where: { id: ballot.id } }),
    "the database must reject ballot deletion",
  );

  const concurrentResults = await Promise.allSettled([
    voting.castAssemblyBallot(community.id, assemblyCase.id, concurrentVoter.id, "YES"),
    voting.castAssemblyBallot(community.id, assemblyCase.id, concurrentVoter.id, "NO"),
  ]);
  assert.equal(concurrentResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await prisma.assemblyCaseBallot.count({ where: { caseId: assemblyCase.id, voterId: concurrentVoter.id } }), 1);
  // These fixtures intentionally remain in the disposable CI database: ballot and
  // Assembly audit rows are append-only and must not be deleted to make tests clean.
});
