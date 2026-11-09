import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { createCompetition, registerEntry, transitionCompetition, withdrawEntry } from "./competitions.service.js";

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
  }
});
