import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db/client.js";
import { getDocById, saveDoc } from "./docs.js";

const BODY_FIELD = "body";

/** Encodes exactly what a real client would send: `{ update }` is a base64
 *  Yjs binary update, per part2-PRD §8 — Node's Buffer, the same encoding
 *  the server's own Doc.snapshot round-trip uses. */
function encode(update: Uint8Array): string {
  return Buffer.from(update).toString("base64");
}

function textFromSnapshot(snapshot: Buffer | Uint8Array): string {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  return doc.getText(BODY_FIELD).toString();
}

async function createSeededDoc(ownerId: string, title: string) {
  const doc = await prisma.doc.create({
    data: {
      title,
      ownerId,
      collaborators: { create: { userId: ownerId, role: "owner" } },
    },
  });
  return doc.id;
}

describe("saveDoc — merges into the stored snapshot and advances updatedAt", () => {
  const email = `qa-ts6-${randomUUID()}@example.test`;
  let userId: string;
  let docId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, googleId: `qa-ts6-google-${randomUUID()}`, name: "TS-6 user" },
    });
    userId = user.id;
    docId = await createSeededDoc(userId, "TS-6 fixture document");
  });

  afterAll(async () => {
    await prisma.doc.delete({ where: { id: docId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("returns a refreshed updatedAt and the merged content is what a later GET hands back [AC-49] [AC-31]", async () => {
    const before = await getDocById(docId);
    expect(before?.snapshot).toBeNull();
    const preUpdatedAt = before!.updatedAt;

    // A real client's own Y.Doc: builds "hello" from nothing, since the
    // server's stored snapshot starts null.
    const client = new Y.Doc();
    client.getText(BODY_FIELD).insert(0, "hello");
    const vectorAfterHello = Y.encodeStateVector(client);

    const result = await saveDoc(docId, encode(Y.encodeStateAsUpdate(client)));

    expect(result.updatedAt.getTime()).toBeGreaterThan(preUpdatedAt.getTime());

    const afterFirstSave = await getDocById(docId);
    expect(textFromSnapshot(afterFirstSave!.snapshot!)).toBe("hello");

    // The second save is a delta relative to what the client already knew
    // it had synced — only the " world" insert, not the whole document —
    // so a server that overwrites instead of merging would leave the
    // stored snapshot decoding to " world" alone, not "hello world".
    client.getText(BODY_FIELD).insert(5, " world");
    const delta = Y.encodeStateAsUpdate(client, vectorAfterHello);

    const secondResult = await saveDoc(docId, encode(delta));
    expect(secondResult.updatedAt.getTime()).toBeGreaterThanOrEqual(
      afterFirstSave!.updatedAt.getTime(),
    );

    const afterSecondSave = await getDocById(docId);
    expect(textFromSnapshot(afterSecondSave!.snapshot!)).toBe("hello world");
  });
});

describe("saveDoc — two divergent collaborator saves both survive the merge", () => {
  const ownerEmail = `qa-ts7-owner-${randomUUID()}@example.test`;
  const editorEmail = `qa-ts7-editor-${randomUUID()}@example.test`;
  let ownerId: string;
  let editorId: string;
  let docId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { email: ownerEmail, googleId: `qa-ts7-owner-google-${randomUUID()}`, name: "TS-7 owner" },
    });
    ownerId = owner.id;
    const editor = await prisma.user.create({
      data: { email: editorEmail, googleId: `qa-ts7-editor-google-${randomUUID()}`, name: "TS-7 editor" },
    });
    editorId = editor.id;

    docId = await createSeededDoc(ownerId, "TS-7 fixture document");
    await prisma.docCollaborator.create({
      data: { docId, userId: editorId, role: "editor" },
    });

    // Base state both collaborators will diverge from.
    const base = new Y.Doc();
    base.getText(BODY_FIELD).insert(0, "base");
    await saveDoc(docId, encode(Y.encodeStateAsUpdate(base)));
  });

  afterAll(async () => {
    await prisma.doc.delete({ where: { id: docId } }).catch(() => {});
    await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    await prisma.user.delete({ where: { id: editorId } }).catch(() => {});
  });

  it("neither collaborator's divergent offline edit is clobbered by the other's save [AC-50]", async () => {
    const baseline = await getDocById(docId);
    const baseSnapshot = baseline!.snapshot!;
    const baseVector = (() => {
      const d = new Y.Doc();
      Y.applyUpdate(d, baseSnapshot);
      return Y.encodeStateVector(d);
    })();

    // Client A: appends " from A" at the end of "base".
    const clientA = new Y.Doc();
    Y.applyUpdate(clientA, baseSnapshot);
    clientA.getText(BODY_FIELD).insert(4, " from A");
    const updateA = Y.encodeStateAsUpdate(clientA, baseVector);

    // Client B: never saw A's edit — its delta is computed from the same
    // base vector, inserting "B: " at the start.
    const clientB = new Y.Doc();
    Y.applyUpdate(clientB, baseSnapshot);
    clientB.getText(BODY_FIELD).insert(0, "B: ");
    const updateB = Y.encodeStateAsUpdate(clientB, baseVector);

    await saveDoc(docId, encode(updateA));
    await saveDoc(docId, encode(updateB));

    const final = await getDocById(docId);
    const finalText = textFromSnapshot(final!.snapshot!);

    // Interleaving order is CRDT-determined — assert containment and length,
    // not an exact string, so a Yjs version bump can't make this brittle.
    expect(finalText).toContain("B: ");
    expect(finalText).toContain(" from A");
    expect(finalText.length).toBe("base".length + " from A".length + "B: ".length);
  });
});
