import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64 } from "./base64";

// AC-31: body text saved must come back byte-for-byte on a later load.
// AC-57: characters outside the BMP (surrogate pairs) survive the round-trip.
// Both depend on this codec being lossless for every possible byte, because
// Yjs updates are varint-encoded and routinely contain bytes >= 0x80.
describe("base64 codec round-trip", () => {
  it("round-trips every byte value 0..255 element-for-element [AC-31] [AC-57]", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;

    const roundTripped = base64ToBytes(bytesToBase64(bytes));

    expect(Array.from(roundTripped)).toEqual(Array.from(bytes));
  });

  it("round-trips an empty byte array to an empty array [AC-31]", () => {
    const bytes = new Uint8Array(0);

    const roundTripped = base64ToBytes(bytesToBase64(bytes));

    expect(roundTripped.length).toBe(0);
  });

  it("round-trips a single byte at the top of the range (0xff) unmasked [AC-31] [AC-57]", () => {
    const bytes = new Uint8Array([0xff]);

    const roundTripped = base64ToBytes(bytesToBase64(bytes));

    expect(Array.from(roundTripped)).toEqual([0xff]);
  });

  it("does not clear the high bit on any byte >= 0x80 [AC-57]", () => {
    // A masked encoder (bytes[i] & 0x7f) leaves every one of these unchanged
    // by coincidence only if the high bit was already 0 — pick values whose
    // high bit is the only thing distinguishing them from a plausible-looking
    // but wrong result, so a regression can't slip through silently.
    const bytes = new Uint8Array([0x80, 0x81, 0xa5, 0xfe, 0xff]);

    const roundTripped = base64ToBytes(bytesToBase64(bytes));

    expect(Array.from(roundTripped)).toEqual([0x80, 0x81, 0xa5, 0xfe, 0xff]);
  });
});
