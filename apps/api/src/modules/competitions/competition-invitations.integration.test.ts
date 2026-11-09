import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { createCompetition, registerEntry, transitionCompetition } from "./competitions.service.js";
import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  listInvitations,
} from "./competition-invitations.service.js";

test("invite-only competitions invite and admit only the intended player or team captain", async () => {
  const suffix = randomUUID();
  const userIds: string[] = [];
  let communityId: string | undefined;

  const createUser = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `competition-invite-${label}-${suffix}@playgeng.test`,
        firstName: "Invite",
        lastName: label,
        passwordHash: "integration-test-hash",
      },
    });
    userIds.push(user.id);
    return user;
  };

  try {
    const owner = await createUser("owner");
    const captain = await createUser("captain");
    const player = await createUser("player");
    const community = await prisma.community.create({
      data: {
        name: `Invitation Community ${suffix.slice(0, 8)}`,
        slug: `invitation-community-${suffix.slice(0, 8)}`,
        ownerId: owner.id,
        members: {
          create: [
            { userId: owner.id, role: "OWNER" },
            { userId: captain.id, role: "MEMBER" },
            { userId: player.id, role: "MEMBER" },
          ],
        },
        sports: { create: [{ sport: "FOOTBALL", isPrimary: true }, { sport: "TENNIS" }] },
      },
    });
    communityId = community.id;

    const footballSport = await prisma.communitySport.findUniqueOrThrow({
      where: { communityId_sport: { communityId: community.id, sport: "FOOTBALL" } },
    });
    const team = await prisma.team.create({
      data: {
        communityId: community.id,
        communitySportId: footballSport.id,
        createdById: owner.id,
        name: `Invited Team ${suffix.slice(0, 6)}`,
      },
    });
    await prisma.teamMember.create({
      data: { teamId: team.id, communityId: community.id, userId: captain.id, role: "CAPTAIN", captainKey: "CAPTAIN" },
    });

    const teamCompetition = await createCompetition(community.id, owner.id, {
      name: "Invite Team Cup",
      sport: "FOOTBALL",
      format: "KNOCKOUT",
      participantType: "TEAM",
      registrationMode: "INVITE_ONLY",
      maxEntries: 4,
    });
    await transitionCompetition(community.id, teamCompetition.id, owner.id, "REGISTRATION_OPEN");
    await assert.rejects(
      registerEntry(community.id, teamCompetition.id, captain.id, { teamId: team.id }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    const teamInvitation = await createInvitation(community.id, teamCompetition.id, owner.id, { teamId: team.id });
    assert.equal(teamInvitation.invitedUserId, captain.id);
    await assert.rejects(
      createInvitation(community.id, teamCompetition.id, owner.id, { teamId: team.id }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    assert.equal((await listInvitations(community.id, teamCompetition.id, captain.id)).length, 1);

    await assert.rejects(
      acceptInvitation(community.id, teamCompetition.id, teamInvitation.id, player.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 403,
    );
    const teamEntry = await acceptInvitation(community.id, teamCompetition.id, teamInvitation.id, captain.id);
    assert.equal(teamEntry.teamId, team.id);
    assert.equal(teamEntry.status, "APPROVED");

    const tennisSport = await prisma.communitySport.findUniqueOrThrow({
      where: { communityId_sport: { communityId: community.id, sport: "TENNIS" } },
    });
    assert.ok(tennisSport);
    const playerCompetition = await createCompetition(community.id, owner.id, {
      name: "Invite Singles Cup",
      sport: "TENNIS",
      format: "ROUND_ROBIN",
      participantType: "PLAYER",
      registrationMode: "INVITE_ONLY",
      maxEntries: 8,
    });
    await transitionCompetition(community.id, playerCompetition.id, owner.id, "REGISTRATION_OPEN");
    const playerInvitation = await createInvitation(community.id, playerCompetition.id, owner.id, { playerUserId: player.id });
    const playerEntry = await acceptInvitation(community.id, playerCompetition.id, playerInvitation.id, player.id);
    assert.equal(playerEntry.playerUserId, player.id);
    assert.equal(playerEntry.participantNameSnapshot, "Invite player");

    const capacityCompetition = await createCompetition(community.id, owner.id, {
      name: "Invitation Capacity Cup",
      sport: "TENNIS",
      format: "ROUND_ROBIN",
      participantType: "PLAYER",
      registrationMode: "INVITE_ONLY",
      maxEntries: 1,
    });
    await transitionCompetition(community.id, capacityCompetition.id, owner.id, "REGISTRATION_OPEN");
    const playerCapacityInvite = await createInvitation(community.id, capacityCompetition.id, owner.id, { playerUserId: player.id });
    const captainCapacityInvite = await createInvitation(community.id, capacityCompetition.id, owner.id, { playerUserId: captain.id });
    await acceptInvitation(community.id, capacityCompetition.id, playerCapacityInvite.id, player.id);
    await assert.rejects(
      acceptInvitation(community.id, capacityCompetition.id, captainCapacityInvite.id, captain.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    const declineCompetition = await createCompetition(community.id, owner.id, {
      name: "Decline Cup",
      sport: "TENNIS",
      format: "ROUND_ROBIN",
      participantType: "PLAYER",
      registrationMode: "INVITE_ONLY",
    });
    await transitionCompetition(community.id, declineCompetition.id, owner.id, "REGISTRATION_OPEN");
    const declineInvite = await createInvitation(community.id, declineCompetition.id, owner.id, { playerUserId: player.id });
    await declineInvitation(community.id, declineCompetition.id, declineInvite.id, player.id);
    const declined = await prisma.competitionInvitation.findUniqueOrThrow({ where: { id: declineInvite.id } });
    assert.equal(declined.status, "DECLINED");

    const expiringInvite = await createInvitation(community.id, declineCompetition.id, owner.id, {
      playerUserId: captain.id,
    });
    await prisma.competitionInvitation.update({ where: { id: expiringInvite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(
      acceptInvitation(community.id, declineCompetition.id, expiringInvite.id, captain.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 410,
    );
    const expired = await prisma.competitionInvitation.findUniqueOrThrow({ where: { id: expiringInvite.id } });
    assert.equal(expired.status, "EXPIRED");
  } finally {
    if (communityId) await prisma.community.deleteMany({ where: { id: communityId } });
    for (const userId of userIds) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
