import "dotenv/config";

import { createApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 4000);
const app = createApp();

const server = app.listen(port, () => {
  console.info(`PlayGeng API listening on port ${port}`);
});

const shutdown = (signal: string) => {
  console.info(`${signal} received. Shutting down API server...`);
  server.close((error) => {
    if (error) {
      console.error("Error while shutting down API server", error);
      process.exitCode = 1;
    }
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));