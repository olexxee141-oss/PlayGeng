import { prisma } from "@playgeng/database";
import { logger } from "../config/logger.js";
import { generateMonthlyDrafts } from "../modules/contributions/contributions.service.js";

let running = false;
const run = async () => {
  if (running) return;
  running = true;
  try {
    const result = await generateMonthlyDrafts();
    if (result.created > 0) logger.info(result, "Generated monthly contribution assessment drafts");
  } catch (error) {
    logger.error({ err: error }, "Monthly contribution draft generation failed");
  } finally {
    running = false;
  }
};

const interval = setInterval(() => { void run(); }, 60_000);
interval.unref();
void run();

const shutdown = async (signal: string) => {
  clearInterval(interval);
  logger.info({ signal }, "Contribution scheduler shutting down");
  await prisma.$disconnect();
};
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
