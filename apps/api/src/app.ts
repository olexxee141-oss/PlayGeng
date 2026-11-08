import cors from "cors";
import express from "express";
import helmet from "helmet";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.WEB_URL ?? "http://localhost:5173",
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

  return app;
};