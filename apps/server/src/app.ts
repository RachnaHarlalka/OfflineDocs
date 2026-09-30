import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";
import { prisma } from "./db/client.js";
import { authRouter } from "./routes/auth.js";
import { docsRouter } from "./routes/docs.js";
import { collaboratorsRouter } from "./routes/collaborators.js";
import { draftRouter, presenceRouter } from "./routes/presence.js";
import { pushRouter } from "./routes/push.js";
import { sttRouter } from "./routes/stt.js";
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
/* Matches QUEUE_ITEM_MAX_BYTES in the web app's lib/offline/queue-schema.ts. A
   lower limit here would let the client queue a save it can never send: the
   worker would read the refusal as a transport failure and retry that document's
   queue forever. The two caps are one decision and must move together. */
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.use(requireCsrfToken);

app.get("/health", async (_req, res) => {
  const userCount = await prisma.user.count();
  res.json({ status: "ok", userCount });
});

app.use("/auth", authRouter);
app.use("/docs", docsRouter);
app.use("/docs/:id/collaborators", collaboratorsRouter);
app.use("/docs/:id/draft", draftRouter);
app.use("/docs/:id/presence", presenceRouter);
app.use("/docs/:id/transcribe", sttRouter);
app.use("/push", pushRouter);

app.use(notFoundHandler);
app.use(errorHandler);
