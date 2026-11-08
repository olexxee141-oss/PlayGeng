import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "PlayGeng API listening");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down PlayGeng API");

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Error while shutting down API server");
      process.exitCode = 1;
    }
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));