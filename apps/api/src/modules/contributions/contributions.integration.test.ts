import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import * as communityDb from "../communities/communities.db.js";
import { createAssessment, createCampaign, getAssessmentReport, issueAssessment, listMyContributionHistory } from "./contributions.service.js";
import { getTreasury, initializeTreasury } from "../treasury/treasury.service.js";

const setup = async (suffix: string) => {
  const labels = ["creator", "admin", "treasurer", "member"];
  const users = await Promise.all(labels.map((label) => prisma.user.create({
    data: {
      email: `contribution-${label}-${suffix}@playgeng.test`,
      firstName: "Contribution",
      lastName: label,
      passwordHash: "integration-test-hash",
    },
  })));
  const [creator, admin, treasurer, member] = users;
  if (!creator || !admin || !treasurer || !member) throw new Error("Integration fixture users were not created.");
  const community = await prisma.community.create({
    data: {
      name: `Contribution ${suffix.slice(0, 8)}`,
      slug: `contribution-${suffix.slice(0, 8)}`,
      ownerId: creator.id,
      members: {
        create: [
          { userId: creator.id, role: "CREATOR" },
          { userId: admin.id, role: "ADMIN" },
          { userId: treasurer.id, role: "TREASURER" },
          { userId: member.id, role: "MEMBER" },
        ],
      },
      sports: { create: { sport: "FOOTBALL", isPrimary: true } },
    },
  });
  await initializeTreasury(community.id, treasurer.id, { currency: "NGN" });
  const campaign = await createCampaign(community.id, admin.id, {
    name: "Community contribution",
    amountMinor: "250000",
    frequency: "MONTHLY",
    assessmentGenerationMode: "MANUAL",
  });
  return { creator, admin, treasurer, member, community, campaign };
};

const createDraft = (communityId: string, adminId: string, campaignId: string, periodKey: string) =>
  createAssessment(communityId, adminId, campaignId, {
    periodKey,
    description: "Monthly community contribution",
    dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });

test("contribution issuance snapshots active members, posts balanced receivables, and is idempotent", async () => {
  const suffix = randomUUID();
  try {
    const fixture = await setup(suffix);
    const assessment = await createDraft(fixture.community.id, fixture.admin.id, fixture.campaign.id, "2026-11");

    await assert.rejects(
      issueAssessment(fixture.community.id, fixture.admin.id, assessment.id),
      (error: unknown) => error instanceof Error && "statusCode" in error && error.statusCode === 403,
    );
    await assert.rejects(
      issueAssessment(fixture.community.id, fixture.creator.id, assessment.id),
      (error: unknown) => error instanceof Error && "statusCode" in error && error.statusCode === 403,
    );

    const [issued, retried] = await Promise.all([
      issueAssessment(fixture.community.id, fixture.treasurer.id, assessment.id),
      issueAssessment(fixture.community.id, fixture.treasurer.id, assessment.id),
    ]);
    assert.equal(issued.id, assessment.id);
    assert.equal(retried.id, assessment.id);
    assert.equal(issued.status, "ISSUED");

    const snapshots = await prisma.contributionAssessmentMember.findMany({
      where: { assessmentId: assessment.id },
      include: { obligation: true },
      orderBy: { memberId: "asc" },
    });
    assert.equal(snapshots.length, 4);
    assert.ok(snapshots.every((snapshot) => snapshot.obligationId && snapshot.obligation));
    assert.ok(snapshots.every((snapshot) => snapshot.obligation?.memberId === snapshot.memberId));
    assert.ok(snapshots.every((snapshot) => snapshot.obligation?.amountMinor === 250000n));
    assert.ok(snapshots.every((snapshot) => snapshot.obligation?.dueAt?.toISOString() === new Date(assessment.dueAt!).toISOString()));

    const obligations = await prisma.obligation.findMany({
      where: { sourceType: "CONTRIBUTION", sourceId: { in: snapshots.map((snapshot) => snapshot.id) } },
    });
    assert.equal(obligations.length, snapshots.length);

    const summary = await getTreasury(fixture.community.id, fixture.admin.id);
    assert.equal(summary.balances.find((account) => account.code === "CASH")?.balanceMinor, "0");
    assert.equal(summary.balances.find((account) => account.code === "RECEIVABLES")?.balanceMinor, "1000000");
    assert.equal(summary.balances.find((account) => account.code === "CONTRIBUTION_INCOME")?.balanceMinor, "1000000");

    const lateJoiner = await prisma.user.create({
      data: { email: `contribution-late-${suffix}@playgeng.test`, firstName: "Late", lastName: "Joiner", passwordHash: "integration-test-hash" },
    });
    const addResult = await communityDb.addMember(fixture.community.id, fixture.creator.id, lateJoiner.id, "MEMBER");
    assert.equal(addResult.kind, "ADDED");
    assert.equal(await prisma.contributionAssessmentMember.count({ where: { assessmentId: assessment.id, memberId: lateJoiner.id } }), 0);

    const removeResult = await communityDb.removeMember(fixture.community.id, fixture.creator.id, fixture.member.id);
    assert.equal(removeResult.kind, "REMOVED");
    const history = await listMyContributionHistory(fixture.community.id, fixture.member.id);
    assert.equal(history.items.length, 1);
    assert.equal(history.items[0]?.financialStatus, "UNPAID");

    const report = await getAssessmentReport(fixture.community.id, fixture.admin.id, assessment.id);
    assert.equal(report.totals.complete, true);
    assert.equal(report.counts.unpaid, snapshots.length);
  } finally {
    await prisma.$disconnect();
  }
});

test("a Treasury posting failure rolls back snapshots and leaves the assessment draft", async () => {
  const suffix = randomUUID();
  try {
    const fixture = await setup(suffix);
    const assessment = await createDraft(fixture.community.id, fixture.admin.id, fixture.campaign.id, "2026-12");
    const treasury = await prisma.treasury.findUniqueOrThrow({ where: { communityId: fixture.community.id } });
    await prisma.treasuryAccount.updateMany({
      where: { treasuryId: treasury.id, code: "CONTRIBUTION_INCOME" },
      data: { isActive: false },
    });

    await assert.rejects(issueAssessment(fixture.community.id, fixture.treasurer.id, assessment.id));
    const current = await prisma.contributionAssessment.findUniqueOrThrow({ where: { id: assessment.id } });
    assert.equal(current.status, "DRAFT");
    assert.equal(await prisma.contributionAssessmentMember.count({ where: { assessmentId: assessment.id } }), 0);
    assert.equal(await prisma.obligation.count({ where: { treasuryId: treasury.id } }), 0);
    assert.equal(await prisma.journalTransaction.count({ where: { treasuryId: treasury.id } }), 0);
  } finally {
    await prisma.$disconnect();
  }
});

test("a membership join racing issuance is either fully included or excluded", async () => {
  const suffix = randomUUID();
  try {
    const fixture = await setup(suffix);
    const assessment = await createDraft(fixture.community.id, fixture.admin.id, fixture.campaign.id, "2027-01");
    const joiner = await prisma.user.create({
      data: { email: `contribution-race-join-${suffix}@playgeng.test`, firstName: "Race", lastName: "Join", passwordHash: "integration-test-hash" },
    });

    await Promise.all([
      issueAssessment(fixture.community.id, fixture.treasurer.id, assessment.id),
      communityDb.addMember(fixture.community.id, fixture.creator.id, joiner.id, "MEMBER"),
    ]);

    const snapshot = await prisma.contributionAssessmentMember.findUnique({
      where: { assessmentId_memberId: { assessmentId: assessment.id, memberId: joiner.id } },
      include: { obligation: true },
    });
    const obligationCount = await prisma.obligation.count({ where: { memberId: joiner.id, sourceType: "CONTRIBUTION" } });
    assert.equal(obligationCount, snapshot ? 1 : 0);
    if (snapshot) assert.ok(snapshot.obligation);
  } finally {
    await prisma.$disconnect();
  }
});

test("a membership removal racing issuance preserves the obligation only if the member was snapshotted", async () => {
  const suffix = randomUUID();
  try {
    const fixture = await setup(suffix);
    const assessment = await createDraft(fixture.community.id, fixture.admin.id, fixture.campaign.id, "2027-02");

    await Promise.all([
      issueAssessment(fixture.community.id, fixture.treasurer.id, assessment.id),
      communityDb.removeMember(fixture.community.id, fixture.creator.id, fixture.member.id),
    ]);

    const snapshot = await prisma.contributionAssessmentMember.findUnique({
      where: { assessmentId_memberId: { assessmentId: assessment.id, memberId: fixture.member.id } },
      include: { obligation: true },
    });
    const obligationCount = await prisma.obligation.count({ where: { memberId: fixture.member.id, sourceType: "CONTRIBUTION" } });
    assert.equal(obligationCount, snapshot ? 1 : 0);
    if (snapshot) assert.ok(snapshot.obligation);
  } finally {
    await prisma.$disconnect();
  }
});
