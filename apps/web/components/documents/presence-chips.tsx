"use client";

import { useState } from "react";
import type { PresenceUser } from "@docsync/shared";
import { PRESENCE_LABELS } from "@/constants/labels";

const MAX_VISIBLE = 3;

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Deterministic per person, so the same collaborator keeps the same colour across
 * reloads and across everyone's screens — a chip that changed colour on every poll
 * would read as a different person arriving.
 */
const CHIP_TINTS = [
  "bg-brand-soft text-brand",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning",
  "bg-muted text-foreground-2",
] as const;

function tintFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CHIP_TINTS[hash % CHIP_TINTS.length]!;
}

/**
 * The Google photo when it loads, initials when it doesn't — Google rate-limits
 * hotlinked avatars, and the worker doesn't cache them for offline.
 */
function ChipAvatar({ name, avatarUrl }: Pick<PresenceUser, "name" | "avatarUrl">) {
  const [failed, setFailed] = useState(false);

  if (!avatarUrl || failed) return initials(name);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      // Google serves these far more reliably without a cross-site Referer.
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-full rounded-full object-cover"
    />
  );
}

function describe(people: PresenceUser[]): string {
  const names = people.map((person) => person.name ?? PRESENCE_LABELS.someone);
  if (names.length === 1) return `${names[0]} ${PRESENCE_LABELS.hasThisOpen}`;
  return `${names.join(", ")} ${PRESENCE_LABELS.haveThisOpen}`;
}

/**
 * "Who else has this document open." Open/not-open only — no cursors, no typing
 * indicator, because there is no persistent transport to carry them (techspec 7).
 *
 * Renders nothing when you are alone, rather than an empty frame: the absence of
 * chips is the honest signal that nobody else is here.
 */
export function PresenceChips({ people }: { people: PresenceUser[] }) {
  if (people.length === 0) return null;

  const visible = people.slice(0, MAX_VISIBLE);
  const overflow = people.length - visible.length;

  return (
    <div
      className="flex items-center -space-x-1.5"
      // One label for the whole stack: a screen reader should hear "Ada and Priya
      // have this open", not three unlabelled avatars.
      role="img"
      aria-label={describe(people)}
      title={describe(people)}
    >
      {visible.map((person) => (
        <span
          key={person.userId}
          aria-hidden="true"
          className={`flex size-7 items-center justify-center rounded-full border-2 border-card text-caption font-medium ${tintFor(person.userId)}`}
        >
          {/* Keyed on the URL so a new photo gets a fresh attempt. */}
          <ChipAvatar key={person.avatarUrl} name={person.name} avatarUrl={person.avatarUrl} />
        </span>
      ))}

      {overflow > 0 ? (
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-caption font-medium text-foreground-2"
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
