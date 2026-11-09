import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { createCompetition, generateSchedule, getSchedule, registerEntry, reviewEntry, setEntrySeed, transitionCompetition, withdrawEntry } from "./competitions.service.js";

test("competition registration enforces tenant boundaries, re-registration, and concurrent capacity", async () => {
  const suffix = randomUUID();
  const users: string[] = [];
  const communities: string[] = [];

  const createCommunity = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `competition-${label}-${suffix}@playgeng.test`,
        firstName: "Competition",
        lastName: label,
        passwordHash: "integration-test-hash",
      },
    });
    users.push(user.id);
    const community = await prisma.community.create({
      data: {
        name: `Competition ${label} ${suffix.slice(0, 8)}`,
        slug: `competition-${label}-${suffix.slice(0, 8)}`,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
        sports: { create: { sport: "FOOTBALL", isPrimary: true } },
      },
    });
    communities.push(community.id);
    const sport = await prisma.communitySport.findUniqueOrThrow({
      where: { communityId_sport: { communityId: community.id, sport: "FOOTBALL" } },
    });
    return { user, community, sport };
  };

  try {
    const first = await createCommunity("one");
    const second = await createCommunity("two");

    const createTeam = (communityId: string, communitySportId: string, createdById: string, name: string) =>
      prisma.team.create({ data: { communityId, communitySportId, createdById, name } });

    const teams = await Promise.all([
      createTeam(first.community.id, first.sport.id, first.user.id, "Alpha"),
      createTeam(first.community.id, first.sport.id, first.user.id, "Bravo"),
      createTeam(first.community.id, first.sport.id, first.user.id, "Charlie"),
      createTeam(first.community.id, first.sport.id, first.user.id, "Delta"),
    ]);
    const foreignTeam = await createTeam(second.community.id, second.sport.id, second.user.id, "Foreign");

    const approvalCompetition = await createCompetition(first.community.id, first.user.id, {
      name: "Approval Cup",
      sport: "FOOTBALL",
      format: "KNOCKOUT",
      participantType: "TEAM",
      registrationMode: "APPROVAL_REQUIRED",
      maxEntries: 4,
    });
    await transitionCompetition(first.community.id, approvalCompetition.id, first.user.id, "REGISTRATION_OPEN");
    const pendingEntry = await registerEntry(first.community.id, approvalCompetition.id, first.user.id, { teamId: teams[3]!.id });
    const secondPendingEntry = await registerEntry(first.community.id, approvalCompetition.id, first.user.id, { teamId: teams[2]!.id });
    assert.equal(pendingEntry.status, "PENDING");
    assert.equal(secondPendingEntry.status, "PENDING");
    await transitionCompetition(first.community.id, approvalCompetition.id, first.user.id, "REGISTRATION_CLOSED");
    await assert.rejects(
      generateSchedule(first.community.id, approvalCompetition.id, first.user.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    const approvedEntry = await reviewEntry(first.community.id, approvalCompetition.id, pendingEntry.id, first.user.id, { decision: "APPROVED" });
    const secondApprovedEntry = await reviewEntry(first.community.id, approvalCompetition.id, secondPendingEntry.id, first.user.id, { decision: "APPROVED" });
    assert.equal(approvedEntry.status, "APPROVED");
    assert.equal(secondApprovedEntry.status, "APPROVED");
    const approvedKnockoutSchedule = await generateSchedule(first.community.id, approvalCompetition.id, first.user.id);
    assert.equal(approvedKnockoutSchedule.format, "KNOCKOUT");
    assert.equal(approvedKnockoutSchedule.matchCount, 1);
    assert.equal(approvedKnockoutSchedule.byeCount, 0);

    const player = await prisma.user.create({
      data: {
        email: `competition-player-${suffix}@playgeng.test`,
        firstName: "Individual",
        lastName: "Player",
        passwordHash: "integration-test-hash",
      },
    });
    users.push(player.id);
    await prisma.communityMember.create({ data: { communityId: first.community.id, userId: player.id, role: "MEMBER" } });
    await prisma.communitySport.create({ data: { communityId: first.community.id, sport: "TENNIS" } });
    const individualCompetition = await createCompetition(first.community.id, first.user.id, {
      name: "Singles Cup",
      sport: "TENNIS",
      format: "ROUND_ROBIN",
      participantType: "PLAYER",
      registrationMode: "OPEN",
      maxEntries: 8,
    });
    await transitionCompetition(first.community.id, individualCompetition.id, first.user.id, "REGISTRATION_OPEN");
    const playerEntry = await registerEntry(first.community.id, individualCompetition.id, player.id, {});
    assert.equal(playerEntry.playerUserId, player.id);
    assert.equal(playerEntry.participantNameSnapshot, "Individual Player");
    await prisma.communityMember.delete({ where: { communityId_userId: { communityId: first.community.id, userId: player.id } } });
    assert.ok(await prisma.competitionEntry.findUnique({ where: { id: playerEntry.id } }));

    const competition = await createCompetition(first.community.id, first.user.id, {
      name: "Capacity Cup",
      sport: "FOOTBALL",
      format: "ROUND_ROBIN",
      participantType: "TEAM",
      registrationMode: "OPEN",
      maxEntries: 3,
    });
    await transitionCompetition(first.community.id, competition.id, first.user.id, "REGISTRATION_OPEN");

    const firstEntry = await registerEntry(first.community.id, competition.id, first.user.id, { teamId: teams[0]!.id });
    await withdrawEntry(first.community.id, competition.id, firstEntry.id, first.user.id);
    const reRegistered = await registerEntry(first.community.id, competition.id, first.user.id, { teamId: teams[0]!.id });
    assert.equal(reRegistered.status, "APPROVED");

    await assert.rejects(
      registerEntry(first.community.id, competition.id, first.user.id, { teamId: foreignTeam.id }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    const results = await Promise.allSettled(
      teams.slice(1).map((team) =>
        registerEntry(first.community.id, competition.id, first.user.id, { teamId: team!.id }),
      ),
    );
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    assert.equal(
      await prisma.competitionEntry.count({
        where: { competitionId: competition.id, status: { in: ["PENDING", "APPROVED"] } },
      }),
      3,
    );

    await assert.rejects(
      prisma.competitionEntry.create({
        data: {
          competitionId: competition.id,
          communityId: first.community.id,
          participantType: "TEAM",
          teamId: foreignTeam.id,
          participantNameSnapshot: foreignTeam.name,
          status: "PENDING",
        },
      }),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2003",
    );

    await transitionCompetition(first.community.id, competition.id, first.user.id, "REGISTRATION_CLOSED");
    const approvedEntries = await prisma.competitionEntry.findMany({
      where: { competitionId: competition.id, status: "APPROVED" },
      orderBy: [{ registeredAt: "asc" }, { id: "asc" }],
    });
    await setEntrySeed(first.community.id, competition.id, approvedEntries[0]!.id, first.user.id, 1);
    await assert.rejects(
      setEntrySeed(first.community.id, competition.id, approvedEntries[1]!.id, first.user.id, 1),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    await setEntrySeed(first.community.id, competition.id, approvedEntries[1]!.id, first.user.id, 2);
    await setEntrySeed(first.community.id, competition.id, approvedEntries[2]!.id, first.user.id, 3);

    const [schedule, repeatedSchedule] = await Promise.all([
      generateSchedule(first.community.id, competition.id, first.user.id),
      generateSchedule(first.community.id, competition.id, first.user.id),
    ]);
    assert.equal(schedule.format, "ROUND_ROBIN");
    assert.equal(schedule.participantCount, 3);
    assert.equal(schedule.roundCount, 3);
    assert.equal(schedule.matchCount, 3);
    assert.equal(schedule.byeCount, 3);
    assert.equal(schedule.fixtures.length, 6);
    assert.equal(schedule.fixtures.filter((fixture) => fixture.status === "BYE").length, 3);
    assert.ok(schedule.fixtures.filter((fixture) => fixture.status === "BYE").every((fixture) => fixture.winnerEntryId === fixture.participantAEntryId));

    assert.equal(repeatedSchedule.id, schedule.id);
    assert.equal((await getSchedule(first.community.id, competition.id, first.user.id)).id, schedule.id);
    assert.equal((await prisma.competition.findUniqueOrThrow({ where: { id: competition.id } })).status, "IN_PROGRESS");
    await assert.rejects(
      registerEntry(first.community.id, competition.id, first.user.id, { teamId: teams[0]!.id }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    await assert.rejects(
      setEntrySeed(first.community.id, competition.id, approvedEntries[0]!.id, first.user.id, 4),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    const foreignCompetition = await prisma.competition.create({
      data: {
        communityId: second.community.id,
        communitySportId: second.sport.id,
        createdById: second.user.id,
        name: "Foreign Fixture Competition",
        format: "ROUND_ROBIN",
        participantType: "TEAM",
      },
    });
    const foreignEntry = await prisma.competitionEntry.create({
      data: {
        competitionId: foreignCompetition.id,
        communityId: second.community.id,
        participantType: "TEAM",
        teamId: foreignTeam.id,
        status: "APPROVED",
        participantNameSnapshot: foreignTeam.name,
      },
    });
    await assert.rejects(
      prisma.competitionFixture.create({
        data: {
          scheduleId: schedule.id,
          competitionId: competition.id,
          roundNumber: 1,
          fixtureNumber: 999,
          participantAEntryId: foreignEntry.id,
          participantBEntryId: approvedEntries[0]!.id,
        },
      }),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2003",
    );

    const knockoutCompetition = await createCompetition(first.community.id, first.user.id, {
      name: "Knockout Schedule Cup",
      sport: "FOOTBALL",
      format: "KNOCKOUT",
      participantType: "TEAM",
      registrationMode: "OPEN",
      maxEntries: 4,
    });
    await transitionCompetition(first.community.id, knockoutCompetition.id, first.user.id, "REGISTRATION_OPEN");
    await registerEntry(first.community.id, knockoutCompetition.id, first.user.id, { teamId: teams[0]!.id });
    await registerEntry(first.community.id, knockoutCompetition.id, first.user.id, { teamId: teams[1]!.id });
    await registerEntry(first.community.id, knockoutCompetition.id, first.user.id, { teamId: teams[2]!.id });
    await assert.rejects(
      generateSchedule(first.community.id, knockoutCompetition.id, first.user.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    await transitionCompetition(first.community.id, knockoutCompetition.id, first.user.id, "REGISTRATION_CLOSED");
    const knockoutSchedule = await generateSchedule(first.community.id, knockoutCompetition.id, first.user.id);
    assert.equal(knockoutSchedule.format, "KNOCKOUT");
    assert.equal(knockoutSchedule.participantCount, 3);
    assert.equal(knockoutSchedule.roundCount, 2);
    assert.equal(knockoutSchedule.fixtureCount, 2);
    assert.equal(knockoutSchedule.matchCount, 1);
    assert.equal(knockoutSchedule.byeCount, 1);
    assert.equal(knockoutSchedule.fixtures.filter((fixture) => fixture.status === "BYE").length, 1);
  } finally {
    for (const communityId of communities) {
      await prisma.community.deleteMany({ where: { id: communityId } });
    }
    for (const userId of users) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
});
