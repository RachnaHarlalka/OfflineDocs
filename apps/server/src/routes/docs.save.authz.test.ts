import { randomUUID } from "node:crypto";
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

function withSession<T extends request.Test>(req: T, accessToken: string): T {
  return req
    .set("Cookie", [
      `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
      `${CSRF_COOKIE}=${CSRF_TOKEN}`,
    ])
    .set(CSRF_HEADER, CSRF_TOKEN) as T;
}

function validSaveBody(): { update: string } {
  const ydoc = new Y.Doc();
  ydoc.getText("content").insert(0, "authz matrix save");
  return { update: Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64") };
}

async function makeUser(label: string) {
  const email = `qa-ts9-${label}-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, googleId: `qa-ts9-${label}-google-${randomUUID()}`, name: `TS-9 ${label}` },
  });
  const accessToken = await signAccessToken({ sub: user.id, email });
  return { id: user.id, email, accessToken };
}

describe("POST /docs/:id/save — role matrix [AC-53] [AC-54] [AC-55]", () => {
  let ownerId: string;
  let editorId: string;
  let viewerId: string;
  let nonCollaboratorId: string;

  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let nonCollaboratorToken: string;

  let docId: string;
  const UNKNOWN_DOC_ID = "00000000-0000-4000-8000-000000000000";

  beforeAll(async () => {
    const owner = await makeUser("owner");
    const editor = await makeUser("editor");
    const viewer = await makeUser("viewer");
    const outsider = await makeUser("outsider");

    ownerId = owner.id;
    editorId = editor.id;
    viewerId = viewer.id;
    nonCollaboratorId = outsider.id;
    ownerToken = owner.accessToken;
    editorToken = editor.accessToken;
    viewerToken = viewer.accessToken;
    nonCollaboratorToken = outsider.accessToken;

    const doc = await prisma.doc.create({
      data: {
        title: "TS-9 authz fixture document",
        ownerId,
        collaborators: {
          create: [
            { userId: ownerId, role: "owner" },
            { userId: editorId, role: "editor" },
            { userId: viewerId, role: "viewer" },
          ],
        },
      },
    });
    docId = doc.id;
  });

  afterAll(async () => {
    await prisma.doc.delete({ where: { id: docId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, editorId, viewerId, nonCollaboratorId] } },
    });
  });

  async function currentSnapshot(): Promise<Buffer | null> {
    const doc = await prisma.doc.findUniqueOrThrow({
      where: { id: docId },
      select: { snapshot: true },
    });
    return doc.snapshot ? Buffer.from(doc.snapshot) : null;
  }

  it("returns 200 for the owner [AC-53]", async () => {
    const res = await withSession(
      request(app).post(`/docs/${docId}/save`),
      ownerToken,
    ).send(validSaveBody());

    expect(res.status).toBe(200);
  });

  it("returns 200 for an editor [AC-53]", async () => {
    const res = await withSession(
      request(app).post(`/docs/${docId}/save`),
      editorToken,
    ).send(validSaveBody());

    expect(res.status).toBe(200);
  });

  it("returns 403 forbidden for a viewer, and leaves the stored document unchanged [AC-53]", async () => {
    const before = await currentSnapshot();

    const res = await withSession(
      request(app).post(`/docs/${docId}/save`),
      viewerToken,
    ).send(validSaveBody());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");

    const after = await currentSnapshot();
    expect(after?.equals(before ?? Buffer.alloc(0))).toBe(true);
  });

  it("returns 403 forbidden, not 400, for a viewer sending a malformed body [AC-53]", async () => {
    const res = await withSession(
      request(app).post(`/docs/${docId}/save`),
      viewerToken,
    ).send({ update: "" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("returns 404 not_found for a non-collaborator, and leaves the stored document unchanged [AC-54]", async () => {
    const before = await currentSnapshot();

    const res = await withSession(
      request(app).post(`/docs/${docId}/save`),
      nonCollaboratorToken,
    ).send(validSaveBody());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");

    const after = await currentSnapshot();
    expect(after?.equals(before ?? Buffer.alloc(0))).toBe(true);
  });

  it("returns 404 not_found for an unknown document id, identical in status and code to a non-collaborator [AC-54]", async () => {
    const nonCollaboratorRes = await withSession(
      request(app).post(`/docs/${docId}/save`),
      nonCollaboratorToken,
    ).send(validSaveBody());

    const unknownDocRes = await withSession(
      request(app).post(`/docs/${UNKNOWN_DOC_ID}/save`),
      ownerToken,
    ).send(validSaveBody());

    expect(unknownDocRes.status).toBe(404);
    expect(unknownDocRes.body.error.code).toBe("not_found");
    expect(unknownDocRes.status).toBe(nonCollaboratorRes.status);
    expect(unknownDocRes.body.error.code).toBe(nonCollaboratorRes.body.error.code);
  });

  it("returns 401 unauthorized with no session [AC-55]", async () => {
    const res = await request(app)
      .post(`/docs/${docId}/save`)
      .set(CSRF_HEADER, CSRF_TOKEN)
      .set("Cookie", `${CSRF_COOKIE}=${CSRF_TOKEN}`)
      .send(validSaveBody());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });
});
