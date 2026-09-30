import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./db/client.js";
import { signAccessToken } from "./lib/jwt.js";
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER } from "./lib/cookies.js";

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

/** A syntactically-valid base64 string of exactly `length` characters. The
 *  save route 400s on an update that doesn't decode to a real Yjs update
 *  before it would ever reach the body-size middleware, so these tests only
 *  need something express.json will parse and count bytes on — the body
 *  limit sits in front of the route handler. */
function base64OfLength(length: number): string {
  // base64 alphabet, repeated — decodes fine, size is what's under test.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  while (out.length < length) out += alphabet;
  return out.slice(0, length);
}

describe("POST /docs/:id/save — body size limit [AC-218]", () => {
  const email = `qa-ts16-${randomUUID()}@example.test`;
  let userId: string;
  let docId: string;
  let accessToken: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, googleId: `qa-ts16-google-${randomUUID()}`, name: "TS-16 user" },
    });
    userId = user.id;
    accessToken = await signAccessToken({ sub: userId, email });

    const doc = await prisma.doc.create({
      data: {
        title: "TS-16 fixture document",
        ownerId: userId,
        collaborators: { create: { userId, role: "owner" } },
      },
    });
    docId = doc.id;
  });

  afterAll(async () => {
    await prisma.doc.delete({ where: { id: docId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("accepts a ~4 MB body [AC-218]", async () => {
    const res = await withSession(request(app).post(`/docs/${docId}/save`), accessToken).send({
      update: base64OfLength(4 * 1024 * 1024),
    });

    // Not asserting 200 specifically: the fixture's base64 doesn't decode to a
    // real Yjs update, so the route may 400 it as malformed content. What
    // AC-218 pins is that the body-size middleware itself let it through
    // rather than refusing it with 413.
    expect(res.status).not.toBe(413);
  });

  it("refuses a body over 5 MB + margin with 413 [AC-218]", async () => {
    const res = await withSession(request(app).post(`/docs/${docId}/save`), accessToken).send({
      update: base64OfLength(5 * 1024 * 1024 + 512 * 1024),
    });

    expect(res.status).toBe(413);
  });
});

describe("POST /docs/:id/save — client queue cap vs. server envelope [AC-219] [AC-225] (hunt H-4)", () => {
  const email = `qa-ts21-${randomUUID()}@example.test`;
  let userId: string;
  let docId: string;
  let accessToken: string;

  // Mirrors QUEUE_ITEM_MAX_BYTES in apps/web/lib/offline/queue-schema.ts —
  // the client-side cap the save-queue's enqueue() checks `update.length`
  // against before ever touching the network.
  const QUEUE_ITEM_MAX_BYTES = 5 * 1024 * 1024;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, googleId: `qa-ts21-google-${randomUUID()}`, name: "TS-21 user" },
    });
    userId = user.id;
    accessToken = await signAccessToken({ sub: userId, email });

    const doc = await prisma.doc.create({
      data: {
        title: "TS-21 fixture document",
        ownerId: userId,
        collaborators: { create: { userId, role: "owner" } },
      },
    });
    docId = doc.id;
  });

  afterAll(async () => {
    await prisma.doc.delete({ where: { id: docId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  // Re-pinned per work-order W-2: the previous version posted the raw-length
  // boundary itself and demanded 2xx, which bakes in the very premise the
  // remedy rejects (save-queue.ts is fixed to size by the transmitted
  // envelope, not the raw update string — verdict V-2, "remedy_chosen"). The
  // invariant that survives the fix is stronger: whatever is the *largest
  // envelope a correctly-sized client would send*, the server accepts it —
  // and the *first* envelope size such a client would refuse, the server also
  // refuses, with 413. Both sizes are computed here from the envelope shape
  // (`JSON.stringify({ update })`) directly, exactly as save-queue.ts will
  // measure after W-3, rather than by calling client code.
  const ENVELOPE_OVERHEAD = JSON.stringify({ update: "" }).length;

  it("accepts the largest envelope a correctly-sized client would send at the cap [AC-219] [AC-225] (hunt H-4)", async () => {
    const update = base64OfLength(QUEUE_ITEM_MAX_BYTES - ENVELOPE_OVERHEAD);
    const envelope = JSON.stringify({ update });
    expect(envelope.length).toBe(QUEUE_ITEM_MAX_BYTES);

    const res = await withSession(request(app).post(`/docs/${docId}/save`), accessToken).send({
      update,
    });

    // Not asserting 200 specifically, matching TS-16: this fixture's base64
    // doesn't decode to a real Yjs update, so the route may 400 it as
    // malformed content. What the boundary pins is that the body-size
    // middleware itself let it through rather than refusing it with 413.
    expect(res.status).not.toBe(413);
  });

  it("refuses with 413 the first envelope size a correctly-sized client would refuse [AC-219] [AC-225] (hunt H-4)", async () => {
    const update = base64OfLength(QUEUE_ITEM_MAX_BYTES - ENVELOPE_OVERHEAD + 1);
    const envelope = JSON.stringify({ update });
    expect(envelope.length).toBe(QUEUE_ITEM_MAX_BYTES + 1);

    const res = await withSession(request(app).post(`/docs/${docId}/save`), accessToken).send({
      update,
    });

    expect(res.status).toBe(413);
  });
});
