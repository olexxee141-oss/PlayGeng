import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { createCompetition, registerEntry, reviewEntry, transitionCompetition, withdrawEntry } from "./competitions.service.js";

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
    assert.equal(pendingEntry.status, "PENDING");
    const approvedEntry = await reviewEntry(first.community.id, approvalCompetition.id, pendingEntry.id, first.user.id, { decision: "APPROVED" });
    assert.equal(approvedEntry.status, "APPROVED");

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
