/**
 * Seeds the database for end-to-end tests and writes a Playwright storage state
 * per role.
 *
 * Why this exists: auth is Google OAuth only, so a browser cannot reach a
 * signed-in state on its own. Driving Google's consent screen is slow, brittle
 * and against their terms. But `requireAuth` only verifies a JWT — it never
 * talks to Google — so a valid session can be minted directly.
 *
 * This deliberately imports `signAccessToken` and the cookie names from the app
 * rather than reimplementing them. If the token shape or a cookie name changes,
 * this breaks loudly instead of quietly producing sessions the middleware
 * rejects.
 *
 *   pnpm --filter server seed:e2e
 */
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "../db/client.js";
import { signAccessToken } from "../lib/jwt.js";
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE } from "../lib/cookies.js";
import { ACCESS_TOKEN_TTL_SECONDS, env } from "../config/env.js";

/** Repo root, from apps/server/src/scripts. */
const ROOT = path.resolve(import.meta.dirname, "../../../..");
const AUTH_DIR = path.join(ROOT, "e2e", ".auth");

const ROLES = ["owner", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];

/** Stable, obviously-fake identities so a real user is never touched. */
const identity = (role: Role) => ({
  email: `e2e-${role}@example.test`,
  googleId: `e2e-google-${role}`,
  name: `E2E ${role}`,
});

function cookie(name: string, value: string, httpOnly: boolean) {
  return {
    name,
    value,
    domain: "localhost",
    path: "/",
    // Playwright wants seconds since epoch.
    expires: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    httpOnly,
    // `secure` follows the app: baseCookieOptions sets it only in production.
    secure: env.NODE_ENV === "production",
    sameSite: "Lax" as const,
  };
}

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("refusing to seed e2e fixtures against NODE_ENV=production");
  }
  await mkdir(AUTH_DIR, { recursive: true });

  // 1. One user per role.
  const users: Record<Role, { id: string; email: string }> = {} as never;
  for (const role of ROLES) {
    const who = identity(role);
    const user = await prisma.user.upsert({
      where: { email: who.email },
      update: { name: who.name },
      create: who,
    });
    users[role] = { id: user.id, email: user.email };
  }

  // 2. A document owned by the owner, with the other two as collaborators.
  //    Roles are per-document here, not per-user — `requireRole` reads
  //    DocCollaborator, so a "viewer" only exists in relation to a doc.
  const TITLE = "E2E fixture document";
  const existing = await prisma.doc.findFirst({
    where: { title: TITLE, ownerId: users.owner.id },
  });
  const doc =
    existing ??
    (await prisma.doc.create({
      data: { title: TITLE, ownerId: users.owner.id },
    }));

  for (const role of ROLES) {
    await prisma.docCollaborator.upsert({
      where: { docId_userId: { docId: doc.id, userId: users[role].id } },
      update: { role },
      create: { docId: doc.id, userId: users[role].id, role },
    });
  }

  // 3. A storage state per role: a real signed token plus the CSRF cookie.
  for (const role of ROLES) {
    const token = await signAccessToken({
      sub: users[role].id,
      email: users[role].email,
    });
    const state = {
      cookies: [
        cookie(ACCESS_TOKEN_COOKIE, token, true),
        // Readable by page JS on purpose — the app sends it back in x-csrf-token.
        cookie(CSRF_COOKIE, randomUUID(), false),
      ],
      origins: [],
    };
    await writeFile(
      path.join(AUTH_DIR, `${role}.json`),
      JSON.stringify(state, null, 2),
    );
  }

  // 4. Ids the specs need, so no test has to hunt for a fixture.
  await writeFile(
    path.join(AUTH_DIR, "fixtures.json"),
    JSON.stringify({ docId: doc.id, users }, null, 2),
  );

  console.log(`seeded ${ROLES.length} roles and doc ${doc.id} -> ${AUTH_DIR}`);
}

main()
  .catch((e) => {
    console.error("e2e seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
