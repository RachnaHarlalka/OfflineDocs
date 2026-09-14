import { randomBytes, randomUUID } from "node:crypto";
import * as Y from "yjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { prisma } from "../db/client.js";
import { signAccessToken } from "../lib/jwt.js";
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER } from "../lib/cookies.js";

// requireCsrfToken only compares the cookie and header for equality — any
// shared value works for a test session, it doesn't need to be server-issued.
const CSRF_TOKEN = "test-csrf-token";

// supertest's `.post(path)` must be chained from a fresh `request(app)` call,
// so build the session headers and apply them to a caller-supplied request.
function withSession<T extends request.Test>(req: T, accessToken: string): T {
  return req
    .set("Cookie", [
      `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
      `${CSRF_COOKIE}=${CSRF_TOKEN}`,
    ])
    .set(CSRF_HEADER, CSRF_TOKEN) as T;
}

function textUpdate(text: string): string {
  const ydoc = new Y.Doc();
  ydoc.getText("content").insert(0, text);
  return Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64");
}

function textFromSnapshotBase64(snapshot: string): string {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, Buffer.from(snapshot, "base64"));
  return ydoc.getText("content").toString();
}

describe("POST /docs/:id/save — malformed update rejected with 400 [AC-51] [AC-52] [AC-56]", () => {
  const email = `qa-ts8-${randomUUID()}@example.test`;
  let userId: string;
  let docId: string;
  let accessToken: string;
  const seededText = "hello from the seeded snapshot";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, googleId: `qa-ts8-google-${randomUUID()}`, name: "TS-8 user" },
    });
    userId = user.id;
    accessToken = await signAccessToken({ sub: userId, email });

    const doc = await prisma.doc.create({
      data: {
        title: "TS-8 fixture document",
        ownerId: userId,
        collaborators: { create: { userId, role: "owner" } },
      },
    });
    docId = doc.id;

    // Seed a real, non-null snapshot so "document unchanged" has something to compare against.
    const res = await withSession(request(app).post(`/docs/${docId}/save`), accessToken).send({
      update: textUpdate(seededText),
    });
    expect(res.status).toBe(200);
  });

  afterAll(async () => {
    await prisma.doc.delete({ where: { id: docId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  async function currentSnapshot(): Promise<Buffer | null> {
    const doc = await prisma.doc.findUniqueOrThrow({
      where: { id: docId },
      select: { snapshot: true },
    });
    return doc.snapshot ? Buffer.from(doc.snapshot) : null;
  }

  const cases: { name: string; body: unknown }[] = [
    { name: "not a real Yjs update string", body: { update: "not-a-real-update" } },
    { name: "empty update string", body: { update: "" } },
    { name: "missing update field", body: {} },
    { name: "update is not a string", body: { update: 123 } },
    {
      name: "base64 of random bytes",
      body: { update: randomBytes(32).toString("base64") },
    },
    {
      name: "base64 of a valid update truncated to half its length",
      body: { update: (() => {
        const fullBytes = Buffer.from(
          textUpdate("a much longer paragraph of text to update"),
          "base64",
        );
        return fullBytes.subarray(0, Math.floor(fullBytes.length / 2)).toString("base64");
      })() },
    },
  ];

  for (const { name, body } of cases) {
    it(`rejects "${name}" with 400 and leaves the stored document untouched [AC-51] [AC-52] [AC-56]`, async () => {
      const before = await currentSnapshot();

      const res = await withSession(request(app).post(`/docs/${docId}/save`), accessToken).send(
        body,
      );

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { code: expect.stringMatching(/bad_request|invalid_update/) },
      });
      expect(typeof res.body.error.message).toBe("string");

      const after = await currentSnapshot();
      expect(after?.equals(before ?? Buffer.alloc(0))).toBe(true);
      if (after) {
        expect(textFromSnapshotBase64(after.toString("base64"))).toBe(seededText);
      }

      // The process stays up — a subsequent well-formed request still succeeds.
      const follow = await request(app).get(`/docs/${docId}`).set(
        "Cookie",
        `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
      );
      expect(follow.status).toBe(200);
    });
  }
});
