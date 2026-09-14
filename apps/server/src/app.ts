import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";
import { prisma } from "./db/client.js";
import { authRouter } from "./routes/auth.js";
import { docsRouter } from "./routes/docs.js";
import { requireCsrfToken } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

// Separate from index.ts's `.listen()` so Supertest can hit this directly —
// it binds its own ephemeral port per test run, never `env.PORT`.
export const app = express();

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use(requireCsrfToken);

app.get("/health", async (_req, res) => {
  const userCount = await prisma.user.count();
  res.json({ status: "ok", userCount });
});

app.use("/auth", authRouter);
app.use("/docs", docsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
