/* DocSync service worker.

   A static file, deliberately outside the Next build: no bundling, no
   TypeScript, no env substitution. Its config arrives as a query string at
   registration time. */

/// <reference lib="webworker" />

/* Push and notificationclick live in sw-push.js (Phase 3) so the offline work and
   the push work never rewrite each other's worker. A scope gets exactly one
   worker, so this import is what keeps push alive now that this file owns
   caching and Background Sync. Nothing cache-related belongs in there. */
importScripts("/sw-push.js");

const PARAMS = new URL(self.location.href).searchParams;

/** Build stamp. Changing it changes every cache name, retiring the old ones. */
const VERSION = PARAMS.get("v") || "dev";
/** The API is a separate origin, so the routing tests below compare origins. */
const API_ORIGIN = PARAMS.get("api") || "";

const SHELL_CACHE = `docsync-shell-${VERSION}`;
const STATIC_CACHE = `docsync-static-${VERSION}`;
/** Per-user content, unlike the other two — sign-out will have to clear this. */
const DOCS_CACHE = `docsync-docs-${VERSION}`;
/** One entry per route+params visited, unlike the other caches, so it is
    bounded rather than cleared wholesale. */
const RSC_CACHE = `docsync-rsc-${VERSION}`;
const RSC_CACHE_LIMIT = 32;

/* Stable URLs only. Hashed bundles cannot be listed here — their names change
   every build — so they are cached at runtime instead. */
/** Served for any page with no cached copy, so it must always be present. */
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/dashboard",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

/* A page's HTML is useless offline without the hashed chunks it loads, and those
   names only exist after a build, so they cannot be listed above. Reading them
   back out of the document is what keeps a precached page able to hydrate. */
/** A request that never settles must not be able to wedge the install. */
const PRECACHE_TIMEOUT_MS = 10_000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out: ${label}`)), ms),
    ),
  ]);
}

async function precacheAssetsOf(response) {
  if (!response.headers.get("Content-Type")?.includes("text/html")) return;

  const paths = (await withTimeout(response.text(), PRECACHE_TIMEOUT_MS, "read html")).match(
    /\/_next\/static\/[\w./-]+/g,
  );
  if (!paths) return;

  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...new Set(paths)]
      /* Hot-update files exist only for the dev server's current build and can
         hang; they are worthless to cache either way. */
      .filter((path) => !path.includes("/webpack/") && !path.includes("hot-update"))
      .map((path) =>
        withTimeout(cache.add(path), PRECACHE_TIMEOUT_MS, path).catch((error) =>
          console.warn("[sw] could not precache", path, error),
        ),
      ),
  );
}

self.addEventListener("install", (event) => {
  /* No skipWaiting(): a new worker taking over under a user mid-edit would swap
     the code out from under them. It waits until every tab using the old one
     has closed. */
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);

      /* Individually, not addAll(): addAll is atomic, so a single 404 would fail
         the whole install and leave the app with no worker at all. */
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            // `cache: "reload"` so a stale HTTP-cached copy is never what we store.
            const response = await withTimeout(
              fetch(new Request(url, { cache: "reload" })),
              PRECACHE_TIMEOUT_MS,
              url,
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            await shell.put(url, response.clone());
            await precacheAssetsOf(response);
          } catch (error) {
            console.warn("[sw] could not precache", url, error);
          }
        }),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, STATIC_CACHE, DOCS_CACHE, RSC_CACHE]);

  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("docsync-") && !keep.has(name))
          await caches.delete(name);
      }
      /* Take over pages that are already open. Without this a first install
         controls nothing until the next navigation, so it sees no requests and
         caches nothing. */
      await self.clients.claim();

      /* Claiming is too late for the fetches that page already made: the
         document list was requested before this worker existed, so it is not in
         the cache and a user who installs and immediately goes offline gets an
         empty dashboard. Fetch it once, now, so the first visit is enough. */
      await warmDocList();
    })(),
  );
});

/** Caches `GET /docs` so the dashboard has something to render offline. */
async function warmDocList() {
  if (API_ORIGIN === "") return;

  try {
    const request = new Request(`${API_ORIGIN}/docs`, { credentials: "include" });
    const response = await fetch(request);
    if (response.ok) await (await caches.open(DOCS_CACHE)).put(request, response);
  } catch (error) {
    // Offline at activation, or signed out. The next online load caches it.
    console.warn("[sw] could not warm the document list", error);
  }
}

/* ------------------------------------------------------------ save queue -- */

/** Must match lib/offline/request-flush.ts. */
const SYNC_TAG = "docsync-save-queue";

/* Mirrors lib/offline/queue-schema.ts. The worker is plain JS outside the Next
   build and cannot import it, so the two must be changed together. */
const QUEUE_DB_NAME = "docsync-save-queue";
const QUEUE_DB_VERSION = 1;
const QUEUE_STORE = "entries";
const PAYLOAD_STORE = "payloads";

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);
    /* The same stores the page creates: whichever side opens the database first
       defines it, and a version-matched open that found no stores would leave
       every later read failing. */
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" }).createIndex("queuedAt", "queuedAt");
      }
      if (!db.objectStoreNames.contains(PAYLOAD_STORE)) {
        db.createObjectStore(PAYLOAD_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Oldest first — replay order is queue order. */
function readEntries(db) {
  return promisify(db.transaction(QUEUE_STORE, "readonly").objectStore(QUEUE_STORE).index("queuedAt").getAll());
}

function readPayload(db, id) {
  return promisify(db.transaction(PAYLOAD_STORE, "readonly").objectStore(PAYLOAD_STORE).get(id));
}

function deleteEntry(db, id) {
  const tx = db.transaction([QUEUE_STORE, PAYLOAD_STORE], "readwrite");
  tx.objectStore(QUEUE_STORE).delete(id);
  tx.objectStore(PAYLOAD_STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Forgets the cached `GET /docs/:id` for one document, if there is one. */
async function dropCachedDoc(docId) {
  try {
    const cache = await caches.open(DOCS_CACHE);
    /* ignoreVary: the API answers every request with `Vary: Origin` (the CORS
       middleware adds it), and a delete keyed by URL alone builds a Request with
       no Origin header — so without this the stored entry never matches and the
       stale copy survives the flush it was meant to invalidate. */
    await cache.delete(`${API_ORIGIN}/docs/${docId}`, { ignoreVary: true });
  } catch (error) {
    console.warn("[sw] could not drop cached doc", docId, error);
  }
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const client of clients) client.postMessage(message);
}

/** Mirrors CSRF_COOKIE in lib/api/client.ts. */
const CSRF_COOKIE = "docsync_csrf";

/* The server compares this header against the cookie of the same name, and a
   session refresh rotates both. The value captured when the save was queued is
   therefore stale by the time it is sent — read the live one, and fall back to
   the captured token only where CookieStore does not exist. */
async function currentCsrf(fallback) {
  try {
    const cookie = await self.cookieStore?.get(CSRF_COOKIE);
    return cookie?.value ?? fallback;
  } catch {
    return fallback;
  }
}

async function postSave(entry, payload) {
  const csrf = await currentCsrf(payload.csrf);

  return fetch(`${API_ORIGIN}/docs/${entry.docId}/save`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: JSON.stringify({ update: payload.update }),
  });
}

async function errorCode(response) {
  try {
    const body = await response.clone().json();
    return body?.error?.code ?? null;
  } catch {
    return null;
  }
}

async function refreshSession() {
  const csrf = await currentCsrf(null);

  const response = await fetch(`${API_ORIGIN}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: csrf ? { "X-CSRF-Token": csrf } : {},
  });
  return response.ok;
}

/** "sent" | "rejected" | "failed" — anything but a response throws. */
async function sendQueuedSave(entry, payload) {
  let response = await postSave(entry, payload);

  /* The token is checked when the save finally sends, not when it was queued, so
     an expired one is ordinary here rather than a sign of trouble (§7). */
  if (response.status === 401 && (await refreshSession())) {
    response = await postSave(entry, payload);
  }

  if (response.ok) return "sent";

  /* Access was revoked while the change waited. Kept and surfaced, never
     discarded — §16.2. A stale CSRF token also answers 403 and is merely worth
     retrying, so the two are told apart by the server's own code. */
  if (
    (response.status === 403 || response.status === 404) &&
    (await errorCode(response)) !== "csrf_token_invalid"
  ) {
    return "rejected";
  }

  return "failed";
}

function markRejected(db, entry) {
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).put({ ...entry, state: "rejected", attempts: entry.attempts + 1 });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let draining = false;

/**
 * Sends what the app could not. Order matters within a document, so one failure
 * blocks the rest of that document's queue rather than being skipped — replaying
 * a later update over a missing earlier one would drop the edits in between.
 */
async function drainQueue() {
  // The reconnect message and a Background Sync wake-up can arrive together.
  if (draining) return;
  draining = true;

  let unreachable = false;

  try {
    const db = await openQueueDb();
    const entries = await readEntries(db);
    if (entries.length === 0) return;

    await notifyClients({ type: "QUEUE_DRAINING" });
    const blocked = new Set();

    for (const entry of entries) {
      // Already surfaced to the user, whose decision it now is.
      if (entry.state === "rejected") continue;
      /* Queued dictation audio. It goes to /transcribe, and its transcript has
         to land in the panel's own store, so the page flushes those (Phase 4.2).
         Sending one to /save would corrupt the document. */
      if ((entry.kind ?? "save") === "audio") continue;
      if (blocked.has(entry.docId)) continue;

      const payload = await readPayload(db, entry.id);
      // An entry with no payload can never be sent; keeping it would block its
      // document forever.
      if (!payload) {
        await deleteEntry(db, entry.id);
        continue;
      }

      let outcome;
      try {
        outcome = await sendQueuedSave(entry, payload);
      } catch {
        // No response at all: the network, not the server, so it is worth
        // retrying.
        unreachable = true;
        blocked.add(entry.docId);
        continue;
      }

      if (outcome === "rejected") {
        await markRejected(db, entry);
        await notifyClients({ type: "SAVE_REJECTED", docId: entry.docId });
        blocked.add(entry.docId);
        continue;
      }

      if (outcome !== "sent") {
        blocked.add(entry.docId);
        continue;
      }

      await deleteEntry(db, entry.id);
      /* The cached copy of this document predates the change we just sent, and
         it is served stale-while-revalidate — so a reload would seed the editor
         from a version older than the server's and call saved work a draft.
         Drop it and let the next read come from the network. */
      await dropCachedDoc(entry.docId);
      await notifyClients({ type: "SAVE_FLUSHED", docId: entry.docId });
    }
  } finally {
    draining = false;
    await notifyClients({ type: "QUEUE_IDLE" });
  }

  /* Rejecting is how a `sync` handler asks the browser to try the tag again on
     its own schedule. Resolving would mark the work done and strand the queue
     until something else triggers a flush. */
  if (unreachable) throw new Error("Save queue still unreachable");
}

/* Fires on its own once the browser regains connectivity, tab open or not —
   the only path that survives the app being closed. Rejecting the promise asks
   the browser to retry the tag later with its own backoff. */
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(drainQueue());
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;

  /* The only route to skipWaiting(): the user pressed Refresh on the update
     banner. Never from install, activate or a timer — taking over under someone
     mid-edit would discard what they were typing. */
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "FLUSH_QUEUE") {
    event.waitUntil(drainQueue().catch((error) => console.warn("[sw] flush failed", error)));
  }
});

/* ------------------------------------------------------------- strategies -- */

/* Caching must never be able to fail the request it is caching: cache.put()
   rejects for reasons unrelated to the response (quota, partial content), and a
   rejection inside respondWith() kills the request. */
async function putQuietly(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch (error) {
    console.warn("[sw] could not cache", request.url, error);
  }
}

/** Content-hashed URLs, so a cached copy can never be stale. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) await putQuietly(cache, request, response.clone());
  return response;
}

/** Fresh whenever there is a network, the cached copy when there isn't. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) await putQuietly(cache, request, response.clone());
    return response;
  } catch (error) {
    /* ignoreVary: Next sends `Vary: rsc, next-router-*` to separate RSC payloads
       from HTML, but only one representation is ever stored under this key. */
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw error;
  }
}

/** The cached copy straight away, with a fresh one fetched for next time. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await putQuietly(cache, request, response.clone());
      return response;
    })
    // Expected offline, and swallowed rather than thrown so serving a hit does
    // not also log an unhandled rejection.
    .catch(() => undefined);

  if (hit) return hit;

  const response = await network;
  if (response) return response;
  throw new Error(
    `No cached copy of ${request.url} and the network is unreachable`,
  );
}

/** Evicts the oldest entries once a cache exceeds its limit, since insertion
    order in `cache.keys()` doubles as recency here. */
async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - limit;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

/* Next's router fetches the RSC payload on click instead of navigating, so the
   page's HTML is never requested and never cached. Re-requesting it here
   (without the RSC header, so Next returns the full document) keeps reload and
   direct URL entry working for every route, not just the one clicked. */
function shellUrlFor(url) {
  const shellUrl = new URL(url);
  shellUrl.searchParams.delete("_rsc");
  return shellUrl.toString();
}

async function warmShell(url) {
  const shellUrl = shellUrlFor(url);
  try {
    const response = await fetch(shellUrl, { headers: { Accept: "text/html" } });
    if (!response.ok) return;
    const cache = await caches.open(SHELL_CACHE);
    await putQuietly(cache, new Request(shellUrl), response);
  } catch (error) {
    console.warn("[sw] could not warm shell for", shellUrl, error);
  }
}

/** Carries the page that failed, so the offline page can offer to retry it. */
function offlineUrlFor(url) {
  const target = new URL(OFFLINE_URL, self.location.origin);
  target.searchParams.set("from", url.pathname + url.search);
  return target.toString();
}

/* Warming is skipped when the payload came from the cache: offline it could only
   fail, and the shell it would fetch is already there from the visit that
   cached the payload. */
async function handleRsc(event, request, url) {
  const cache = await caches.open(RSC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await putQuietly(cache, request, response.clone());
      event.waitUntil(
        Promise.all([warmShell(url), trimCache(RSC_CACHE, RSC_CACHE_LIMIT)]),
      );
    }
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw error;
  }
}

async function handleNavigation(request, url) {
  try {
    return await networkFirst(request, SHELL_CACHE);
  } catch (error) {
    /* The dashboard's ?view= is read client-side only, so its bare HTML is the
       right shell for any variant. Keep it that way, or this serves the wrong page. */
    if (url.pathname === "/dashboard") {
      const shell = await caches.match(request, {
        cacheName: SHELL_CACHE,
        ignoreSearch: true,
        ignoreVary: true,
      });
      if (shell) return shell;
    }

    /* ignoreSearch: the offline page is precached bare, but is requested with
       its ?from parameter. */
    const fallback = await caches.match(OFFLINE_URL, {
      cacheName: SHELL_CACHE,
      ignoreSearch: true,
    });
    if (!fallback) throw error;

    // Already the offline page — redirecting here would loop.
    if (url.pathname === OFFLINE_URL) return fallback;

    /* A redirect rather than this HTML under the requested URL: the App Router
       hydrates against the address bar, so a payload describing another route
       sends it into its own error boundary. */
    return Response.redirect(offlineUrlFor(url), 302);
  }
}

/* ---------------------------------------------------------------- routing -- */

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_next/static/")
  );
}

/* Auth is never cached: a stale session response is a security bug. Matched by
   path across both origins — the API's /auth/* and our own /auth/callback, whose
   URL differs per returnTo. */
function isAuthRoute(url) {
  return url.pathname.startsWith("/auth/");
}

function isApiRequest(url) {
  return API_ORIGIN !== "" && url.origin === new URL(API_ORIGIN).origin;
}

/** GET /docs/:id, which /docs/:id/collaborators must not be mistaken for. */
function isDocDetail(url) {
  return /^\/docs\/[^/]+$/.test(url.pathname);
}

/** The App Router's in-app navigation fetch, distinct from a `navigate` request. */
function isRscRequest(request) {
  return request.headers.get("RSC") === "1";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GETs are cacheable, and nothing else is ours to interfere with.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isAuthRoute(url)) return;

  /* The list stays fresh online and present offline; a document already opened
     should appear instantly and update behind the scenes. Every other API route
     falls through to the network untouched. */
  if (isApiRequest(url)) {
    if (url.pathname === "/docs") {
      event.respondWith(networkFirst(request, DOCS_CACHE));
    } else if (isDocDetail(url)) {
      event.respondWith(staleWhileRevalidate(request, DOCS_CACHE));
    }
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* Any in-app link click, for any route — not just documents. Serves the RSC
     payload fast and warms the page's real HTML shell behind the scenes, so a
     later reload or direct URL entry has something to fall back to. */
  if (isRscRequest(request)) {
    event.respondWith(handleRsc(event, request, url));
    return;
  }

  /* Navigations only — a document load or reload. */
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  /* The browser asks for the manifest and icons in request modes matching nothing
     above. Exact paths only: `?_rsc=` variants share a pathname and would
     accumulate here without bound. */
  if (
    url.search === "" &&
    url.origin === self.location.origin &&
    PRECACHE_URLS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});
