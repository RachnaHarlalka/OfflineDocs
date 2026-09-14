import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL only auto-unmounts when `globals: true`, which this project deliberately
// does not set. Without this the DOM accumulates across cases and every
// `getByPlaceholderText` in the second test onwards matches two nodes.
afterEach(cleanup);

// jsdom has no IndexedDB. fake-indexeddb is now an installed devDependency, so
// y-indexeddb runs for real against an in-memory IndexedDB implementation
// instead of being stubbed out — a mock here would leave the persistence
// wiring itself (open db, write update, read back on remount) proven only by
// the e2e suite. See TS-2/TS-3/TS-4/TS-20 in the doc-editor-save plan.
