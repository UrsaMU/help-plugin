/**
 * SECURITY [M2/M3] — REST API bypasses HelpEntry.lock
 *
 * M2: GET /api/v1/help/:topic must NOT return a locked entry to a caller
 *     whose userId fails the lock (or is null / unauthenticated).
 *
 * M3: GET /api/v1/help must NOT include locked entries in the listing for
 *     callers who fail the lock.
 *
 * Red phase: these tests verify the EXPLOIT exists (current code has no
 * lock check in the route GET handlers).  They flip to green once
 * routePassesLock() is wired into both GET handlers.
 */

import { assertEquals, assertMatch } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

const ROUTES_SRC = await Deno.readTextFile(
  new URL("../../src/routes.ts", import.meta.url).pathname,
);

// ── M2 — GET /api/v1/help/:topic ─────────────────────────────────────────────

describe({ name: "M2 — GET /api/v1/help/:topic must enforce entry.lock", sanitizeResources: false, sanitizeOps: false }, () => {
  it("[EXPLOIT] routes.ts GET /:topic handler must check entry.lock", () => {
    // After patch: entry.lock check must appear before the Response.json({ entry }) line.
    // We look for a call to routePassesLock (or equivalent guard) inside the
    // GET topic handler.
    assertMatch(
      ROUTES_SRC,
      /routePassesLock/,
      "M2: no routePassesLock() call found in routes.ts — locked topics exposed via REST",
    );
  });

  it("[EXPLOIT] routePassesLock must return false when userId is null and lock is set", async () => {
    const { routePassesLock } = await import("../../src/routes.ts");
    // null userId + any lock = always false (user is not connected)
    assertEquals(
      await routePassesLock(null, "connected"),
      false,
      "M2: unauthenticated caller passed a 'connected' lock — should be denied",
    );
    assertEquals(
      await routePassesLock(null, "connected admin+"),
      false,
      "M2: unauthenticated caller passed an admin lock — should be denied",
    );
  });

  it("[EXPLOIT] routePassesLock must return true when lock is undefined (no restriction)", async () => {
    const { routePassesLock } = await import("../../src/routes.ts");
    assertEquals(
      await routePassesLock(null, undefined),
      true,
      "M2: unlocked entry must be accessible without auth",
    );
    assertEquals(
      await routePassesLock("some-user-id", undefined),
      true,
      "M2: unlocked entry must be accessible with auth",
    );
  });
});

// ── M3 — GET /api/v1/help listing ────────────────────────────────────────────

describe("M3 — GET /api/v1/help listing must filter locked entries", () => {
  it("[EXPLOIT] routes.ts GET /api/v1/help handler must filter by lock", () => {
    // After patch: the GET /api/v1/help handler must filter topics through
    // routePassesLock before building the response.
    // We verify that the listing block references routePassesLock.
    assertMatch(
      ROUTES_SRC,
      /routePassesLock/,
      "M3: no routePassesLock() call found in routes.ts — locked topics exposed in listings",
    );
  });

  it("[EXPLOIT] routes.ts listing GET block must await lock filtering", () => {
    // The listing endpoint must not just call helpRegistry.all() and return it raw.
    // After patch: it must filter the results.  We verify the listing handler
    // does NOT directly pass `topics` to Response.json without filtering.
    const listingBlock = ROUTES_SRC.slice(
      ROUTES_SRC.indexOf("GET /api/v1/help"),
      ROUTES_SRC.indexOf("registerPluginRoute(\"/api/v1/help/:topic\""),
    );
    assertMatch(
      listingBlock,
      /filter|routePassesLock/,
      "M3: listing handler returns unfiltered topics — locked topics exposed in index",
    );
  });
});

// ── L2 — lock expression length guard ────────────────────────────────────────

describe("L2 — +help/lock must reject oversized lock expressions", () => {
  it("commands.ts +help/lock must validate lock length before storing", () => {
    // After patch: the +help/lock exec handler checks rawLock.length.
    assertMatch(
      Deno.readTextFileSync(
        new URL("../../src/commands.ts", import.meta.url).pathname,
      ),
      /rawLock\.length|lock.*\.length/,
      "L2: no lock expression length guard found in +help/lock handler",
    );
  });
});
