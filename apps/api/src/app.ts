import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorMiddleware } from "./shared/middlewares/error.middleware.js";
import { notFoundMiddleware } from "./shared/middlewares/not-found.middleware.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "PlayGeng API is healthy",
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  logger.info("PlayGeng API application initialized");

  return app;
};