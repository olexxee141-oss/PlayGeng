import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import * as voting from "./assembly.voting.service.js";

test("Assembly voting enforces the persisted ballot lifecycle", async () => {
  const suffix = randomUUID();
  const userIds: string[] = [];
  let communityId: string | undefined;
  let campaignId: string | undefined;
  let assessmentId: string | undefined;
  let assessmentMemberId: string | undefined;
  let caseId: string | undefined;

  const createUser = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `assembly-voting-${label}-${suffix}@playgeng.test`,
        firstName: "Assembly",
        lastName: label,
        passwordHash: "integration-test-hash",
      },
    });
    userIds.push(user.id);
    return user;
  };

  try {
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
    communityId = community.id;

    const campaign = await prisma.contributionCampaign.create({
      data: {
        communityId: community.id,
        name: "Assembly integration fixture",
        amountMinor: 1000n,
        frequency: "ONE_OFF",
        createdById: owner.id,
      },
    });
    campaignId = campaign.id;

    const assessment = await prisma.contributionAssessment.create({
      data: {
        campaignId: campaign.id,
        communityId: community.id,
        periodKey: `test-${suffix.replaceAll("-", "").slice(0, 24)}`,
        description: "Assembly integration fixture",
        amountMinor: 1000n,
        currency: "NGN",
        dueAt: new Date(Date.now() + 7 * 86_400_000),
        status: "ISSUED",
        createdById: owner.id,
        issuedById: owner.id,
        issuedAt: new Date(),
      },
    });
    assessmentId = assessment.id;

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
    assessmentMemberId = snapshot.id;

    const now = Date.now();
    const assemblyCase = await prisma.assemblyCase.create({
      data: {
        communityId: community.id,
        assessmentMemberId: snapshot.id,
        requesterId: owner.id,
        reason: "Integration-test case",
        status: "VOTING_OPEN",
        electorateFrozenAt: new Date(now - 60 * 60 * 1000),
        eligibleVoterCount: 2,
        noticePublishedAt: new Date(now - 49 * 60 * 60 * 1000),
        noticeOpensAt: new Date(now - 49 * 60 * 60 * 1000),
        votingOpenedAt: new Date(now - 60 * 60 * 1000),
        votingClosesAt: new Date(now + 71 * 60 * 60 * 1000),
      },
    });
    caseId = assemblyCase.id;

    await prisma.assemblyCaseElectorateMember.createMany({
      data: [
        { caseId: assemblyCase.id, userId: voter.id, eligible: true },
        { caseId: assemblyCase.id, userId: concurrentVoter.id, eligible: true },
        { caseId: assemblyCase.id, userId: outsider.id, eligible: false, exclusionReason: "NOT_ELIGIBLE" },
      ],
    });

    const beforeOpen = Date.now() + 60_000;
    await prisma.assemblyCase.update({
      where: { id: assemblyCase.id },
      data: {
        votingOpenedAt: new Date(beforeOpen),
        votingClosesAt: new Date(beforeOpen + 72 * 60 * 60 * 1000),
      },
    });
    await assert.rejects(
      voting.castAssemblyBallot(community.id, assemblyCase.id, voter.id, "YES"),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
      "ballots must be rejected before the voting window opens",
    );

    const afterClose = Date.now() - 60 * 60 * 1000;
    await prisma.assemblyCase.update({
      where: { id: assemblyCase.id },
      data: {
        votingOpenedAt: new Date(afterClose - 72 * 60 * 60 * 1000),
        votingClosesAt: new Date(afterClose),
      },
    });
    await assert.rejects(
      voting.castAssemblyBallot(community.id, assemblyCase.id, voter.id, "YES"),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
      "ballots must be rejected after the voting window closes",
    );

    const activeWindowStart = Date.now() - 60 * 60 * 1000;
    await prisma.assemblyCase.update({
      where: { id: assemblyCase.id },
      data: {
        votingOpenedAt: new Date(activeWindowStart),
        votingClosesAt: new Date(activeWindowStart + 72 * 60 * 60 * 1000),
      },
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
  } finally {
    if (caseId) await prisma.assemblyCase.deleteMany({ where: { id: caseId } });
    if (assessmentMemberId) await prisma.contributionAssessmentMember.deleteMany({ where: { id: assessmentMemberId } });
    if (assessmentId) await prisma.contributionAssessment.deleteMany({ where: { id: assessmentId } });
    if (campaignId) await prisma.contributionCampaign.deleteMany({ where: { id: campaignId } });
    if (communityId) await prisma.community.deleteMany({ where: { id: communityId } });
    for (const userId of userIds) await prisma.user.deleteMany({ where: { id: userId } });
  }
});
