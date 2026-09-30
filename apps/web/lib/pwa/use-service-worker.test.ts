import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useServiceWorker } from "./use-service-worker";

// requestQueueFlush talks to navigator.serviceWorker.ready, which this suite's
// stub does not provide — not what watchForUpdate is under test for here.
vi.mock("@/lib/offline/request-flush", () => ({
  requestQueueFlush: vi.fn().mockResolvedValue(undefined),
}));

/** A minimal stand-in for a ServiceWorker mid-install — real enough to drive
 *  `state` through addEventListener("statechange", ...), which is all the
 *  hook listens for. */
class FakeWorker extends EventTarget {
  state: string;
  constructor(initialState: string) {
    super();
    this.state = initialState;
  }
  setState(next: string) {
    this.state = next;
    this.dispatchEvent(new Event("statechange"));
  }
}

/** registration.installing is a worker already mid-install when register()
 *  resolves — no `waiting` worker, and no `updatefound` will ever fire for
 *  this one; it fired before this hook's listener attached. */
function stubRegistration(installing: FakeWorker): ServiceWorkerRegistration {
  return {
    waiting: null,
    installing,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as ServiceWorkerRegistration;
}

/** navigator.serviceWorker doesn't exist in jsdom, so each test installs its
 *  own stand-in, mirroring doc-saved-notice.test.tsx's stubServiceWorker(). */
function stubServiceWorkerContainer(
  registration: ServiceWorkerRegistration,
  controller: unknown,
): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      startMessages: vi.fn(),
      register: vi.fn().mockResolvedValue(registration),
      controller,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useServiceWorker — a worker already installing at mount [AC-222] (hunt H-12)", () => {
  it("raises updateReady once an installing worker reaches installed, single tab, no waiting worker", async () => {
    const installing = new FakeWorker("installing");
    const registration = stubRegistration(installing);
    // Non-null controller: an existing page is under an active worker's
    // control, so this is an update arriving mid-session (AC-222's case),
    // not a first install.
    stubServiceWorkerContainer(registration, { fake: "controller" });

    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => expect(registration.installing).toBe(installing));

    installing.setState("installed");

    // AC-222: an update arriving while the document is open must raise the
    // banner. watchForUpdate only ever listens for `updatefound` (fired
    // before this hook's listener attached) or a pre-existing
    // `registration.waiting` — a worker still `installing` at mount is heard
    // by neither, so this is expected red against unmodified source.
    await waitFor(() => expect(result.current.updateReady).toBe(true));
  });
});
